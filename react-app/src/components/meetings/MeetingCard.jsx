import React from 'react';
import { formatDate, formatTime } from '../../utils/meetingUtils';
import OwnershipTransferButton from './OwnershipTransferButton';

function MeetingCard({ meeting, user, attendeesByMeeting, attendeesLoading, attendeesError, toggleShowAttendees, handleLeave, handleAcceptInvite, handleRemoveAttendee, refreshMeetings }) {
  return (
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
        ) : meeting.my_role === 'owner' ? (
          <button className="join-btn owner" disabled>Owner</button>
        ) : meeting.my_role === 'chair' ? (
          <button className="join-btn chair" disabled>Chair</button>
        ) : (
          <button className="join-btn joined" disabled>Member</button>
        )}
        <button className="remove-btn" onClick={() => handleLeave(meeting)} disabled={meeting.my_role === 'owner'}>
          Leave
        </button>
        {meeting.my_role === 'owner' && (
          <OwnershipTransferButton meeting={meeting} user={user} onSuccess={() => { if (refreshMeetings) refreshMeetings(); }} />
        )}
      </div>

      {(meeting.my_role === 'owner' || meeting.my_role === 'chair') && (
        <div className="attendees-section">
          <button
            className="secondary-btn"
            onClick={async () => {
              const currentlyLoaded = attendeesByMeeting[meeting.id];
              if (currentlyLoaded) {
                // hide
                // parent manages state
                await toggleShowAttendees(meeting.id, false);
              } else {
                await toggleShowAttendees(meeting.id, true);
              }
            }}
          >
            {attendeesByMeeting[meeting.id] ? 'Hide Attendees' : (attendeesLoading[meeting.id] ? 'Loading...' : 'Show Attendees')}
          </button>
          {attendeesByMeeting[meeting.id] && (
            <div className="attendees-box">
              <strong>Attendees</strong>
              {attendeesError[meeting.id] ? (
                <div className="attendees-error">{attendeesError[meeting.id]}</div>
              ) : (
                <ul className="attendees-list">
                  {attendeesByMeeting[meeting.id].length === 0 && <li className="no-attendees">No attendees found.</li>}
                  {attendeesByMeeting[meeting.id].map(a => (
                    <li key={a.user_id} className="attendee-row">
                      <span className="attendee-label">{a.email || a.user_id}</span>
                      {a.role && (
                        <span className={`role-badge ${a.role}`}>{a.role.charAt(0).toUpperCase() + a.role.slice(1)}</span>
                      )}
                      {(meeting.my_role === 'owner' || meeting.my_role === 'chair') && a.user_id !== user?.id && (
                        <button
                          className="remove-btn small"
                          onClick={() => handleRemoveAttendee(meeting.id, a.user_id)}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MeetingCard;
