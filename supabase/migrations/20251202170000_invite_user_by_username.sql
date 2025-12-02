-- Migration: invite_user_by_username RPC
-- Allows inviting users by their username from the profiles table

create or replace function public.invite_user_by_username(meeting uuid, invite_username text)
returns jsonb
language plpgsql
security definer
as $$
declare
  inv_id uuid;
  invitee_id uuid;
  m_title text;
  inviter_email text;
  inviter_username text;
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

  -- resolve meeting title for denormalization
  select title into m_title from public.meetings where id = meeting limit 1;

  -- capture inviter email and username
  select email into inviter_email from auth.users where id = auth.uid() limit 1;
  select username into inviter_username from public.profiles where id = auth.uid() limit 1;

  -- resolve user by username from profiles table
  select id into invitee_id from public.profiles where username = invite_username limit 1;
  if invitee_id is null then
    raise exception 'user not found';
  end if;

  -- create invitation audit row, include meeting title, inviter email, and inviter username
  insert into public.invitations (meeting_id, invitee, inviter, status, meeting_title, inviter_email, inviter_username)
    values (meeting, invitee_id, auth.uid(), 'pending', m_title, inviter_email, inviter_username)
    returning id into inv_id;

  -- do NOT create/modify meeting_attendees here; the invitee will be added when they accept

  return jsonb_build_object('success', true, 'invitation_id', inv_id, 'invitee_id', invitee_id);
end;
$$;

-- allow authenticated users to execute the RPC (it still checks auth.uid() internally)
grant execute on function public.invite_user_by_username(uuid, text) to authenticated;
