# CourtOrder
Web Development Robert's Rules of Order Project  

By: Jason, Keegan, and Shane

Access at: [https://ronr.vercel.app/](https://ronr.vercel.app/)

Video Link: [youtube.com](youtube.com)
# Website Features
## Homepage
![Homepage](/readme_images/Homepage.PNG)
#### Features
Our homepage showcases what our website is, and it has links to our other pages that allow a user to use the website.

## Login
![Signin](/readme_images/signin.PNG) ![Signup](/readme_images/signup.PNG)
#### Features
Our website allows users to make accounts and sign in with them. We used Supabase Auth for this which simplifies login on our end and is more secure. We require usernames and emails to be unique, so both can be used to identify an individual user.

## Meetings Page
![Meetings1](/readme_images/meetings1.PNG) ![Meetings2](/readme_images/meetings2.PNG)
#### Features
Our meetings page allows a user to make a new meeting, join meetings, invite others to meetings, and manage a meeting if they are the owner. The owner of a meeting can invite, remove, or transfer ownership of a meeting to another user. The owner can also end the meeting which will download a copy of the meeting minutes for them.

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
