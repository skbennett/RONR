// /pages/Meetings.jsx
import React, { useState, useEffect } from 'react';
import {
  getUserMeetings,
  createMeeting,
  acceptInvite,
  leaveMeeting,
  inviteUser,
  inviteUserByEmail,
  inviteUserByUsername,
  getMyInvitations,
  declineInvite,
  getMeetingAttendees,
  removeMeetingAttendee
  ,subscribeToMyAttendees
} from '../services/supabaseDataManager';
import { useAuth } from '../contexts/AuthContext';
import AddMeetingForm from '../components/meetings/AddMeetingForm';
import InvitationsList from '../components/meetings/InvitationsList';
import InviteForm from '../components/meetings/InviteForm';
import MeetingCard from '../components/meetings/MeetingCard';
import { formatDate, formatTime } from '../utils/meetingUtils';

// --- The Main Meetings Page Component ---
function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [attendeesByMeeting, setAttendeesByMeeting] = useState({});
  const [attendeesLoading, setAttendeesLoading] = useState({});
  const [attendeesError, setAttendeesError] = useState({});

  const { user } = useAuth();

  const loadMeetings = async () => {
    setIsLoading(true);
    const { data, error } = await getUserMeetings();
    if (error) {
      console.error('Failed to load meetings', error);
      setMeetings([]);
    } else {
      // try to sort by coordination.date/time or created_at
      const sorted = (data || []).slice().sort((a, b) => {
        const aDate = a.coordination?.date || a.created_at;
        const bDate = b.coordination?.date || b.created_at;
        return new Date(aDate) - new Date(bDate);
      });
      setMeetings(sorted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMeetings();
    // load pending invitations for this user
    (async () => {
      if (!user) return setPendingInvites([]);
      try {
        const { data } = await getMyInvitations();
        setPendingInvites(data || []);
      } catch (e) {
        console.error('Failed to load invitations', e);
        setPendingInvites([]);
      }
    })();
  }, [user]);

  // Subscribe to changes on this user's attendee rows so meetings list updates in near real-time
  useEffect(() => {
    if (!user || !user.id) return undefined;
    const ch = subscribeToMyAttendees(user.id, async () => {
      try {
        await loadMeetings();
        const { data } = await getMyInvitations();
        setPendingInvites(data || []);
      } catch (e) {
        console.error('Realtime attendee subscription handler error', e);
      }
    });

    return () => {
      try {
        if (ch && typeof ch.unsubscribe === 'function') ch.unsubscribe();
      } catch (e) { /* ignore */ }
    };
  }, [user && user.id]);

  const handleAddMeeting = async (event) => {
    event.preventDefault();
    if (!newTitle) {
      alert('Please provide a meeting title.');
      return;
    }
    if (!user) {
      setErrorMsg('You must be signed in to create a meeting.');
      alert('Sign in to create a meeting.');
      return;
    }
    console.log('handleAddMeeting: creating meeting', { title: newTitle, date: newDate, time: newTime });
    try {
      const coord = { date: newDate || null, time: newTime || null };
      const result = await createMeeting({ title: newTitle, description: '', status: 'scheduled', coordination: coord });
      // handle both RPC-style errors and thrown exceptions
      if (result && result.error) {
        console.error('createMeeting error', result.error);
        setErrorMsg(result.error.message || 'Failed to create meeting');
        alert(result.error.message || 'Failed to create meeting');
        return;
      }
      setErrorMsg(null);
      setNewTitle('');
      setNewDate('');
      setNewTime('');
      await loadMeetings();
    } catch (e) {
      console.error('handleAddMeeting exception', e);
      const msg = (e && e.message) ? e.message : 'Failed to create meeting.';
      setErrorMsg(msg);
      alert(msg);
    }
  };

  const handleAcceptInvite = async (meetingId) => {
    try {
      await acceptInvite(meetingId);
      await loadMeetings();
      // refresh invites
      const { data } = await getMyInvitations();
      setPendingInvites(data || []);
    } catch (e) {
      console.error(e);
      alert('Failed to accept invite.');
    }
  };

  const handleDeclineInvite = async (meetingId) => {
    if (!window.confirm('Decline this invitation?')) return;
    try {
      await declineInvite(meetingId);
      const { data } = await getMyInvitations();
      setPendingInvites(data || []);
      await loadMeetings();
    } catch (e) {
      console.error(e);
      alert('Failed to decline invite.');
    }
  };

  const handleSendInviteByEmail = async (e) => {
    e.preventDefault();
    if (!inviteIdentifier) return alert('Enter the invitee username, email, or user ID (UUID).');
    if (!selectedMeetingId) return alert('Select a meeting to invite the user to.');
    setInviteLoading(true);
    try {
      let inviteResult;
      
      // If the identifier looks like an email, call the backend RPC that accepts email
      if (inviteIdentifier.includes('@')) {
        inviteResult = await inviteUserByEmail(selectedMeetingId, inviteIdentifier);
      } 
      // If it looks like a UUID (has dashes), call inviteUser directly
      else if (inviteIdentifier.includes('-') && inviteIdentifier.length === 36) {
        inviteResult = await inviteUser(selectedMeetingId, inviteIdentifier);
      }
      // Otherwise assume it's a username
      else {
        inviteResult = await inviteUserByUsername(selectedMeetingId, inviteIdentifier);
      }
      
      const { data, error } = inviteResult;
      if (error) {
        console.error('Invite error', error);
        alert('Failed to send invite: ' + (error.message || JSON.stringify(error)));
      } else {
        alert('Invite created');
        setInviteIdentifier('');
        const invites = await getMyInvitations();
        setPendingInvites(invites.data || []);
        await loadMeetings();
      }
    } catch (err) {
      console.error('Invite error', err);
      alert('Failed to send invite: ' + (err.message || err));
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleShowAttendees = async (meetingId, show) => {
    // show: true => fetch and display, false => hide
    if (!show) {
      setAttendeesByMeeting(prev => ({ ...prev, [meetingId]: null }));
      return;
    }
    // if already loaded, just toggle on
    if (attendeesByMeeting[meetingId]) return;
    setAttendeesLoading(prev => ({ ...prev, [meetingId]: true }));
    try {
      const { data, error } = await getMeetingAttendees(meetingId);
      if (error) {
        console.error('getMeetingAttendees error', error);
        setAttendeesError(prev => ({ ...prev, [meetingId]: error.message || JSON.stringify(error) }));
        setAttendeesByMeeting(prev => ({ ...prev, [meetingId]: [] }));
      } else {
        setAttendeesError(prev => ({ ...prev, [meetingId]: null }));
        setAttendeesByMeeting(prev => ({ ...prev, [meetingId]: data || [] }));
      }
    } catch (e) {
      console.error('Failed to load attendees', e);
      setAttendeesError(prev => ({ ...prev, [meetingId]: e.message || String(e) }));
      setAttendeesByMeeting(prev => ({ ...prev, [meetingId]: [] }));
    } finally {
      setAttendeesLoading(prev => ({ ...prev, [meetingId]: false }));
    }
  };

  const handleRemoveAttendee = async (meetingId, attendeeId) => {
    if (!window.confirm('Remove this attendee from the meeting?')) return;
    try {
      const { error } = await removeMeetingAttendee(meetingId, attendeeId);
      if (error) {
        console.error('removeMeetingAttendee error', error);
        alert('Failed to remove attendee: ' + (error.message || JSON.stringify(error)));
      } else {
        // clear cached attendees then refresh attendee list for this meeting
        setAttendeesByMeeting(prev => ({ ...prev, [meetingId]: null }));
        await toggleShowAttendees(meetingId, true);
        // also refresh meetings so roles/counts update
        await loadMeetings();
      }
    } catch (e) {
      console.error('Error removing attendee', e);
      alert('Failed to remove attendee: ' + (e.message || e));
    }
  };

  const handleLeave = async (meetingId) => {
    if (!window.confirm('Leave this meeting?')) return;
    const { error } = await leaveMeeting(meetingId);
    if (error) {
      console.error(error);
      alert('Failed to leave meeting');
    } else {
      await loadMeetings();
    }
  };

  if (isLoading) {
    return <div>Loading meetings...</div>;
  }
  return (
    <div className="meetings-page-container">
      <AddMeetingForm
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newDate={newDate}
        setNewDate={setNewDate}
        newTime={newTime}
        setNewTime={setNewTime}
        handleAddMeeting={handleAddMeeting}
        errorMsg={errorMsg}
      />

      <InvitationsList
        pendingInvites={pendingInvites}
        meetings={meetings}
        handleAcceptInvite={handleAcceptInvite}
        handleDeclineInvite={handleDeclineInvite}
      />

      <InviteForm
        selectedMeetingId={selectedMeetingId}
        setSelectedMeetingId={setSelectedMeetingId}
        inviteIdentifier={inviteIdentifier}
        setInviteIdentifier={setInviteIdentifier}
        inviteLoading={inviteLoading}
        handleSendInviteByEmail={handleSendInviteByEmail}
        meetings={meetings}
      />

      <div className="meetings-container">
        {meetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            user={user}
            attendeesByMeeting={attendeesByMeeting}
            attendeesLoading={attendeesLoading}
            attendeesError={attendeesError}
            toggleShowAttendees={toggleShowAttendees}
            handleLeave={handleLeave}
            handleAcceptInvite={handleAcceptInvite}
            handleRemoveAttendee={handleRemoveAttendee}
            refreshMeetings={loadMeetings}
          />
        ))}
      </div>
    </div>
  );
}

export default Meetings;