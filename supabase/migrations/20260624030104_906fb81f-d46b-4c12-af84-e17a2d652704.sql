
-- Soft delete columns on items
ALTER TABLE public.items
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX items_not_deleted_idx ON public.items (is_active) WHERE deleted_at IS NULL;

ALTER TABLE public.pending_submissions
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Restrict normal item visibility to non-deleted rows; admins still see everything
DROP POLICY IF EXISTS "Authenticated can read items" ON public.items;
CREATE POLICY "Read non-deleted items" ON public.items
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL OR public.has_role(auth.uid(),'admin'));

-- Enriched audit log
ALTER TABLE public.audit_logs
  ADD COLUMN target_type TEXT,
  ADD COLUMN old_value JSONB,
  ADD COLUMN new_value JSONB;

CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_target_idx ON public.audit_logs (target_table, target_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);

-- Moderators can also read audit; insertion stays as service_role
DROP POLICY IF EXISTS "Admins read audit" ON public.audit_logs;
CREATE POLICY "Admins and mods read audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- Centralized audit helper (called from server fns via service role)
CREATE OR REPLACE FUNCTION public.write_audit(
  _actor UUID,
  _action TEXT,
  _target_type TEXT,
  _target_table TEXT,
  _target_id UUID,
  _old JSONB,
  _new JSONB,
  _metadata JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, target_type, target_table, target_id, old_value, new_value, metadata)
  VALUES (_actor, _action, _target_type, _target_table, _target_id, _old, _new, _metadata)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.write_audit(UUID, TEXT, TEXT, TEXT, UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit(UUID, TEXT, TEXT, TEXT, UUID, JSONB, JSONB, JSONB) TO service_role;
