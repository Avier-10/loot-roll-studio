
-- 1. Audit logs: remove client-side insert policy
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_logs;

-- 2. Pending submissions: restrict reads to admins only (moderators read via server-side service role)
DROP POLICY IF EXISTS "Mods and admins read submissions" ON public.pending_submissions;
CREATE POLICY "Admins read submissions"
  ON public.pending_submissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Mods and admins update submissions" ON public.pending_submissions;
CREATE POLICY "Admins update submissions"
  ON public.pending_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Revoke EXECUTE on internal SECURITY DEFINER helpers from authenticated/anon/public
REVOKE EXECUTE ON FUNCTION public.get_account_status(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_account_active(uuid) FROM authenticated, anon, PUBLIC;
