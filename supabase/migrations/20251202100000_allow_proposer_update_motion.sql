-- Add policy to allow motion proposer to update their own motion (title, description, special)
-- This allows proposers and chairs to edit motion details

-- First, check if the policy already exists and drop it if so
DO $$
BEGIN
  DROP POLICY IF EXISTS "motions_update_details_by_proposer_or_chair" ON "public"."motions";
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create new policy allowing proposer to update their motion OR chair/owner to update anything
CREATE POLICY "motions_update_details_by_proposer_or_chair" ON "public"."motions" FOR UPDATE USING (
  -- Allow if user is the proposer
  ("auth"."uid"() = "proposer")
  OR 
  -- Allow if user is the owner of the meeting
  (EXISTS (
    SELECT 1 FROM "public"."meetings" "m"
    WHERE ("m"."id" = "motions"."meeting_id" AND "m"."owner" = "auth"."uid"())
  ))
  OR 
  -- Allow if user is a chair of the meeting
  (EXISTS (
    SELECT 1 FROM "public"."meeting_attendees" "ma"
    WHERE ("ma"."meeting_id" = "motions"."meeting_id" AND "ma"."user_id" = "auth"."uid"() AND "ma"."role" = 'chair'::"public"."meeting_role")
  ))
) WITH CHECK (
  -- For proposers, only allow updating non-status fields (enforced at app level)
  -- For chair/owner, allow all updates
  ("auth"."uid"() = "proposer")
  OR 
  (EXISTS (
    SELECT 1 FROM "public"."meetings" "m"
    WHERE ("m"."id" = "motions"."meeting_id" AND "m"."owner" = "auth"."uid"())
  ))
  OR 
  (EXISTS (
    SELECT 1 FROM "public"."meeting_attendees" "ma"
    WHERE ("ma"."meeting_id" = "motions"."meeting_id" AND "ma"."user_id" = "auth"."uid"() AND "ma"."role" = 'chair'::"public"."meeting_role")
  ))
);
