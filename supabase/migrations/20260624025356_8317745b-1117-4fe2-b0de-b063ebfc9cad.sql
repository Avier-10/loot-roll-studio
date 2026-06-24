
REVOKE EXECUTE ON FUNCTION public.acquire_spin_lock(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_spin_lock(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_pending_spin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_account_status(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_account_active(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_spin_lock(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_spin_lock(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_pending_spin(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_account_status(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_active(UUID) TO service_role, authenticated;
