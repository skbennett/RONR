import React, { useState } from 'react';
import { transferChair, getMeetingAttendees } from '../../services/supabaseDataManager';

function OwnershipTransferButton({ meeting, user, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [attendees, setAttendees] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState(null);

  const openPanel = async () => {
    setError(null);
    setOpen(true);
    setLoading(true);
    try {
      const { data, error } = await getMeetingAttendees(meeting.id);
      if (error) {
        console.error('getMeetingAttendees error', error);
        setAttendees([]);
        setError(error.message || 'Failed to load attendees');
      } else {
        // keep the list but do not display UUIDs in the UI
        setAttendees(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch attendees', e);
      setAttendees([]);
      setError('Failed to load attendees');
    } finally {
      setLoading(false);
    }
  };

  const doTransfer = async () => {
    if (!window.confirm('Confirm transfer of ownership to the selected user?')) return;
    if (!attendees || selectedIndex < 0 || !attendees[selectedIndex]) return alert('Select a user to transfer ownership to.');
    const toUserId = attendees[selectedIndex].user_id;
    setLoading(true);
    try {
      const { data, error } = await transferChair(meeting.id, user.id, toUserId);
      if (error) {
        console.error('transferChair error', error);
        alert('Ownership transfer failed: ' + (error.message || JSON.stringify(error)));
      } else {
        alert('Ownership transferred.');
        setOpen(false);
        setSelectedIndex(-1);
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      console.error('transfer exception', e);
      alert('Ownership transfer failed: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ownership-transfer">
      <button className="secondary-btn small" onClick={() => { if (!open) openPanel(); else setOpen(false); }} disabled={loading}>
        {loading ? 'Loading...' : (open ? 'Cancel' : 'Transfer Ownership')}
      </button>

      {open && (
        <div className="transfer-panel">
          {error && <div className="error">{error}</div>}
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 12 }}>Select new owner</label>
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              style={{ display: 'block', marginTop: 6 }}
            >
              <option value={-1} disabled>Select a user...</option>
              {(attendees || []).map((a, idx) => (
                <option key={idx} value={idx}>{a.username || a.email ? `${a.username || a.email}` : `User ${idx + 1}`} {a.role ? ` — ${a.role}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="primary-btn small" onClick={doTransfer} disabled={loading || selectedIndex < 0}>
              {loading ? 'Transferring...' : 'Confirm Transfer'}
            </button>
            <button className="secondary-btn small" onClick={() => { setOpen(false); setSelectedIndex(-1); }} style={{ marginLeft: 8 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnershipTransferButton;
