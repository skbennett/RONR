# RONR Backend API + Supabase Database Documentation

This document describes the **backend-facing interfaces** used by the RONR website.
We used the built-in supabase react library.

The backend is **Supabase** (Auth + Postgres + Realtime + RLS + RPC functions), accessed directly from the React app.

---

## Architecture overview

- **Frontend**: `react-app/` (Vite + React) calls Supabase directly via `@supabase/supabase-js`.
- **Auth**: Supabase Auth (`supabase.auth.*`) with session persisted in browser.
- **Database**: Postgres (Supabase) with Row Level Security (RLS) enforced.
- **Realtime**: Supabase Realtime channels subscribe to Postgres changes in selected tables.

---

## 1) Supabase API (primary backend)

### Client configuration
Defined in `react-app/src/supabaseClient.js`.

- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

The app uses:
```js
createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, detectSessionInUrl: true }
})
```

### Authentication API
Defined in `react-app/src/contexts/AuthContext.jsx`.

- `supabase.auth.getSession()` on boot
- `supabase.auth.onAuthStateChange(...)` to keep UI synced

#### Sign up
```js
supabase.auth.signUp({
  email,
  password,
  options: {
    data: { username },
    displayName: username
  }
})
```

**Side effect**: a database trigger (`public.handle_new_user`) inserts into `public.profiles` using `raw_user_meta_data->>'username'`.

#### Sign in
```js
supabase.auth.signInWithPassword({ email, password })
```

#### Sign out
```js
supabase.auth.signOut()
```

### Authorization / RLS model (high level)

Supabase tables in `public` generally enforce:
- You must be authenticated (`auth.uid() IS NOT NULL`).
- You can read/write only if you are an **attendee** of the relevant meeting, or the **meeting owner**, depending on table.

The DB also defines **SECURITY DEFINER RPCs** for actions that need to bypass RLS safely (while performing internal authorization checks).

---

## 2) Supabase database schema (public)

Types (enums):
- `public.meeting_role`: `owner | chair | member | invited`
- `public.motion_status`: `open | passed | failed | postponed | closed`
- `public.vote_choice`: `yes | no | abstain`

### Tables

#### `public.meetings`
Core meeting record.

Columns:
- `id uuid PK default gen_random_uuid()`
- `title text NOT NULL` (unique case-insensitive via index on `lower(title)`)
- `description text`
- `status text default 'scheduled'`
- `coordination jsonb default '{}'`
- `owner uuid NOT NULL -> auth.users(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()` (updated via trigger)

#### `public.meeting_attendees`
Membership and role for users in a meeting.

Columns:
- `id uuid PK`
- `meeting_id uuid NOT NULL -> public.meetings(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL -> auth.users(id) ON DELETE CASCADE`
- `role public.meeting_role default 'invited'`
- `invited_by uuid -> auth.users(id)`
- `invited_at timestamptz default now()`
- `joined_at timestamptz`

Constraints:
- Unique `(meeting_id, user_id)`

#### `public.invitations`
Invitation audit rows. Invite acceptance is modeled by adding/updating `meeting_attendees` and then deleting the invitation.

Columns (base + later migrations):
- `id uuid PK`
- `meeting_id uuid NOT NULL -> public.meetings(id) ON DELETE CASCADE`
- `invitee uuid NOT NULL -> auth.users(id) ON DELETE CASCADE`
- `inviter uuid NOT NULL -> auth.users(id) ON DELETE CASCADE`
- `status text default 'pending'`
- `created_at timestamptz default now()`
- `expires_at timestamptz`
- `meeting_title text` (denormalized)
- `inviter_email text` (denormalized)
- `inviter_username text` (denormalized)

#### `public.motions`
Proposed motions (and sub-motions).

