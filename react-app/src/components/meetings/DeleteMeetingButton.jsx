import React, { useState } from 'react';
import { deleteMeeting, exportMeetingMinutes } from '../../services/supabaseDataManager';

function DeleteMeetingButton({ meeting, onDeleted }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const ok = window.confirm('End this meeting and DELETE ALL associated data? This action is irreversible. Are you sure?\n\nClick OK to first download meeting minutes as a text file, then the meeting will be deleted.');
    if (!ok) return;
    setLoading(true);
    try {
      // 1) export minutes
      const { data: history, error: histErr } = await exportMeetingMinutes(meeting.id);
      if (histErr) {
        console.error('exportMeetingMinutes error', histErr);
        alert('Failed to export minutes: ' + (histErr.message || JSON.stringify(histErr)));
        setLoading(false);
        return;
      }

      // build text content; replace any user UUIDs with attendee emails when possible
      let lines = [];
      lines.push(`Minutes for meeting: ${meeting.title || meeting.id}`);
      lines.push('');

      // exportMeetingMinutes now returns { history, attendees }
      const attendeesList = (history && history.attendees) ? history.attendees : [];
      const historyRows = (history && history.history) ? history.history : history;

      // build map user_id -> email
      const userEmailById = {};
      (attendeesList || []).forEach(a => {
        if (a && a.user_id) userEmailById[a.user_id] = a.email || null;
      });

      if (!historyRows || historyRows.length === 0) {
        lines.push('No history records found.');
      } else {
        const replaceIds = (obj) => {
          if (obj === null || obj === undefined) return obj;
          if (Array.isArray(obj)) return obj.map(replaceIds);
          if (typeof obj === 'object') {
            const out = {};
            for (const k of Object.keys(obj)) {
              out[k] = replaceIds(obj[k]);
            }
            return out;
          }
          // primitive
          if (typeof obj === 'string' && userEmailById[obj]) return userEmailById[obj];
          return obj;
        };

        historyRows.forEach(h => {
          const ts = new Date(h.created_at).toLocaleString();
          let ev = h.event;
          if (typeof ev === 'string') {
            try { ev = JSON.parse(ev); } catch (e) { /* leave as string */ }
          }
          const evSafe = (typeof ev === 'object' && ev !== null) ? replaceIds(ev) : ev;
          let evStr;
          try { evStr = typeof evSafe === 'object' ? JSON.stringify(evSafe) : String(evSafe); } catch (e) { evStr = String(evSafe); }
          lines.push(`${ts} — ${h.event_type} — ${evStr}`);
        });
      }

      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(meeting.title || 'meeting')}_minutes.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // 2) delete meeting (select deleted rows back so we can confirm)
      const { data, error } = await deleteMeeting(meeting.id);
      if (error) {
        console.error('deleteMeeting error', error);
        alert('Failed to delete meeting: ' + (error.message || JSON.stringify(error)));
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        // no deleted rows returned — likely an authorization or policy block
        console.error('deleteMeeting did not return deleted rows', data);
        alert('Failed to delete meeting: no rows were deleted. You may not have permission.');
      } else {
        alert('Meeting deleted.');
        if (onDeleted) onDeleted();
      }
    } catch (e) {
      console.error('delete exception', e);
      alert('Failed to delete meeting: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="danger-btn small end-meeting-btn"
      onClick={handleDelete}
      disabled={loading}
      title="End this meeting and remove all its data"
      style={{
        backgroundColor: '#c0392b',
        color: '#fff',
        border: 'none',
        padding: '6px 10px',
        borderRadius: 6,
        cursor: loading ? 'default' : 'pointer'
      }}
    >
      {loading ? 'Ending...' : 'End Meeting'}
    </button>
  );
}

export default DeleteMeetingButton;
