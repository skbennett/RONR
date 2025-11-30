-- Migration: invite_user_by_email RPC
-- Creates a SECURITY DEFINER function that invites a user by email.
-- Run this in the Supabase SQL editor or apply as a migration.

create or replace function public.invite_user_by_email(meeting uuid, invite_email text)
returns jsonb
language plpgsql
security definer
as $$
declare
  inv_id uuid;
  invitee_id uuid;
begin
  -- authorize: caller must be meeting owner or a chair/owner attendee
  if not exists (
    select 1 from public.meeting_attendees ma
     where ma.meeting_id = meeting and ma.user_id = auth.uid() and ma.role = any (array['chair'::public.meeting_role,'owner'::public.meeting_role])
  ) and not exists (
    select 1 from public.meetings m where m.id = meeting and m.owner = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  -- resolve user by email from auth.users
  select id into invitee_id from auth.users where email = invite_email limit 1;
  if invitee_id is null then
    raise exception 'user not found';
  end if;

  -- create invitation audit row
  insert into public.invitations (meeting_id, invitee, inviter, status)
    values (meeting, invitee_id, auth.uid(), 'pending')
    returning id into inv_id;

  -- do NOT create/modify meeting_attendees here; the invitee will be added when they accept

  return jsonb_build_object('success', true, 'invitation_id', inv_id, 'invitee_id', invitee_id);
end;
$$;

-- allow authenticated users to execute the RPC (it still checks auth.uid() internally)
grant execute on function public.invite_user_by_email(uuid, text) to authenticated;
