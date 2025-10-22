// /pages/Meetings.jsx
import React, { useState, useEffect } from 'react';
import { getAllMeetings, addMeeting, updateMeeting, deleteMeeting } from '../services/dataManager';

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

  const loadMeetings = () => {
    const allMeetings = getAllMeetings();
    const sorted = [...allMeetings].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    setMeetings(sorted);
  };

  useEffect(() => {
    loadMeetings();
    setIsLoading(false);
  }, []);

  const handleAddMeeting = (event) => {
    event.preventDefault();
    if (!newTitle || !newDate || !newTime) {
      alert("Please fill out all fields.");
      return;
    }
    addMeeting({ title: newTitle, date: newDate, time: newTime });
    loadMeetings(); // Reload from storage
    setNewTitle('');
    setNewDate('');
    setNewTime('');
  };

  const handleToggleJoin = (meetingId, currentStatus) => {
    updateMeeting(meetingId, { joined: !currentStatus });
    loadMeetings(); // Reload from storage
  };

  const handleRemoveMeeting = (meetingId, meetingTitle) => {
    deleteMeeting(meetingId);
    loadMeetings(); // Reload from storage
  };

  if (isLoading) {
    return <div>Loading meetings...</div>;
  }

  return (
    <div className="meetings-page-container">
      <form className="add-meeting-form" onSubmit={handleAddMeeting}>
        <h3>Add a New Meeting</h3>
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
                Date: {formatDate(meeting.date)} &nbsp;|&nbsp; Time: {formatTime(meeting.time)}
              </div>
            </div>
            <div className="meeting-buttons">
              <button
                className={`join-btn ${meeting.joined ? "joined" : ""}`}
                onClick={() => handleToggleJoin(meeting.id, meeting.joined)}
              >
                {meeting.joined ? "Joined" : "Join"}
              </button>
              <button className="remove-btn" onClick={() => handleRemoveMeeting(meeting.id, meeting.title)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Meetings;