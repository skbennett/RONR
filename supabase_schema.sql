-- supabase_schema.sql
-- Schema for meetings, attendees, invitations, motions, votes, chats, meeting_history
-- Includes triggers for updated_at and example RLS policies

-- Extensions (pgcrypto for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'scheduled',
  coordination jsonb DEFAULT '{}'::jsonb,
  owner uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meetings_owner ON public.meetings (owner);
CREATE INDEX IF NOT EXISTS idx_meetings_coordination_gin ON public.meetings USING gin (coordination);

-- Ensure meeting titles are unique (case-insensitive). Create a unique index on lower(title).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uniq_meetings_title') THEN
    CREATE UNIQUE INDEX uniq_meetings_title ON public.meetings ((lower(title)));
  END IF;
END$$;

-- Roles and attendees
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_role') THEN
    CREATE TYPE public.meeting_role AS ENUM ('owner','chair','member','invited');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.meeting_role NOT NULL DEFAULT 'invited',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  UNIQUE (meeting_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_attendees_meeting ON public.meeting_attendees (meeting_id);
CREATE INDEX IF NOT EXISTS idx_attendees_user ON public.meeting_attendees (user_id);

-- Invitations (optional)
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  invitee uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invitations_meeting ON public.invitations (meeting_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON public.invitations (invitee);

-- Motions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motion_status') THEN
    CREATE TYPE public.motion_status AS ENUM ('open','passed','failed','postponed','closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vote_choice') THEN
    CREATE TYPE public.vote_choice AS ENUM ('yes','no','abstain');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.motions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.motions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  proposer uuid NOT NULL REFERENCES auth.users(id),
  status public.motion_status NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_motions_meeting ON public.motions (meeting_id);
-- Ensure `parent_id` column exists (idempotent) for older databases that
-- may not have this migration applied yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'motions' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.motions ADD COLUMN parent_id uuid REFERENCES public.motions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idx_motions_parent'
  ) THEN
    CREATE INDEX idx_motions_parent ON public.motions (parent_id);
  END IF;
END$$;

-- Motion replies (discussion tree for motions)
CREATE TABLE IF NOT EXISTS public.motion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id uuid NOT NULL REFERENCES public.motions(id) ON DELETE CASCADE,
  parent_reply_id uuid REFERENCES public.motion_replies(id) ON DELETE CASCADE,
  author uuid NOT NULL REFERENCES auth.users(id),
  text text NOT NULL,
  stance text DEFAULT 'neutral',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_replies_motion ON public.motion_replies (motion_id);

-- Votes
CREATE TABLE IF NOT EXISTS public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id uuid NOT NULL REFERENCES public.motions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice public.vote_choice NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (motion_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_motion ON public.votes (motion_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes (user_id);

-- Chats
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chats_meeting ON public.chats (meeting_id);
CREATE INDEX IF NOT EXISTS idx_chats_user ON public.chats (user_id);

-- Meeting history (append-only)
CREATE TABLE IF NOT EXISTS public.meeting_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_history_meeting ON public.meeting_history (meeting_id);

-- Triggers to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_meetings_updated_at') THEN
    CREATE TRIGGER trg_meetings_updated_at
    BEFORE UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_motions_updated_at') THEN
    CREATE TRIGGER trg_motions_updated_at
    BEFORE UPDATE ON public.motions
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();
  END IF;
END;
$$;

-- Enable RLS (apply after testing in dev; you must create policies to match your auth model)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_history ENABLE ROW LEVEL SECURITY;

-- Example RLS policies (tailor/test in Supabase SQL editor before enabling in production)
-- Meetings: only owner or attendees may SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'meetings_select_attendees_only') THEN
    -- Allow owners and invited users (via invitations) to select meetings.
    -- Avoid selecting from `meeting_attendees` here to prevent RLS recursion
    CREATE POLICY meetings_select_attendees_only ON public.meetings
      FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
          owner = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.invitations i WHERE i.meeting_id = public.meetings.id AND i.invitee = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'meetings_insert_authenticated') THEN
    CREATE POLICY meetings_insert_authenticated ON public.meetings
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'meetings_update_by_owner_or_chair') THEN
    -- Allow owners to update. Chair-based updates are handled separately to avoid
    -- selecting from `meeting_attendees` inside a policy on `meetings` (which
    -- can create circular RLS evaluation). If you need chairs to update, we
    -- can add a SECURITY DEFINER helper to check chair role safely.
    CREATE POLICY meetings_update_by_owner_or_chair ON public.meetings
      FOR UPDATE USING (
        auth.uid() = owner
      );
  END IF;
END$$;

-- Meeting attendees policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'attendees_select_attendee_only') THEN
    CREATE POLICY attendees_select_attendee_only ON public.meeting_attendees
      FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
          -- allow selecting your own attendee row or if you are the meeting owner
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.meetings m WHERE m.id = public.meeting_attendees.meeting_id AND m.owner = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'attendees_insert_by_chair_or_self') THEN
    CREATE POLICY attendees_insert_by_chair_or_self ON public.meeting_attendees
      FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
          -- allow people to add themselves, or allow if you are the meeting owner
          (user_id = auth.uid())
          OR EXISTS (
             SELECT 1 FROM public.meetings m WHERE m.id = public.meeting_attendees.meeting_id AND m.owner = auth.uid()
          )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'attendees_update_roles_by_chair_or_owner') THEN
    CREATE POLICY attendees_update_roles_by_chair_or_owner ON public.meeting_attendees
      FOR UPDATE USING (
        auth.uid() IS NOT NULL AND (
         -- only allow updating roles if you are the meeting owner
         EXISTS (
           SELECT 1 FROM public.meetings m WHERE m.id = public.meeting_attendees.meeting_id AND m.owner = auth.uid()
         )
        )
      ) WITH CHECK (
        auth.uid() IS NOT NULL AND (
         EXISTS (
           SELECT 1 FROM public.meetings m WHERE m.id = public.meeting_attendees.meeting_id AND m.owner = auth.uid()
         )
        )
      );
  END IF;