Columns:
- `id uuid PK`
- `meeting_id uuid NOT NULL -> public.meetings(id) ON DELETE CASCADE`
- `title text NOT NULL`
- `description text`
- `proposer uuid NOT NULL -> auth.users(id)`
- `status public.motion_status default 'open'`
- `parent_id uuid -> public.motions(id) ON DELETE CASCADE`
- `special boolean default false NOT NULL`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()` (updated via trigger)

#### `public.motion_replies`
Threaded discussion/comments on motions.

Columns:
- `id uuid PK`
- `motion_id uuid NOT NULL -> public.motions(id) ON DELETE CASCADE`
- `parent_reply_id uuid -> public.motion_replies(id) ON DELETE CASCADE`
- `author uuid NOT NULL -> auth.users(id)`
- `text text NOT NULL`
- `stance text default 'neutral'`
- `created_at timestamptz default now()`

#### `public.votes`
One vote per motion per user.

Columns:
- `id uuid PK`
- `motion_id uuid NOT NULL -> public.motions(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL -> auth.users(id) ON DELETE CASCADE`
- `choice public.vote_choice NOT NULL`
- `created_at timestamptz default now()`

Constraints:
- Unique `(motion_id, user_id)`

#### `public.chats`
Chat messages scoped to a meeting.

Columns:
- `id uuid PK`
- `meeting_id uuid NOT NULL -> public.meetings(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL -> auth.users(id)`
- `message text NOT NULL`
- `meta jsonb default '{}'`
- `created_at timestamptz default now()`

#### `public.meeting_history`
Canonical event stream for meeting actions (motions/events/votes/etc).

Columns:
- `id uuid PK`
- `meeting_id uuid NOT NULL -> public.meetings(id) ON DELETE CASCADE`
- `event_type text NOT NULL`
- `event jsonb NOT NULL`
- `created_at timestamptz default now()`

#### `public.profiles`
User profile table (username).

Columns:
- `id uuid PK -> auth.users(id) ON DELETE CASCADE`
- `username text NOT NULL`

RLS:
- Select: public
- Insert: only self (`auth.uid() = id`)
- Update: only self (`auth.uid() = id`)

---

## 3) Supabase RPC functions (Postgres)

### `public.end_motion(motion uuid) -> jsonb`
Defined in `20251128230041_remote_schema.sql`.

- Counts votes (`yes/no/abstain`)
- Sets motion status to `passed`, `failed`, or `closed`
- Inserts a `meeting_history` row with `event_type = 'motion_closed'`

**Return json** (shape):
```json
{
  "motion_id": "...",
  "outcome": "passed|failed|tie|no_decision",
  "votes": {"yes": 1, "no": 0, "abstain": 0},
  "at": "2025-12-12T...Z"
}
```

### `public.transfer_chair(meeting uuid, from_user uuid, to_user uuid) -> void`
SECURITY DEFINER. Updated in `20251201090000_update_transfer_chair_set_owner.sql`.

- Authorizes caller as owner/chair.
- Demotes `from_user` to `member`.
- Promotes `to_user` to `owner` (in attendees).
- Updates `public.meetings.owner = to_user`.
- Inserts `meeting_history` event `transfer_chair`.

### `public.get_meeting_attendees(meeting uuid) -> table(user_id, role, email, joined_at)`
SECURITY DEFINER. Defined in `20251129160000_get_meeting_attendees.sql`.

- Authorizes caller as owner or attendee.
- Returns attendee rows joined to `auth.users` for email.

### `public.remove_meeting_attendee(meeting uuid, attendee uuid) -> void`
SECURITY DEFINER. Defined in `20251129170000_remove_meeting_attendee.sql`.

- Authorizes caller as meeting owner or chair.
- Prevents removing the meeting owner.
- Deletes the attendee row.

### `public.invite_user_by_email(meeting uuid, invite_email text) -> jsonb`
SECURITY DEFINER. Defined/updated across migrations:
- `20251129120000_invite_user_by_email.sql`
- `20251129180000_add_meeting_title_to_invitations.sql`
- `20251129190000_add_inviter_email_to_invitations.sql`

Behavior:
- Authorizes caller as owner/chair.
- Looks up invitee in `auth.users` by email.
- Inserts into `public.invitations` (including meeting title + inviter email in later versions).
- Returns `{ success, invitation_id, invitee_id }`.

### `public.invite_user_by_username(meeting uuid, invite_username text) -> jsonb`
SECURITY DEFINER. Defined in `20251202170000_invite_user_by_username.sql`.

Behavior:
- Authorizes caller as owner/chair.
- Looks up invitee in `public.profiles` by username.
- Inserts invitation including meeting title, inviter email, inviter username.

### `public.is_meeting_attendee(meeting uuid, uid uuid) -> boolean`
SECURITY DEFINER helper. Defined in `20251129145000_is_meeting_attendee_and_policy.sql`.

Used to avoid RLS recursion in the `meetings` SELECT policy.

---

## 4) RLS policies (summary)

> Full definitions are in `20251128230041_remote_schema.sql` plus later migration overrides.

### `public.meetings`
- Insert: authenticated, `owner = auth.uid()`
- Select: owner OR invitation invitee OR `is_meeting_attendee(meetings.id, auth.uid())`
- Update: owner only

### `public.meeting_attendees`
- Select: self OR meeting owner
- Insert: self OR meeting owner
- Update: meeting owner (role updates)
- Delete: self OR meeting owner

### `public.invitations`
- Select: invitee only
- Insert: chair/owner
- Delete/Update: invitee can delete/update own row (migration `20251129130500_allow_invitee_delete_invitations.sql`)

### `public.motions`
- Select: meeting attendees
- Insert: proposer must be auth.uid() and attendee
- Update (status): chair or meeting owner
- Update (details): proposer OR chair/owner (`20251202100000_allow_proposer_update_motion.sql`)

### `public.motion_replies`
- Select/Insert: meeting attendees (via join from motion to meeting)
- Update: author only
- Delete: author OR chair/owner

### `public.votes`
- Select/Insert: meeting attendees
- Update/Delete: vote owner only

### `public.chats`
- Select/Insert: meeting attendees

### `public.meeting_history`
- Select/Insert: meeting attendees
- Delete: meeting owner can delete (`add_history_rls_policies` includes a delete policy)

---

## 5) “Supabase API surface” used by the React app

Most “backend calls” are Supabase queries in `react-app/src/services/supabaseDataManager.js`.

### Meetings
- Create meeting
  - `insert public.meetings`
  - `upsert public.meeting_attendees` to add creator as `owner`
- List my meetings
  - `select public.meeting_attendees` by `user_id = auth.uid()`
  - `select public.meetings` by ids
- Delete meeting
  - `delete public.meetings` by id

### Invitations
- Invite by direct user id
  - `insert public.invitations`
- Invite by email
  - `rpc invite_user_by_email(meeting, invite_email)`
- Invite by username
  - `rpc invite_user_by_username(meeting, invite_username)`
- Get my invitations
  - `select public.invitations where invitee = auth.uid()`
  - enrich via `select public.profiles` for inviter usernames
- Accept invite
  - `upsert public.meeting_attendees(role='member')`
  - `delete public.invitations` (meeting_id+invitee)
- Decline invite
  - `delete public.invitations`
  - `delete public.meeting_attendees` (cleanup)

### Attendees
- Get attendees
  - `rpc get_meeting_attendees(meeting)`
  - enrich via `select public.profiles`
- Remove attendee
  - `rpc remove_meeting_attendee(meeting, attendee)`
- Leave meeting
  - `delete public.meeting_attendees` (self)
- Transfer chair/owner
  - `rpc transfer_chair(meeting, from_user, to_user)`

### Motions + Replies
- Propose motion / sub-motion
  - `insert public.motions` (optionally `parent_id`)
  - `insert public.meeting_history` event
- Update motion
  - `update public.motions`
  - `insert public.meeting_history` event
- Postpone / resume
  - `update public.motions(status=...)` + history
- End motion
  - `rpc end_motion(motion)`
- Replies
  - `insert/update/delete public.motion_replies` + history on add

### Voting
- Cast/replace vote
  - `upsert public.votes(onConflict: motion_id,user_id)` + history
- Undo vote
  - `delete public.votes` (self) + history

### Chats
- Send
  - `insert public.chats`
- Delete
  - `delete public.chats` by id

### Meeting history & minutes export
- Export
  - `select public.meeting_history` ordered
  - `rpc get_meeting_attendees` for attendee list

### Realtime
Enabled tables are added to `supabase_realtime` publication in `20251202000000_enable_realtime.sql`.

Client subscriptions:
- `subscribeToMeeting(meetingId, handlers)` listens to postgres changes on:
  - `public.meetings` (filter: `id=eq.<meetingId>`)
  - `public.motions` (filter: `meeting_id=eq.<meetingId>`)
  - `public.chats` (filter: `meeting_id=eq.<meetingId>`)
  - `public.meeting_history` (filter: `meeting_id=eq.<meetingId>`)
  - `public.meeting_attendees` (filter: `meeting_id=eq.<meetingId>`)

---
