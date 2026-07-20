-- ============================================================
-- SYNC: registo histórico do que já estava em produção (2026-07-20)
-- ============================================================
-- Nesta data, o schema local (20251201000000_schema_init.sql) tinha
-- policies "Enable all access for authenticated users" (USING true) e RPCs
-- mark_deal_won/mark_deal_lost/reopen_deal sem filtro de organização —
-- corrigido DIRETAMENTE em produção por migrations remotas que nunca
-- desceram para o repo (`supabase migrations list` no projeto
-- utnwchsyfmdxsgxbgurk):
--   20260609203050 tenant_isolation_rls
--   20260609203143 tenant_isolation_rls_revoke_public_fix
--   20260609203826 emergency_rollback_open_rls
--   20260612011216 close_emergency_open_rls_org_isolation
--   20260702203729 fix_deal_rpcs_org_scope_and_revoke_anon
--   20260702203852 fix_deal_rpcs_revoke_public_grant_authenticated
-- Esta migration corre depois do schema_init.sql já corrigido diretamente
-- (mesmo timestamp da correção do ficheiro base) — é redundante em efeito
-- (DROP IF EXISTS + CREATE idêntico) mas fica registada porque já foi
-- aplicada e consta no histórico de migrations do projeto Supabase; apagá-la
-- do disco criaria um mismatch entre o histórico remoto e o repo local.

-- Helper: organização do utilizador autenticado, derivada do JWT via profiles
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ select organization_id from public.profiles where id = auth.uid() $$;

-- RPCs de deals: tenant derivado de current_org_id(), nunca do parâmetro
CREATE OR REPLACE FUNCTION public.mark_deal_won(deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_org uuid;
begin
  v_org := current_org_id();
  if v_org is null then raise exception 'not_authenticated' using errcode='insufficient_privilege'; end if;
  update public.deals
     set is_won=true, is_lost=false, closed_at=now(), updated_at=now()
   where id=deal_id and organization_id=v_org;
end;
$$;

CREATE OR REPLACE FUNCTION public.mark_deal_lost(deal_id uuid, reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_org uuid;
begin
  v_org := current_org_id();
  if v_org is null then raise exception 'not_authenticated' using errcode='insufficient_privilege'; end if;
  update public.deals
     set is_lost=true, is_won=false, loss_reason=coalesce(reason, loss_reason), closed_at=now(), updated_at=now()
   where id=deal_id and organization_id=v_org;
end;
$$;

CREATE OR REPLACE FUNCTION public.reopen_deal(deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare v_org uuid;
begin
  v_org := current_org_id();
  if v_org is null then raise exception 'not_authenticated' using errcode='insufficient_privilege'; end if;
  update public.deals
     set is_won=false, is_lost=false, closed_at=null, updated_at=now()
   where id=deal_id and organization_id=v_org;
end;
$$;

-- Policies: isolamento por organização (substituem as antigas "USING (true)")
DO $do$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'boards','board_stages','crm_companies','products','deals','deal_items',
    'activities','tags','custom_field_definitions','leads',
    'system_notifications','audit_logs','security_alerts','contacts',
    'api_keys','ai_feature_flags','ai_prompt_templates',
    'organization_invites','organization_settings',
    'integration_inbound_sources','integration_outbound_endpoints',
    'webhook_deliveries','webhook_events_in','webhook_events_out'
  ])
  LOOP
    -- nomes antigos possíveis, incluindo variantes por operação
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "org_isolation" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "org_isolation" ON public.%I FOR ALL TO authenticated USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id())',
      t
    );
  END LOOP;
END;
$do$;

-- organizations: só a própria organização do utilizador
DROP POLICY IF EXISTS "authenticated_access" ON public.organizations;
DROP POLICY IF EXISTS "org_self" ON public.organizations;
CREATE POLICY "org_self" ON public.organizations FOR ALL TO authenticated
  USING (id = current_org_id()) WITH CHECK (id = current_org_id());

-- profiles: próprio perfil ou perfis da mesma organização
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR organization_id = current_org_id());

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- deal_notes / deal_files: isolamento via organização do deal associado
DROP POLICY IF EXISTS "deal_notes_access" ON public.deal_notes;
DROP POLICY IF EXISTS "via_deal_org" ON public.deal_notes;
CREATE POLICY "via_deal_org" ON public.deal_notes FOR ALL TO authenticated
  USING (deal_id IN (SELECT deals.id FROM public.deals WHERE deals.organization_id = current_org_id()))
  WITH CHECK (deal_id IN (SELECT deals.id FROM public.deals WHERE deals.organization_id = current_org_id()));

DROP POLICY IF EXISTS "deal_files_access" ON public.deal_files;
DROP POLICY IF EXISTS "via_deal_org" ON public.deal_files;
CREATE POLICY "via_deal_org" ON public.deal_files FOR ALL TO authenticated
  USING (deal_id IN (SELECT deals.id FROM public.deals WHERE deals.organization_id = current_org_id()))
  WITH CHECK (deal_id IN (SELECT deals.id FROM public.deals WHERE deals.organization_id = current_org_id()));

-- user_settings / user_consents / ai_*: dados do próprio utilizador
DROP POLICY IF EXISTS "user_settings_isolate" ON public.user_settings;
DROP POLICY IF EXISTS "own_user" ON public.user_settings;
CREATE POLICY "own_user" ON public.user_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_user" ON public.user_consents;
CREATE POLICY "own_user" ON public.user_consents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_user" ON public.ai_conversations;
CREATE POLICY "own_user" ON public.ai_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_user" ON public.ai_decisions;
CREATE POLICY "own_user" ON public.ai_decisions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_user" ON public.ai_audio_notes;
CREATE POLICY "own_user" ON public.ai_audio_notes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_user" ON public.ai_suggestion_interactions;
CREATE POLICY "own_user" ON public.ai_suggestion_interactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- quick_scripts: script próprio ou script de sistema partilhado
DROP POLICY IF EXISTS "quick_scripts_select" ON public.quick_scripts;
DROP POLICY IF EXISTS "quick_scripts_insert" ON public.quick_scripts;
DROP POLICY IF EXISTS "quick_scripts_update" ON public.quick_scripts;
DROP POLICY IF EXISTS "quick_scripts_delete" ON public.quick_scripts;
DROP POLICY IF EXISTS "quick_own_or_system" ON public.quick_scripts;
CREATE POLICY "quick_own_or_system" ON public.quick_scripts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_system = true)
  WITH CHECK (user_id = auth.uid());

-- lifecycle_stages: enum global do sistema (Lead/MQL/Oportunidade/Cliente),
-- sem organization_id, sem dados sensíveis — aberto por definição correta
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.lifecycle_stages;
DROP POLICY IF EXISTS "lifecycle_open" ON public.lifecycle_stages;
CREATE POLICY "lifecycle_open" ON public.lifecycle_stages FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
