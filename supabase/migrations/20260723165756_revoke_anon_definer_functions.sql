-- Fechar SECURITY DEFINER a anon (anon key é pública).
-- NOTA: esta migration foi insuficiente sozinha — o EXECUTE continuava herdado
-- do grant a PUBLIC (default Postgres). O fecho real está na migration seguinte
-- (20260723165857_revoke_public_definer_functions). Fica como registo histórico.

REVOKE EXECUTE ON FUNCTION public.create_api_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_api_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_contact_stage_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_singleton_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public._api_key_make_token() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._api_key_sha256_hex(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_organization() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_deal_stage_changed() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_org_id() FROM anon, authenticated;
