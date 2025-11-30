


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."meeting_role" AS ENUM (
    'owner',
    'chair',
    'member',
    'invited'
);


ALTER TYPE "public"."meeting_role" OWNER TO "postgres";


CREATE TYPE "public"."motion_status" AS ENUM (
    'open',
    'passed',
    'failed',
    'postponed',
    'closed'
);


ALTER TYPE "public"."motion_status" OWNER TO "postgres";


CREATE TYPE "public"."vote_choice" AS ENUM (
    'yes',
    'no',
    'abstain'
);


ALTER TYPE "public"."vote_choice" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_motion"("motion" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."end_motion"("motion" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_chair"("meeting" "uuid", "from_user" "uuid", "to_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

  UPDATE public.meeting_attendees SET role = 'member' WHERE meeting_id = meeting AND user_id = from_user;

  INSERT INTO public.meeting_attendees (meeting_id, user_id, role, joined_at)
    VALUES (meeting, to_user, 'chair', now())
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET role = 'chair';

  INSERT INTO public.meeting_history (meeting_id, event_type, event)
    VALUES (meeting, 'transfer_chair', jsonb_build_object('from', from_user, 'to', to_user, 'at', now()));
END;
$$;


ALTER FUNCTION "public"."transfer_chair"("meeting" "uuid", "from_user" "uuid", "to_user" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "invitee" "uuid" NOT NULL,
    "inviter" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."meeting_role" DEFAULT 'invited'::"public"."meeting_role" NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone
);


ALTER TABLE "public"."meeting_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meeting_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "coordination" "jsonb" DEFAULT '{}'::"jsonb",
    "owner" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motion_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "motion_id" "uuid" NOT NULL,
    "parent_reply_id" "uuid",
    "author" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "stance" "text" DEFAULT 'neutral'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."motion_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."motions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "proposer" "uuid" NOT NULL,
    "status" "public"."motion_status" DEFAULT 'open'::"public"."motion_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid"
);


