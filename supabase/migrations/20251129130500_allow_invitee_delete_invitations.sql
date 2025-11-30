-- Migration: allow invitee to delete their own invitations

-- Ensure RLS is enabled (should already be enabled in your schema)
ALTER TABLE IF EXISTS public.invitations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated invitee to delete their own invitation row
DROP POLICY IF EXISTS invitations_delete_by_invitee ON public.invitations;
CREATE POLICY invitations_delete_by_invitee ON public.invitations
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND invitee = auth.uid());

-- (Optional) allow invitee to update their own invitation (mark accept/decline) if needed
DROP POLICY IF EXISTS invitations_update_by_invitee ON public.invitations;
CREATE POLICY invitations_update_by_invitee ON public.invitations
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND invitee = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND invitee = auth.uid());
