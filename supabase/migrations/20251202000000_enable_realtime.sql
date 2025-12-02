-- Enable Realtime for tables required for live updates
-- This publication allows Supabase Realtime to broadcast changes to these tables

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."chats";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."votes";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."motions";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."meeting_history";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."meetings";
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."meeting_attendees";

-- Set REPLICA IDENTITY to FULL for tables where we need the full row data
-- This is required for Realtime to send complete payloads on UPDATE operations
ALTER TABLE "public"."chats" REPLICA IDENTITY FULL;
ALTER TABLE "public"."votes" REPLICA IDENTITY FULL;
ALTER TABLE "public"."motions" REPLICA IDENTITY FULL;
ALTER TABLE "public"."meeting_history" REPLICA IDENTITY FULL;
ALTER TABLE "public"."meetings" REPLICA IDENTITY FULL;
ALTER TABLE "public"."meeting_attendees" REPLICA IDENTITY FULL;