END$$;

-- Invitations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invitations_insert_by_chair_or_owner') THEN
    CREATE POLICY invitations_insert_by_chair_or_owner ON public.invitations
      FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
          EXISTS ( SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.invitations.meeting_id AND ma.user_id = auth.uid() AND ma.role IN ('chair','owner') )
          OR EXISTS ( SELECT 1 FROM public.meetings m WHERE m.id = public.invitations.meeting_id AND m.owner = auth.uid() )
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'invitations_select') THEN
    CREATE POLICY invitations_select ON public.invitations
      FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
          invitee = auth.uid()
          OR EXISTS ( SELECT 1 FROM public.meetings m WHERE m.id = public.invitations.meeting_id AND m.owner = auth.uid() )
          OR EXISTS ( SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.invitations.meeting_id AND ma.user_id = auth.uid() AND ma.role = 'chair' )
        )
      );
  END IF;
END$$;

-- Motions RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'motions_select_attendees_only') THEN
    CREATE POLICY motions_select_attendees_only ON public.motions
      FOR SELECT USING (
        auth.uid() IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.motions.meeting_id AND ma.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'motions_insert_attendee_only') THEN
    CREATE POLICY motions_insert_attendee_only ON public.motions
      FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND proposer = auth.uid() AND EXISTS (
          SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.motions.meeting_id AND ma.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'motions_update_status_by_chair_or_owner') THEN
    CREATE POLICY motions_update_status_by_chair_or_owner ON public.motions
      FOR UPDATE USING (
        auth.uid() IS NOT NULL AND (
          EXISTS (
            SELECT 1 FROM public.meetings m WHERE m.id = public.motions.meeting_id AND m.owner = auth.uid()
          ) OR EXISTS (
            SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.motions.meeting_id AND ma.user_id = auth.uid() AND ma.role = 'chair'
          )
        )
      );
  END IF;
END$$;

-- RLS for motion replies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'replies_select_attendees_only') THEN
    CREATE POLICY replies_select_attendees_only ON public.motion_replies FOR SELECT USING (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.meeting_attendees ma JOIN public.motions mo ON mo.meeting_id = ma.meeting_id WHERE mo.id = public.motion_replies.motion_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'replies_insert_attendees_only') THEN
    CREATE POLICY replies_insert_attendees_only ON public.motion_replies FOR INSERT WITH CHECK (
      auth.uid() IS NOT NULL AND author = auth.uid() AND EXISTS (
        SELECT 1 FROM public.meeting_attendees ma JOIN public.motions mo ON mo.meeting_id = ma.meeting_id WHERE mo.id = public.motion_replies.motion_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'replies_update_own') THEN
    CREATE POLICY replies_update_own ON public.motion_replies FOR UPDATE USING (auth.uid() = author) WITH CHECK (auth.uid() = author);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'replies_delete_own_or_chair') THEN
    CREATE POLICY replies_delete_own_or_chair ON public.motion_replies FOR DELETE USING (
      auth.uid() = author OR EXISTS (
        SELECT 1 FROM public.meeting_attendees ma JOIN public.motions mo ON mo.meeting_id = ma.meeting_id WHERE mo.id = public.motion_replies.motion_id AND ma.user_id = auth.uid() AND ma.role IN ('chair','owner')
      )
    );
  END IF;