ALTER TABLE "public"."motions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "motion_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "choice" "public"."vote_choice" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_meeting_id_user_id_key" UNIQUE ("meeting_id", "user_id");



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_history"
    ADD CONSTRAINT "meeting_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motion_replies"
    ADD CONSTRAINT "motion_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."motions"
    ADD CONSTRAINT "motions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_motion_id_user_id_key" UNIQUE ("motion_id", "user_id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



CREATE INDEX "chats_meeting_id_idx" ON "public"."chats" USING "btree" ("meeting_id");



CREATE INDEX "chats_user_id_idx" ON "public"."chats" USING "btree" ("user_id");



CREATE INDEX "idx_attendees_meeting" ON "public"."meeting_attendees" USING "btree" ("meeting_id");



CREATE INDEX "idx_attendees_user" ON "public"."meeting_attendees" USING "btree" ("user_id");



CREATE INDEX "idx_chats_meeting" ON "public"."chats" USING "btree" ("meeting_id");



CREATE INDEX "idx_chats_user" ON "public"."chats" USING "btree" ("user_id");



CREATE INDEX "idx_history_meeting" ON "public"."meeting_history" USING "btree" ("meeting_id");



CREATE INDEX "idx_invitations_invitee" ON "public"."invitations" USING "btree" ("invitee");



CREATE INDEX "idx_invitations_meeting" ON "public"."invitations" USING "btree" ("meeting_id");



CREATE INDEX "idx_meetings_coordination_gin" ON "public"."meetings" USING "gin" ("coordination");



CREATE INDEX "idx_meetings_owner" ON "public"."meetings" USING "btree" ("owner");



CREATE INDEX "idx_motions_meeting" ON "public"."motions" USING "btree" ("meeting_id");



CREATE INDEX "idx_motions_parent" ON "public"."motions" USING "btree" ("parent_id");



CREATE INDEX "idx_replies_motion" ON "public"."motion_replies" USING "btree" ("motion_id");



CREATE INDEX "idx_votes_motion" ON "public"."votes" USING "btree" ("motion_id");



CREATE INDEX "idx_votes_user" ON "public"."votes" USING "btree" ("user_id");



CREATE INDEX "invitations_invitee_idx" ON "public"."invitations" USING "btree" ("invitee");



CREATE INDEX "invitations_meeting_id_idx" ON "public"."invitations" USING "btree" ("meeting_id");



CREATE INDEX "meeting_attendees_meeting_id_idx" ON "public"."meeting_attendees" USING "btree" ("meeting_id");



CREATE INDEX "meeting_attendees_user_id_idx" ON "public"."meeting_attendees" USING "btree" ("user_id");



CREATE INDEX "meeting_history_meeting_id_idx" ON "public"."meeting_history" USING "btree" ("meeting_id");



CREATE INDEX "meetings_coordination_idx" ON "public"."meetings" USING "gin" ("coordination");



CREATE INDEX "meetings_owner_idx" ON "public"."meetings" USING "btree" ("owner");



CREATE INDEX "motions_meeting_id_idx" ON "public"."motions" USING "btree" ("meeting_id");



CREATE UNIQUE INDEX "uniq_meetings_title" ON "public"."meetings" USING "btree" ("lower"("title"));



CREATE INDEX "votes_motion_id_idx" ON "public"."votes" USING "btree" ("motion_id");



CREATE INDEX "votes_user_id_idx" ON "public"."votes" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "trg_meetings_updated_at" BEFORE UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_motions_updated_at" BEFORE UPDATE ON "public"."motions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invitee_fkey" FOREIGN KEY ("invitee") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_inviter_fkey" FOREIGN KEY ("inviter") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_history"
    ADD CONSTRAINT "meeting_history_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_owner_fkey" FOREIGN KEY ("owner") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motion_replies"
    ADD CONSTRAINT "motion_replies_author_fkey" FOREIGN KEY ("author") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."motion_replies"
    ADD CONSTRAINT "motion_replies_motion_id_fkey" FOREIGN KEY ("motion_id") REFERENCES "public"."motions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motion_replies"
    ADD CONSTRAINT "motion_replies_parent_reply_id_fkey" FOREIGN KEY ("parent_reply_id") REFERENCES "public"."motion_replies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motions"
    ADD CONSTRAINT "motions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motions"
    ADD CONSTRAINT "motions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."motions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."motions"
    ADD CONSTRAINT "motions_proposer_fkey" FOREIGN KEY ("proposer") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_motion_id_fkey" FOREIGN KEY ("motion_id") REFERENCES "public"."motions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "attendees_insert_by_self_or_owner" ON "public"."meeting_attendees" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND ("m"."owner" = "auth"."uid"())))))));



CREATE POLICY "attendees_select_attendee_only" ON "public"."meeting_attendees" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND ("m"."owner" = "auth"."uid"())))))));



CREATE POLICY "attendees_update_roles_by_owner" ON "public"."meeting_attendees" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND ("m"."owner" = "auth"."uid"())))))) WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND ("m"."owner" = "auth"."uid"()))))));

CREATE POLICY "attendees_delete_by_self_or_owner" ON "public"."meeting_attendees" FOR DELETE USING (("auth"."uid"() IS NOT NULL) AND (("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
  FROM "public"."meetings" "m"
  WHERE (("m"."id" = "meeting_attendees"."meeting_id") AND ("m"."owner" = "auth"."uid"()))))));



ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chats_insert_attendees_only" ON "public"."chats" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "chats"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "chats_select_attendees_only" ON "public"."chats" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "chats"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "history_insert_attendees_only" ON "public"."meeting_history" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "meeting_history"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "history_select_attendees_only" ON "public"."meeting_history" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "meeting_history"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitations_insert_by_chair_or_owner" ON "public"."invitations" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "invitations"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()) AND ("ma"."role" = ANY (ARRAY['chair'::"public"."meeting_role", 'owner'::"public"."meeting_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "invitations"."meeting_id") AND ("m"."owner" = "auth"."uid"())))))));



CREATE POLICY "invitations_select" ON "public"."invitations" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("invitee" = "auth"."uid"())));



ALTER TABLE "public"."meeting_attendees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meetings_insert_authenticated" ON "public"."meetings" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("owner" = "auth"."uid"())));



