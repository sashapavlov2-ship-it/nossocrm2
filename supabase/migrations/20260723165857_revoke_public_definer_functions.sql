-- Fecho real das SECURITY DEFINER: revogar PUBLIC (a migration anterior só
-- revogava anon, mas anon herdava EXECUTE do grant default a PUBLIC) e conceder
-- só ao papel que precisa. Verificado em prod 2026-07-23:
--   get_dashboard_stats/create_api_key como anon → 42501 permission denied;
--   validate_api_key e is_instance_initialized como anon → continuam 200.
-- Call sites mapeados no repo antes do REVOKE (lib/public-api/auth.ts usa anon
-- para validate_api_key; is_instance_initialized corre pré-login no middleware).

REVOKE ALL ON FUNCTION public.create_api_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_api_key(text) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.get_contact_stage_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_stage_counts() TO authenticated;

REVOKE ALL ON FUNCTION public.get_singleton_organization_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_singleton_organization_id() TO authenticated;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_deal_won(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_deal_won(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_deal_lost(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_deal_lost(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.reopen_deal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_deal(uuid) TO authenticated;

-- Internos/triggers: ninguém chama via RPC; triggers verificam privilégio na
-- criação, não na chamada — seguro revogar tudo.
REVOKE ALL ON FUNCTION public._api_key_make_token() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._api_key_sha256_hex(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_rate_limits(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_email_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_deal_stage_changed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_org_id() FROM PUBLIC, anon, authenticated;

-- Ficam expostos de propósito: validate_api_key + is_instance_initialized
-- (anon precisa), current_org_id/app_current_org_id (usadas em policies RLS,
-- devolvem NULL sem sessão).
