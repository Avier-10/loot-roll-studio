
-- Add platform & ip columns to pending_submissions, rejection reason, and moderation_history table
ALTER TABLE public.pending_submissions
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'kick',
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS pending_submissions_status_created_idx
  ON public.pending_submissions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS pending_submissions_dup_idx
  ON public.pending_submissions(kick_username, raw_message, created_at DESC);

CREATE TABLE IF NOT EXISTS public.moderation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  platform TEXT,
  external_username TEXT,
  original_content JSONB,
  final_content JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.moderation_history TO authenticated;
GRANT ALL ON public.moderation_history TO service_role;

ALTER TABLE public.moderation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators read history" ON public.moderation_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE INDEX IF NOT EXISTS moderation_history_created_idx
  ON public.moderation_history(created_at DESC);
