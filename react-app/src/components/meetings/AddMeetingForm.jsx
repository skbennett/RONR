import React from 'react';

function AddMeetingForm({ newTitle, setNewTitle, newDate, setNewDate, newTime, setNewTime, handleAddMeeting, errorMsg }) {
  return (
    <form className="add-meeting-form" onSubmit={handleAddMeeting}>
      <h3>Add a New Meeting</h3>
      {errorMsg && <div style={{ color: 'crimson', marginBottom: 8 }}>{errorMsg}</div>}
      <input type="text" placeholder="Meeting Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
      <button type="submit">Add Meeting</button>
    </form>
  );
}

export default AddMeetingForm;
