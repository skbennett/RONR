import React from 'react';

function MeetingSelector({ meetings = [], selectedMeetingId = null, onSelectMeeting }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Select Meeting:</label>
      <select
        value={selectedMeetingId || ''}
        onChange={(e) => onSelectMeeting && onSelectMeeting(e.target.value || null)}
        style={{ padding: '6px 8px', fontSize: 14 }}
      >
        <option value="">-- Select a meeting --</option>
        {(meetings || []).map(m => (
          <option key={m.id} value={m.id}>{m.title || m.name || `Meeting ${m.id}`}</option>
        ))}
      </select>
    </div>
  );
}

export default MeetingSelector;
