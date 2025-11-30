-- Migration: remove_meeting_attendee RPC
-- Allows meeting owner or chair to remove an attendee from meeting_attendees

DROP FUNCTION IF EXISTS public.remove_meeting_attendee(uuid, uuid);

create function public.remove_meeting_attendee(meeting uuid, attendee uuid)
returns void
language plpgsql
security definer
as $$
declare
  is_authorized boolean;
  meeting_owner uuid;
begin
  select owner into meeting_owner from public.meetings where id = meeting;

  -- authorize: caller must be meeting owner or an attendee with role chair
  is_authorized := exists(
    select 1 from public.meeting_attendees ma
    where ma.meeting_id = meeting and ma.user_id = auth.uid() and ma.role = 'chair'
  ) or (meeting_owner = auth.uid());

  if not is_authorized then
    raise exception 'not authorized';
  end if;

  -- Prevent removing the meeting owner
  if attendee = meeting_owner then
    raise exception 'cannot remove meeting owner';
  end if;

  delete from public.meeting_attendees where meeting_id = meeting and user_id = attendee;
end;
$$;

grant execute on function public.remove_meeting_attendee(uuid, uuid) to authenticated;
