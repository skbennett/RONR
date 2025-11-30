-- Migration: get_meeting_attendees RPC
-- Returns attendee rows for a meeting including email and display name

-- Drop existing function if it exists to allow changing the return signature
DROP FUNCTION IF EXISTS public.get_meeting_attendees(uuid);

create function public.get_meeting_attendees(meeting uuid)
returns table(user_id uuid, role public.meeting_role, email text, joined_at timestamptz)
language plpgsql
security definer
as $$
begin
  -- authorize: caller must be meeting owner or an attendee
  if not exists (
    select 1 from public.meeting_attendees ma where ma.meeting_id = meeting and ma.user_id = auth.uid()
  ) and not exists (
    select 1 from public.meetings m where m.id = meeting and m.owner = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select ma.user_id, ma.role, au.email::text, ma.joined_at
    from public.meeting_attendees ma
    left join auth.users au on au.id = ma.user_id
    where ma.meeting_id = meeting
    order by ma.joined_at nulls last;
end;
$$;

grant execute on function public.get_meeting_attendees(uuid) to authenticated;
