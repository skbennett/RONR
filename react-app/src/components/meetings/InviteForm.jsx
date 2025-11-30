import React from 'react';

function InviteForm({ selectedMeetingId, setSelectedMeetingId, inviteIdentifier, setInviteIdentifier, inviteLoading, handleSendInviteByEmail, meetings }) {
  return (
    <form className="invite-form" onSubmit={handleSendInviteByEmail}>
      <h4>Invite a user to a meeting</h4>
      <div style={{ marginBottom: 8 }}>
        <label style={{ marginRight: 8 }}>Select meeting:</label>
        <select value={selectedMeetingId || ''} onChange={(e) => setSelectedMeetingId(e.target.value)}>
          <option value="">-- pick meeting --</option>
          {meetings
            .filter(m => m.my_role === 'owner' || m.my_role === 'chair')
            .map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
        </select>
      </div>
      <input placeholder="User Email" value={inviteIdentifier} onChange={(e) => setInviteIdentifier(e.target.value)} />
      <button type="submit" disabled={inviteLoading}>{inviteLoading ? 'Sending...' : 'Send Invite'}</button>
      <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Enter the invitee's email. You can only invite a user if you are the chair/owner of the meeting.</div>
    </form>
  );
}

export default InviteForm;
