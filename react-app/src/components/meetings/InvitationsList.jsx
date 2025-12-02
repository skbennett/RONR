import React from 'react';

function InvitationsList({ pendingInvites, meetings, handleAcceptInvite, handleDeclineInvite }) {
  if (!pendingInvites || pendingInvites.length === 0) return null;

  return (
    <div className="invite-notification">
      <strong>You have pending meeting invitations</strong>
      <ul>
        {pendingInvites.map(inv => {
          const meetingObj = meetings.find(m => m.id === inv.meeting_id);
          const meetingTitle = inv.meeting_title || (meetingObj ? meetingObj.title : null) || 'Unknown meeting';
          return (
            <li key={inv.id} className="invite-item">
              <div className="invite-item-left">
                <div>Meeting: <span className="invite-meeting-title">{meetingTitle}</span></div>
                <div className="invite-meta">Invited at {new Date(inv.created_at).toLocaleString()}</div>
              <div className="invite-meta">Invited by: {inv.inviter_username || inv.inviter_email || 'Unknown'}</div>
              </div>
              <div className="invite-actions">
                <button className="primary-btn" onClick={() => handleAcceptInvite(inv.meeting_id)}>Accept</button>
                <button className="secondary-btn" onClick={() => handleDeclineInvite(inv.meeting_id)} style={{ marginLeft: 8 }}>Decline</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default InvitationsList;