CREATE POLICY "meetings_select_attendees_only" ON "public"."meetings" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (("owner" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."invitations" "i"
  WHERE (("i"."meeting_id" = "meetings"."id") AND ("i"."invitee" = "auth"."uid"())))))));



CREATE POLICY "meetings_update_by_owner_only" ON "public"."meetings" FOR UPDATE USING (("auth"."uid"() = "owner"));



ALTER TABLE "public"."motions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "motions_insert_attendee_only" ON "public"."motions" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("proposer" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "motions"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "motions_select_attendees_only" ON "public"."motions" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "motions"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "motions_update_status_by_chair_or_owner" ON "public"."motions" FOR UPDATE USING (((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meetings" "m"
  WHERE (("m"."id" = "motions"."meeting_id") AND ("m"."owner" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = "motions"."meeting_id") AND ("ma"."user_id" = "auth"."uid"()) AND ("ma"."role" = 'chair'::"public"."meeting_role"))))));



CREATE POLICY "replies_delete_own_or_chair" ON "public"."motion_replies" FOR DELETE USING ((("auth"."uid"() = "author") OR (EXISTS ( SELECT 1
   FROM ("public"."meeting_attendees" "ma"
     JOIN "public"."motions" "mo" ON (("mo"."meeting_id" = "ma"."meeting_id")))
  WHERE (("mo"."id" = "motion_replies"."motion_id") AND ("ma"."user_id" = "auth"."uid"()) AND ("ma"."role" = ANY (ARRAY['chair'::"public"."meeting_role", 'owner'::"public"."meeting_role"])))))));



CREATE POLICY "replies_insert_attendees_only" ON "public"."motion_replies" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("author" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."meeting_attendees" "ma"
     JOIN "public"."motions" "mo" ON (("mo"."meeting_id" = "ma"."meeting_id")))
  WHERE (("mo"."id" = "motion_replies"."motion_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "replies_select_attendees_only" ON "public"."motion_replies" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."meeting_attendees" "ma"
     JOIN "public"."motions" "mo" ON (("mo"."meeting_id" = "ma"."meeting_id")))
  WHERE (("mo"."id" = "motion_replies"."motion_id") AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "replies_update_own" ON "public"."motion_replies" FOR UPDATE USING (("auth"."uid"() = "author")) WITH CHECK (("auth"."uid"() = "author"));



ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "votes_delete_own" ON "public"."votes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "votes_insert_attendees_only" ON "public"."votes" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = ( SELECT "motions"."meeting_id"
           FROM "public"."motions"
          WHERE ("motions"."id" = "votes"."motion_id"))) AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "votes_select_attendees_only" ON "public"."votes" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."meeting_attendees" "ma"
  WHERE (("ma"."meeting_id" = ( SELECT "motions"."meeting_id"
           FROM "public"."motions"
          WHERE ("motions"."id" = "votes"."motion_id"))) AND ("ma"."user_id" = "auth"."uid"()))))));



CREATE POLICY "votes_update_own" ON "public"."votes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."end_motion"("motion" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."end_motion"("motion" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."end_motion"("motion" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_chair"("meeting" "uuid", "from_user" "uuid", "to_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_chair"("meeting" "uuid", "from_user" "uuid", "to_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_chair"("meeting" "uuid", "from_user" "uuid", "to_user" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."chats" TO "anon";
GRANT ALL ON TABLE "public"."chats" TO "authenticated";
GRANT ALL ON TABLE "public"."chats" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_attendees" TO "anon";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_history" TO "anon";
GRANT ALL ON TABLE "public"."meeting_history" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_history" TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON TABLE "public"."motion_replies" TO "anon";
GRANT ALL ON TABLE "public"."motion_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."motion_replies" TO "service_role";



GRANT ALL ON TABLE "public"."motions" TO "anon";
GRANT ALL ON TABLE "public"."motions" TO "authenticated";
GRANT ALL ON TABLE "public"."motions" TO "service_role";



GRANT ALL ON TABLE "public"."votes" TO "anon";
GRANT ALL ON TABLE "public"."votes" TO "authenticated";
GRANT ALL ON TABLE "public"."votes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