END$$;

-- RPC to end a motion: compute outcome and archive to meeting_history
CREATE OR REPLACE FUNCTION public.end_motion(motion uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  m_row RECORD;
  yes_count int;
  no_count int;
  abstain_count int;
  total int;
  outcome text;
  hist jsonb;
BEGIN
  SELECT * INTO m_row FROM public.motions WHERE id = motion;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'motion not found';
  END IF;

  SELECT COUNT(*) INTO yes_count FROM public.votes WHERE motion_id = motion AND choice = 'yes';
  SELECT COUNT(*) INTO no_count FROM public.votes WHERE motion_id = motion AND choice = 'no';
  SELECT COUNT(*) INTO abstain_count FROM public.votes WHERE motion_id = motion AND choice = 'abstain';
  total := yes_count + no_count + abstain_count;

  IF total = 0 THEN
    outcome := 'no_decision';
  ELSIF yes_count > no_count THEN
    outcome := 'passed';
  ELSIF no_count > yes_count THEN
    outcome := 'failed';
  ELSE
    outcome := 'tie';
  END IF;

  UPDATE public.motions SET status = CASE WHEN outcome = 'passed' THEN 'passed'::public.motion_status WHEN outcome = 'failed' THEN 'failed'::public.motion_status ELSE 'closed'::public.motion_status END WHERE id = motion;

  hist := jsonb_build_object('motion_id', motion, 'outcome', outcome, 'votes', jsonb_build_object('yes', yes_count, 'no', no_count, 'abstain', abstain_count), 'at', now());
  INSERT INTO public.meeting_history (meeting_id, event_type, event) VALUES (m_row.meeting_id, 'motion_closed', hist);

  RETURN hist;
END;
$$;

-- Votes RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'votes_select_attendees_only') THEN
    CREATE POLICY votes_select_attendees_only ON public.votes FOR SELECT USING (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.motions mo JOIN public.meeting_attendees ma ON ma.meeting_id = mo.meeting_id WHERE mo.id = public.votes.motion_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'votes_insert_attendees_only') THEN
    CREATE POLICY votes_insert_attendees_only ON public.votes
      FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND user_id = auth.uid() AND EXISTS (
          SELECT 1 FROM public.motions mo JOIN public.meeting_attendees ma ON ma.meeting_id = mo.meeting_id WHERE mo.id = public.votes.motion_id AND ma.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'votes_update_own') THEN
    CREATE POLICY votes_update_own ON public.votes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'votes_delete_own') THEN
    CREATE POLICY votes_delete_own ON public.votes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;

-- Chats RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'chats_select_attendees_only') THEN
    CREATE POLICY chats_select_attendees_only ON public.chats FOR SELECT USING (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.chats.meeting_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'chats_insert_attendees_only') THEN
    CREATE POLICY chats_insert_attendees_only ON public.chats FOR INSERT WITH CHECK (
      auth.uid() IS NOT NULL AND user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.chats.meeting_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- History RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'history_insert_attendees_only') THEN
    CREATE POLICY history_insert_attendees_only ON public.meeting_history FOR INSERT WITH CHECK (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.meeting_history.meeting_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'history_select_attendees_only') THEN
    CREATE POLICY history_select_attendees_only ON public.meeting_history FOR SELECT USING (
      auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = public.meeting_history.meeting_id AND ma.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Example RPC for transferring chair (SECURITY DEFINER recommended; set owner to a trusted role and test)
CREATE OR REPLACE FUNCTION public.transfer_chair(meeting uuid, from_user uuid, to_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- authorize caller: must be current chair or owner
  IF NOT EXISTS (
    SELECT 1 FROM public.meeting_attendees ma WHERE ma.meeting_id = meeting AND ma.user_id = auth.uid() AND ma.role IN ('chair','owner')
  ) AND NOT EXISTS (
    SELECT 1 FROM public.meetings m WHERE m.id = meeting AND m.owner = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.meeting_attendees SET role = 'member' WHERE meeting_id = meeting AND user_id = from_user;

  INSERT INTO public.meeting_attendees (meeting_id, user_id, role, joined_at)
    VALUES (meeting, to_user, 'chair', now())
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = 'chair';

  INSERT INTO public.meeting_history (meeting_id, event_type, event)
    VALUES (meeting, 'transfer_chair', jsonb_build_object('from', from_user, 'to', to_user, 'at', now()));
END;
$$;

-- End of schema
