
  create policy "history_delete_motion"
  on "public"."meeting_history"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.meetings
  WHERE ((meetings.id = meeting_history.meeting_id) AND (meetings.owner = auth.uid())))));



