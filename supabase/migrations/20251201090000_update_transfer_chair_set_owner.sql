-- Migration: update transfer_chair to also set meetings.owner
-- Adds atomic ownership transfer so the meetings.owner column is updated

CREATE OR REPLACE FUNCTION public.transfer_chair(meeting uuid, from_user uuid, to_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  -- authorize caller: must be current chair or owner
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = meeting AND ma.user_id = auth.uid() AND ma.role IN ('chair','owner')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.meetings m WHERE m.id = meeting AND m.owner = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- demote the from_user to member
  UPDATE public.meeting_attendees
    SET role = 'member'
    WHERE meeting_id = meeting AND user_id = from_user;

  -- promote or insert the to_user as owner
  INSERT INTO public.meeting_attendees (meeting_id, user_id, role, joined_at)
    VALUES (meeting, to_user, 'owner', now())
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = 'owner';

  -- update the canonical owner column on meetings so ownership is transferred
  UPDATE public.meetings
    SET owner = to_user
    WHERE id = meeting;

  -- record history
  INSERT INTO public.meeting_history (meeting_id, event_type, event)
    VALUES (meeting, 'transfer_chair', jsonb_build_object('from', from_user, 'to', to_user, 'at', now()));
END;
$$;

ALTER FUNCTION public.transfer_chair(meeting uuid, from_user uuid, to_user uuid) OWNER TO postgres;

-- Grant execute to roles that need to call the RPC (match previous grants)
GRANT EXECUTE ON FUNCTION public.transfer_chair(meeting uuid, from_user uuid, to_user uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.transfer_chair(meeting uuid, from_user uuid, to_user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_chair(meeting uuid, from_user uuid, to_user uuid) TO service_role;
