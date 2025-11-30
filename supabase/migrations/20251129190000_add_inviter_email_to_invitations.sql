-- Migration: add inviter_email to invitations and update invite RPC
-- Adds a denormalized inviter email so UI can show who invited the user

-- 1) Add column (if not present)
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS inviter_email text;

-- 2) Backfill existing invitation rows with inviter emails where available
UPDATE public.invitations i
  SET inviter_email = u.email
  FROM auth.users u
  WHERE i.inviter = u.id AND (i.inviter_email IS NULL OR i.inviter_email = '');

-- 3) Replace/ensure the invite_user_by_email RPC populates inviter_email
create or replace function public.invite_user_by_email(meeting uuid, invite_email text)
returns jsonb
language plpgsql
security definer
as $$
declare
  inv_id uuid;
  invitee_id uuid;
  m_title text;
  inviter_email text;
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

  -- capture inviter email
  select email into inviter_email from auth.users where id = auth.uid() limit 1;

  -- resolve user by email from auth.users
  select id into invitee_id from auth.users where email = invite_email limit 1;
  if invitee_id is null then
    raise exception 'user not found';
  end if;

  -- create invitation audit row, include meeting title and inviter email
  insert into public.invitations (meeting_id, invitee, inviter, status, meeting_title, inviter_email)
    values (meeting, invitee_id, auth.uid(), 'pending', m_title, inviter_email)
    returning id into inv_id;

  -- do NOT create/modify meeting_attendees here; the invitee will be added when they accept

  return jsonb_build_object('success', true, 'invitation_id', inv_id, 'invitee_id', invitee_id);
end;
$$;

-- allow authenticated users to execute the RPC (it still checks auth.uid() internally)
grant execute on function public.invite_user_by_email(uuid, text) to authenticated;
