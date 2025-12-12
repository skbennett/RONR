# CourtOrder
Web Development Robert's Rules of Order Project  

By: Jason, Keegan, and Shane

Access at: [https://ronr.vercel.app/](https://ronr.vercel.app/)

Video Link: [youtube.com](youtube.com)
# Website Features
## Homepage
![Homepage](/readme_images/Homepage.PNG)
   
Our homepage showcases what our website is, and it has links to our other pages that allow a user to use the website.

## Login
![Signin](/readme_images/signin.PNG) ![Signup](/readme_images/signup.PNG)
   
Our website allows users to make accounts and sign in with them. We used Supabase Auth for this which simplifies login on our end and is more secure. We require usernames and emails to be unique, so both can be used to identify an individual user.

## Meetings Page
![Meetings1](/readme_images/meetings1.PNG) 
   
Any user can create a meeting or get invited to another user's meeting.

![Meetings2](/readme_images/meetings2.PNG)

The owner of a meeting can invite, remove, or transfer ownership of a meeting to another user. The owner can also end the meeting which will download a copy of the meeting minutes for them.

## Coordination
Once in a meeting, the user can interact with others in the meeting.  
 
![ChooseMeeting](/readme_images/coordination_meeting.PNG)
   
Users can choose which meeting they want to interact with, so they can have multiple active meetings.  
 
![motions](/readme_images/motion.PNG)
   
Motions are the heart of every meeting. Any user can create a motion or a submotion to another motion. They can also comment on any motion as long as it is not a special motion. The chair or creator of a motion is able to edit. THe chair also has the power to call motions to vote or postpone motions in accordance with their meeting rules. Submotions automatically postpone a motion until the submotion is voted on.  
 
![chat](/readme_images/Chat.PNG)
   
There is also a general meeting chat at the below the motions that allow users to discuss any matters related to the meeting. This is not tied to any motion in particular.

![history](/readme_images/history.PNG)
   
The history of all active and finished motions is stored at the bottom of the page. It allows users to see all motions and who voted for or against them as well as all discussion for the motion.

# Database
For our database we used supabase because the data for this website is naturally very structured, so SQL was a good choice for this. This also covered our need for user authentication with the same backend.

## Meetings Table
![meetings](/readme_images/database/db_meetings.PNG)
   
The meetings table is our main table because it keeps track of all of our meetings. Each meeting has a title, status, coordination time(when meeting actually starts), owner, created time, and updated time. Each meeting also has a unique id which is used to identify other parts of the meeting in different tables. It also has policies that only allow a owner to delete, update, allow invited members to see the meeting, and only allows users with accounts to our website to make meetings for security purposes.

## Invitations Table
![invites](/readme_images/database/db_invitations.PNG)
   
The inviations table keeps track of all outstanding invitations. It keeps track of which meeting it is for by using the meeting's unique id. It also keeps track of the inviter and invitee by using their unique ids. It has a status attribute that would allow us to make invitations expire later, but we did not implement this as well as a timestamp when the meeting would expire. It keeps track of the meeting's name and the inviter's name as well to make displaying the information on the website easier. Its policies are: only an invitee can delete their invite by accepting or declining it, only the chair of a meeting is able to create an invite, all users are able to see rows related to their profile, and and only certified users can create invitations. Once a user accepts an invitation, their invite is deleted and they are added to the next table.

## Meeting Attendees Table
![attendees](/readme_images/database/db_attendees.PNG)
   
This table keeps track of the meeting attendees. Each entry consists of the meeting by its unique id, the user by their unique id, their role, and timestamps for when they were invited and when they joined. Its policies are: only a meeting owner or the user can delete a user's membership, attendees can insert themselves into a meeting by accepting their invite, attendees can only see their rows in the table, and owners of a meeting can update the roles of other members in that meeting to transfer ownership.

## Motions Table
![motions](/readme_images/database/db_motions.PNG)
   
The motions table keeps track of all of the current motions in all meetings. Like every other table pertaining to meeting information, the meetings id is used to tie a motion to a specific meeting. Each motion also has a title, a description if the user included one, the proposer's id, timestamps for creation and updating, and a boolean for if it is a special motion. Each motion has a status which shows if it is open, postponed, passed, failed, or tied. We made it so that there is no distinction between a motion and a submotion, and instead there is a column called parent which identifies if a motion belongs to another motion. This made managing submotions easier for us. Policies are: only members of a meeting can add a motion for it, only members can see a motion for a meeting, the proposer or chair are the only person who is able to update or delete a motion, and only the chair can update the status of a motion to close, postpone, or end it.

## Motion Replies Table
![motionreplies](/readme_images/database/db_motion_replies.PNG)
This table is very simple. It has the id of the motion, the author's id, the ext of the motion, its stance, and a timestamp. We added a column for a parent reply's id to add directly replying to another reply, but we did not implement this. The policies are: only the creator of a reply or the chair can delete or update the message, only members of the meeting can add replies or see them.

## Votes Table
![votes](/readme_images/database/db_votes.PNG)
   
This one is simple as well. It has the motion's id, the user's id, their vote, and a timestamp. The policies are: only the voter can add their vote, delete their vote, update their vote, or see the other votes for the meeting. This is to stop tampering with the votes.

## Meeting History Table
![history](/readme_images/database/db_meeting_history.PNG)
   
Each time an event happens in a meeting, it is stored here to output as minutes later. It stores the meetings id, the event type, the event's location in the other tables of the database, and the timestamp for the event. Its policies are: only attendees to a meeting are able to insert or see events, and the data will only be deleted when the owner of the meeting closes the meeting.

## Chats Table
![chats](/readme_images/database/db_chats.PNG)
   
Chats are stored by the meeting id, the user's id, the message text, and a timestamp. The policies are: the chair can delete chats, users can insert chats if they are the member of a meeting, and only members of a meeting can see the chats for that meeting.

## Profiles Table
![profiles](/readme_images/database/db_profiles.PNG)

This is the simplest table. It ties the user's chosen name to their unique id. They are able to update this name to display on the site, but their id is always attached to their email which cannot change. The rules are: this table can be viewed by any user, only user's can make their own profile, and only users can change their profile.