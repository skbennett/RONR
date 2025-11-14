// /pages/Meetings.jsx
import React, { useState, useEffect } from 'react';
import {
  getUserMeetings,
  createMeeting,
  acceptInvite,
  leaveMeeting
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
    } catch (e) {
      console.error(e);
      alert('Failed to accept invite.');
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