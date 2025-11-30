-- Migration: update meetings select policy to allow meeting_attendees

-- Ensure RLS is enabled for meetings
ALTER TABLE IF EXISTS public.meetings ENABLE ROW LEVEL SECURITY;

-- Replace the select policy to allow owners, invitees, or attendees to select meetings
DROP POLICY IF EXISTS meetings_select_attendees_only ON public.meetings;

CREATE POLICY meetings_select_attendees_only ON public.meetings
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      owner = auth.uid()
      OR EXISTS (SELECT 1 FROM public.invitations i WHERE i.meeting_id = public.meetings.id AND i.invitee = auth.uid())
      OR EXISTS (SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.meetings.id AND ma.user_id = auth.uid())
    )
  );
