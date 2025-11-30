// /pages/Meetings.jsx
import React, { useState, useEffect } from 'react';
import {
  getUserMeetings,
  createMeeting,
  acceptInvite,
  leaveMeeting,
  inviteUser,
  inviteUserByEmail,
  getMyInvitations,
  declineInvite
} from '../services/supabaseDataManager';
import { useAuth } from '../contexts/AuthContext';

// --- Helper Functions ---
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const dateObj = new Date(dateStr);
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (timeStr) => {
  if (!timeStr) return 'N/A';
  const [hourStr, minuteStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

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
    if (!inviteIdentifier) return alert('Enter the invitee user id (UUID) or email.');
    if (!selectedMeetingId) return alert('Select a meeting to invite the user to.');
    setInviteLoading(true);
    try {
      // If the identifier looks like an email, call the backend RPC that accepts email
      if (inviteIdentifier.includes('@')) {
        const { data, error } = await inviteUserByEmail(selectedMeetingId, inviteIdentifier);
        if (error) {
          console.error('inviteUserByEmail error', error);
          alert('Failed to send invite by email: ' + (error.message || JSON.stringify(error)));
        } else {
          alert('Invite created');
          setInviteIdentifier('');
          const invites = await getMyInvitations();
          setPendingInvites(invites.data || []);
          await loadMeetings();
        }
      } else {
        // otherwise expect a UUID and call inviteUser
        const { data, error } = await inviteUser(selectedMeetingId, inviteIdentifier);
        if (error) {
          console.error('inviteUser error', error);
          alert('Failed to send invite: ' + (error.message || JSON.stringify(error)));
        } else {
          alert('Invite created');
          setInviteIdentifier('');
          const invites = await getMyInvitations();
          setPendingInvites(invites.data || []);
          await loadMeetings();
        }
      }
    } catch (err) {
      console.error('Invite error', err);
      alert('Failed to send invite: ' + (err.message || err));
    } finally {
      setInviteLoading(false);
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
      <form className="add-meeting-form" onSubmit={handleAddMeeting}>
        <h3>Add a New Meeting</h3>
        {errorMsg && <div style={{ color: 'crimson', marginBottom: 8 }}>{errorMsg}</div>}
        <input type="text" placeholder="Meeting Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        <button type="submit">Add Meeting</button>
      </form>

      {/* Invitations notification */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div style={{ border: '1px solid #ccc', padding: 12, margin: '12px 0', background: '#fffbe6' }}>
          <strong>You have pending meeting invitations</strong>
          <ul>
            {pendingInvites.map(inv => (
              <li key={inv.id} style={{ marginTop: 8 }}>
                Meeting: {inv.meeting_id} — Invited at {new Date(inv.created_at).toLocaleString()}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => handleAcceptInvite(inv.meeting_id)}>Accept</button>
                  <button onClick={() => handleDeclineInvite(inv.meeting_id)} style={{ marginLeft: 8 }}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Simple invite-by-email form (will use server-side lookup) */}
      <form onSubmit={handleSendInviteByEmail} style={{ marginBottom: 16 }}>
        <h4>Invite a user to a meeting</h4>
        <div style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 8 }}>Select meeting:</label>
          <select value={selectedMeetingId || ''} onChange={(e) => setSelectedMeetingId(e.target.value)}>
            <option value="">-- pick meeting --</option>
            {meetings.map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
        <input placeholder="Email or display name" value={inviteIdentifier} onChange={(e) => setInviteIdentifier(e.target.value)} />
        <button type="submit" disabled={inviteLoading}>{inviteLoading ? 'Sending...' : 'Send Invite'}</button>
        <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Enter the invitee's email (preferred) or display name.</div>
      </form>

      <div className="meetings-container">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="meeting-card">
            <div className="meeting-info">
              <div className="meeting-title">{meeting.title}</div>
              <div className="meeting-details">
                Date: {formatDate(meeting.coordination?.date || meeting.created_at)} &nbsp;|&nbsp; Time: {formatTime(meeting.coordination?.time || '')}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>Role: {meeting.my_role || 'unknown'}</div>
            </div>
            <div className="meeting-buttons">
              {meeting.my_role === 'invited' ? (
                <button className="join-btn" onClick={() => handleAcceptInvite(meeting.id)}>Accept Invite</button>
              ) : (
                <button className="join-btn joined" disabled>Member</button>
              )}
              <button className="remove-btn" onClick={() => handleLeave(meeting.id)}>Leave</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Meetings;