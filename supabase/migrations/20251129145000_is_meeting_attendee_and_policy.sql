-- Migration: add SECURITY DEFINER helper and update meetings select policy to avoid RLS recursion

-- Create helper function to check membership using SECURITY DEFINER so it can bypass RLS
create or replace function public.is_meeting_attendee(meeting uuid, uid uuid)
returns boolean
language sql
security definer
as $$
  select exists(
    select 1 from public.meeting_attendees ma
    where ma.meeting_id = $1 and ma.user_id = $2
  );
$$;

grant execute on function public.is_meeting_attendee(uuid, uuid) to authenticated;

-- Now update the meetings select policy to call the helper instead of referencing meeting_attendees directly
ALTER TABLE IF EXISTS public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meetings_select_attendees_only ON public.meetings;

CREATE POLICY meetings_select_attendees_only ON public.meetings
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.invitations i
         WHERE i.meeting_id = public.meetings.id
           AND i.invitee = auth.uid()
      )
      OR public.is_meeting_attendee(public.meetings.id, auth.uid())
    )
  );
