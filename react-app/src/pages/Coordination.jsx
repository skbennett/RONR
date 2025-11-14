// /pages/Coordination.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserMeetings,
  fetchMeetingData,
  proposeMotion,
  vote,
  sendChat,
  subscribeToMeeting,
  downloadMinutes
} from '../services/supabaseDataManager';
import {
  getCoordinationData,
  updateCoordinationData
} from '../services/dataManager';
import {
  proposeSubMotion,
  addReply,
  updateReply,
  deleteReply,
  updateMotion,
  postponeMotion,
  resumeMotion,
  endMotion,
  undoVote
} from '../services/supabaseDataManager';
import './coordination.css';

// --- Helper Components (for better organization) ---

// Component for a single active motion card
const MotionCard = ({ motion, onVote, onUndoVote, isUndoAllowed }) => {
  const { user } = useAuth();
  const currentUser = user || 'guest';
  const scheduledToArchiveRef = useRef(new Set());
  // dataManager stores per-user votes in `userVotes` (not votesByUser)
  const userVote = motion.userVotes ? motion.userVotes[currentUser] : undefined;
  const hasVoted = Boolean(userVote);
  // defensive defaults: ensure votes object exists so rendering can't blow up
  const votes = motion.votes || { for: 0, against: 0, abstain: 0 };
  const canUndo = isUndoAllowed ? isUndoAllowed(motion, currentUser) : hasVoted;
  return (
    <div className="motion-card">
      <div className="motion-header">
        <div className="motion-header-left">
          <div className="motion-title">{motion.title}</div>
        </div>
        <div className="motion-actions">
          {motion.special && (
            <div className="special-badge header-badge">Special Motion</div>
          )}
          <div className={`motion-status ${motion.status}`}>{motion.status}</div>
        </div>
      </div>
      {motion.description && <div className="motion-description">{motion.description}</div>}
      <div className="motion-meta">
        Proposed by: {motion.createdBy} | {new Date(motion.createdAt).toLocaleString()}
      </div>
      {(motion.status === 'voting' || motion.status === 'open') && (
        <div className="voting-section">
          <div className="vote-counts">
            <div className="vote-count"><span>For:</span><span className="count">{votes.for}</span></div>
            <div className="vote-count"><span>Against:</span><span className="count">{votes.against}</span></div>
            <div className="vote-count"><span>Abstain:</span><span className="count">{votes.abstain}</span></div>
          </div>
          <div className="vote-buttons">
            <button className={`vote-btn for${userVote === 'for' ? ' joined' : ''}`} onClick={() => onVote(motion.id, 'for')}>Vote For</button>
            <button className={`vote-btn against${userVote === 'against' ? ' joined' : ''}`} onClick={() => onVote(motion.id, 'against')}>Vote Against</button>
            <button className={`vote-btn abstain${userVote === 'abstain' ? ' joined' : ''}`} onClick={() => onVote(motion.id, 'abstain')}>Abstain</button>
          </div>
        </div>
      )}
      {motion.status === 'completed' && (
        <div className="completed-section">
          <div className="vote-counts">
            <div className="vote-count"><span>For:</span><span className="count">{votes.for}</span></div>
            <div className="vote-count"><span>Against:</span><span className="count">{votes.against}</span></div>
            <div className="vote-count"><span>Abstain:</span><span className="count">{votes.abstain}</span></div>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>Motion completed and moved to history.</p>
        </div>
      )}
    </div>
  );
};


// --- The Main Coordination Page Component ---
function Coordination() {
  // --- STATE MANAGEMENT ---
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingsList, setMeetingsList] = useState([]);
  const [activeMotions, setActiveMotions] = useState([]);
  const [votingHistory, setVotingHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [motionTitle, setMotionTitle] = useState('');
  const [motionDescription, setMotionDescription] = useState('');
  const [motionSpecial, setMotionSpecial] = useState(false);
  const { user } = useAuth();
  const currentUser = user || null;
  const newMotionBtnRef = useRef(null);
  const motionTitleRef = useRef(null);
  // No client-side lock timers: votes finalize immediately server-side.
  // Inline sub-motion form state (mapping motionId -> visible)
  const [subFormVisible, setSubFormVisible] = useState({});
  const [subFormValues, setSubFormValues] = useState({});
  // Inline reply form state (mapping motionId -> visible)
  const [replyFormVisible, setReplyFormVisible] = useState({});
  const [replyFormValues, setReplyFormValues] = useState({});
  // Inline reply edit state (mapping replyId -> visible)
  const [replyEditVisible, setReplyEditVisible] = useState({});
  const [replyEditValues, setReplyEditValues] = useState({});
  // Refs for reply textareas so we can focus them when forms open
  const replyTextareaRefs = useRef({});
  const replyEditTextareaRefs = useRef({});
  // Inline edit form for motions
  const [editFormVisible, setEditFormVisible] = useState({});
  const [editFormValues, setEditFormValues] = useState({});
  // History discussion toggles (id -> bool)
  const [historyDiscussionOpen, setHistoryDiscussionOpen] = useState({});

  // History voters toggles (id -> bool)
  const [historyVotersOpen, setHistoryVotersOpen] = useState({});

  const toggleHistoryDiscussion = (id) => {
    setHistoryDiscussionOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleHistoryVoters = (id) => {
    setHistoryVotersOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // --- DATA INITIALIZATION ---
  // Helper: enrich motions with vote counts and default fields
  const enrichMotions = (motions = [], votes = []) => {
    const voteByMotion = {};
    (votes || []).forEach(v => {
      voteByMotion[v.motion_id] = voteByMotion[v.motion_id] || { yes: 0, no: 0, abstain: 0 };
      voteByMotion[v.motion_id][v.choice] = (voteByMotion[v.motion_id][v.choice] || 0) + 1;
    });
    return (motions || []).map(m => ({
      ...m,
      votes: {
        for: voteByMotion[m.id]?.yes || 0,
        against: voteByMotion[m.id]?.no || 0,
        abstain: voteByMotion[m.id]?.abstain || 0
      },
      replies: m.replies || []
    }));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await getUserMeetings();
        if (error) {
          console.error('getUserMeetings error', error);
          setMeetingsList([]);
          return;
        }
        setMeetingsList(data || []);
        if ((data || []).length > 0 && !selectedMeeting) setSelectedMeeting(data[0]);
      } catch (e) {
        console.error('Failed loading meetings', e);
      }
    };
    load();
  }, [user]);

  // when a meeting is selected, fetch meeting data and subscribe to realtime
  useEffect(() => {
    if (!selectedMeeting) return;
    let channel = null;
    const loadMeeting = async () => {
      try {
        const md = await fetchMeetingData(selectedMeeting.id);
        const { meeting, motions, votes, chats, history } = md || {};
        // compute vote counts per motion
        const voteByMotion = {};
        (votes || []).forEach(v => {
          voteByMotion[v.motion_id] = voteByMotion[v.motion_id] || { yes: 0, no: 0, abstain: 0 };
          voteByMotion[v.motion_id][v.choice] = (voteByMotion[v.motion_id][v.choice] || 0) + 1;
        });
        const enriched = enrichMotions(motions, votes);
        setActiveMotions(enriched);
        setVotingHistory((history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      } catch (e) {
        console.error('fetchMeetingData failed', e);
      }
    };
    loadMeeting();
    channel = subscribeToMeeting(selectedMeeting.id, {
      onMeeting: async () => await loadMeeting(),
      onMotions: async () => await loadMeeting(),
      onVotes: async () => await loadMeeting(),
      onChats: async () => await loadMeeting(),
      onAttendees: async () => await loadMeeting()
    });
    return () => { try { channel && channel.unsubscribe(); } catch (e) {} };
  }, [selectedMeeting]);

  // --- Sub-motion helpers & utilities ---
  // Utility: refresh local state from storage
  const refreshFromStorage = () => {
    const data = getCoordinationData();
    setActiveMotions((data?.activeMotions || []).map(m => ({ ...m, votes: m.votes || { for: 0, against: 0, abstain: 0 }, replies: m.replies || [] })));
    setVotingHistory((data?.votingHistory || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
    setCurrentSession(data?.currentSession || null);
  };

  const showSubForm = (id) => setSubFormVisible(prev => ({ ...prev, [id]: true }));
  const cancelSubForm = (id) => {
    setSubFormVisible(prev => ({ ...prev, [id]: false }));
    setSubFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
  };
  const openSubFormWithDefaults = (id) => {
    setSubFormVisible(prev => ({ ...prev, [id]: true }));
    setSubFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), title: (prev[id] && prev[id].title) || '', description: (prev[id] && prev[id].description) || '', special: (prev[id] && typeof prev[id].special !== 'undefined') ? prev[id].special : false } }));
  };
  const handleSubInputChange = (id, field, value) => {
    setSubFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitSubMotion = (parentId) => {
    const vals = subFormValues[parentId] || {};
    if (!vals.title || vals.title.trim() === '') { alert('Please enter a sub-motion title.'); return; }
    (async () => {
      try {
        const { data, error } = await proposeSubMotion(selectedMeeting.id, parentId, vals.title.trim(), (vals.description || '').trim());
        console.log('proposeSubMotion result', { data, error });
        if (error) {
          console.error('proposeSubMotion error', error);
          alert('Failed to add sub-motion: ' + (error.message || JSON.stringify(error)));
          return;
        }
        // postpone the parent motion
        await postponeMotion(parentId);
        setReplyFormVisible(prev => ({ ...prev, [parentId]: false }));
        cancelSubForm(parentId);
        // refresh meeting data
        const md = await fetchMeetingData(selectedMeeting.id);
        const { motions, votes, history } = md || {};
        const voteByMotion = {};
        (votes || []).forEach(v => {
          voteByMotion[v.motion_id] = voteByMotion[v.motion_id] || { yes: 0, no: 0, abstain: 0 };
          voteByMotion[v.motion_id][v.choice] = (voteByMotion[v.motion_id][v.choice] || 0) + 1;
        });
        const enriched = (motions || []).map(m => ({ ...m, votes: { for: voteByMotion[m.id]?.yes || 0, against: voteByMotion[m.id]?.no || 0, abstain: voteByMotion[m.id]?.abstain || 0 }, replies: m.replies || [] }));
        setActiveMotions(enriched);
        setVotingHistory((history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      } catch (e) {
        console.error('Failed to add sub-motion', e);
        alert('Failed to add sub-motion: ' + (e.message || JSON.stringify(e)));
      }
    })();
  };

  // --- Edit helpers ---
  const showEditForm = (id, motion) => {
    // Toggle the edit form for a motion: open with values if closed, close and clear values if open
    setEditFormVisible(prev => ({ ...prev, [id]: !prev[id] }));
    setEditFormValues(prev => {
      const copy = { ...prev };
      if (prev[id]) {
        // currently open -> close: remove stored values
        delete copy[id];
      } else {
        // currently closed -> open: populate defaults from motion
        copy[id] = { title: motion.title || '', description: motion.description || '', special: !!motion.special };
      }
      return copy;
    });
  };
  const cancelEditForm = (id) => {
    setEditFormVisible(prev => ({ ...prev, [id]: false }));
    setEditFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
  };
  const handleEditInputChange = (id, field, value) => {
    setEditFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitEdit = (motionId) => {
    const vals = editFormValues[motionId] || {};
    if (!vals.title || vals.title.trim() === '') { alert('Please enter a title.'); return; }
    (async () => {
      try {
        const { data, error } = await updateMotion(motionId, { title: vals.title.trim(), description: (vals.description || '').trim(), special: !!vals.special });
        if (error) throw error;
        cancelEditForm(motionId);
        const md = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(md.motions, md.votes));
      } catch (e) {
        console.error('Failed to update motion', e);
        alert('Failed to update motion.');
      }
    })();
  };

  // --- Reply helpers ---
  const showReplyForm = (id) => {
    // Toggle reply form: open with defaults if closed, close and clear values if open
    setReplyFormVisible(prev => ({ ...prev, [id]: !prev[id] }));
    setReplyFormValues(prev => {
      const copy = { ...prev };
      if (prev[id]) {
        // was open -> now closing: remove draft
        delete copy[id];
      } else {
        // was closed -> now opening: populate defaults
        copy[id] = { ...(prev[id] || {}), stance: (prev[id] && prev[id].stance) || 'neutral', text: (prev[id] && prev[id].text) || '' };
      }
      // If opening, focus the newly rendered textarea on next tick and move cursor to end
      setTimeout(() => {
        if (!prev[id]) {
          try {
            const el = replyTextareaRefs.current[id];
            if (el) {
              el.focus();
              const len = (el.value || '').length;
              // place caret at end
              el.setSelectionRange(len, len);
            }
          } catch (e) {}
        }
      }, 0);
      return copy;
    });
  };
  const cancelReplyForm = (id) => {
    setReplyFormVisible(prev => ({ ...prev, [id]: false }));
    setReplyFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
    // cleanup ref
    try { delete replyTextareaRefs.current[id]; } catch (e) {}
  };
  const handleReplyInputChange = (id, field, value) => {
    setReplyFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitReply = (motionId) => {
    const vals = replyFormValues[motionId] || {};
    if (!vals.text || vals.text.trim() === '') { alert('Please enter reply text.'); return; }
    // default missing stance to 'neutral' rather than showing a popup
    const stance = vals.stance || 'neutral';
    (async () => {
      try {
        const { data, error } = await addReply(motionId, vals.text.trim(), stance, null);
        if (error) throw error;
        cancelReplyForm(motionId);
        const md = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(md.motions, md.votes));
        setVotingHistory((md.history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      } catch (e) {
        console.error('Failed to add reply', e);
        alert('Failed to add reply.');
      }
    })();
  };

  // --- Reply edit/delete helpers ---
  const showReplyEditForm = (motionId, reply) => {
    setReplyEditVisible(prev => ({ ...prev, [reply.id]: !prev[reply.id] }));
    setReplyEditValues(prev => {
      const copy = { ...prev };
      if (prev[reply.id]) {
        delete copy[reply.id];
      } else {
        copy[reply.id] = { motionId, text: reply.text || '', stance: reply.stance || 'neutral' };
      }
      // Focus edit textarea when opening and move cursor to end of existing text
      setTimeout(() => {
        if (!prev[reply.id]) {
          try {
            const el = replyEditTextareaRefs.current[reply.id];
            if (el) {
              el.focus();
              const len = (el.value || '').length;
              el.setSelectionRange(len, len);
            }
          } catch (e) {}
        }
      }, 0);
      return copy;
    });
  };
  const cancelReplyEdit = (replyId) => {
    setReplyEditVisible(prev => ({ ...prev, [replyId]: false }));
    setReplyEditValues(prev => { const c = { ...prev }; delete c[replyId]; return c; });
    // cleanup ref
    try { delete replyEditTextareaRefs.current[replyId]; } catch (e) {}
  };
  const handleReplyEditChange = (replyId, field, value) => {
    setReplyEditValues(prev => ({ ...prev, [replyId]: { ...(prev[replyId] || {}), [field]: value } }));
  };
  const handleSubmitReplyEdit = (replyId) => {
    const vals = replyEditValues[replyId] || {};
    if (!vals.text || vals.text.trim() === '') { alert('Please enter reply text.'); return; }
    (async () => {
      try {
        const { data, error } = await updateReply(replyId, vals.text.trim(), vals.stance);
        if (error) throw error;
        cancelReplyEdit(replyId);
        const md = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(md.motions, md.votes));
        setVotingHistory((md.history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      } catch (e) {
        console.error('Failed to update reply', e);
        alert('Failed to update reply.');
      }
    })();
  };
  const handleDeleteReply = (motionId, replyId) => {
    if (!window.confirm('Delete this reply? This cannot be undone.')) return;
    (async () => {
      try {
        const { data, error } = await deleteReply(replyId);
        if (error) throw error;
        const md = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(md.motions, md.votes));
        setVotingHistory(md.history || []);
      } catch (e) {
        console.error('Failed to delete reply', e);
        alert('Failed to delete reply.');
      }
    })();
  };

  const handlePostpone = (motionId) => {
    if (!window.confirm('Postpone decision on this motion? It will be moved to a postponed stack.')) return;
    (async () => {
      try {
        const { data, error } = await postponeMotion(motionId);
        if (error) throw error;
        setReplyFormVisible(prev => ({ ...prev, [motionId]: false }));
        const md = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(md.motions, md.votes));
      } catch (e) {
        console.error('Failed to postpone', e);
        alert('Failed to postpone motion.');
      }
    })();
  };

  const handleResumePostponed = () => {
    (async () => {
      try {
        const md = await fetchMeetingData(selectedMeeting.id);
        const postponed = (md.motions || []).filter(m => m.status === 'postponed').sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
        if (!postponed.length) { alert('No postponed motions to resume.'); return; }
        const resumed = postponed[0];
        await resumeMotion(resumed.id);
        const refreshed = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(refreshed.motions, refreshed.votes));
        setReplyFormVisible(prev => ({ ...prev, [resumed.id]: false }));
        alert(`Resumed motion: ${resumed.title}`);
      } catch (e) {
        console.error('Failed resume last postponed', e);
        alert('Failed to resume postponed motion.');
      }
    })();
  };

  const handleResumeSpecific = async (motionId) => {
    try {
      if (selectedMeeting) {
        // Server-backed resume: call RPC to set status/open the motion
        const { data, error } = await resumeMotion(motionId);
        console.log('resumeMotion result', { data, error });
        if (error) {
          console.error('resumeMotion error', error);
          alert('Failed to resume motion: ' + (error.message || JSON.stringify(error)));
          return;
        }
        // Refresh meeting data from server
        const md = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(md.motions, md.votes));
        setReplyFormVisible(prev => ({ ...prev, [motionId]: false }));
        alert('Resumed motion');
      } else {
        // fallback to local dataManager resume for non-server meetings
        const resumed = resumeSpecificPostponedCoordinationMotion(motionId);
        if (resumed) {
          startVotingForMotion(resumed.id);
          setReplyFormVisible(prev => ({ ...prev, [resumed.id]: false }));
          alert(`Resumed motion: ${resumed.title}`);
          refreshFromStorage();
        } else {
          alert('Failed to resume this motion (it may not be postponed).');
        }
      }
    } catch (e) {
      console.error('handleResumeSpecific failed', e);
      alert('Failed to resume motion: ' + (e.message || JSON.stringify(e)));
    }
  };

  const handleEndMotion = async (motionId) => {
    if (!window.confirm('End this motion now and record the outcome based on current votes?')) return;
    try {
      // Call server RPC to finalize the motion (tallies, archives, outcomes)
      const { data, error } = await endMotion(motionId);
      console.log('endMotion rpc result', { data, error });
      if (error) {
        console.error('endMotion error', error);
        alert('Failed to end motion: ' + (error.message || JSON.stringify(error)));
        return;
      }

      // Refresh meeting data from server and update UI
      const md = await fetchMeetingData(selectedMeeting.id);
      setActiveMotions(enrichMotions(md.motions, md.votes));
      setVotingHistory((md.history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));

      // If the ended motion was a submotion, the server may have resumed its parent.
      // After refresh we can optionally notify the user about the outcome.
      if (data && data.outcome) {
        alert(`Motion ended: ${data.outcome}`);
      }
    } catch (e) {
      console.error('Failed to end motion', e);
      alert('Failed to end motion: ' + (e.message || JSON.stringify(e)));
    }
  };

  // --- EVENT HANDLERS ---
  const handleStartSession = () => {
    const sessionName = prompt('Enter session name:', `Session ${new Date().toLocaleDateString()}`);
    if (sessionName) {
      const newSession = { id: Date.now(), name: sessionName, startTime: new Date().toISOString() };
      setCurrentSession(newSession);
      updateCoordinationData({ currentSession: newSession });
    }
  };

  // Toggle the 'Propose a New Motion' form and manage keyboard focus (tab in/out)
  const handleToggleNewMotion = () => {
    if (isFormVisible) {
      setIsFormVisible(false);
      // return focus to the New Motion button
      setTimeout(() => newMotionBtnRef.current?.focus(), 0);
    } else {
      setMotionTitle('');
      setMotionDescription('');
      setMotionSpecial(false);
      setIsFormVisible(true);
      // focus the title input after the form is visible
      setTimeout(() => motionTitleRef.current?.focus(), 0);
    }
  };

  const handleEndSession = async () => {
    if (!window.confirm('Are you sure you want to end the current session? Active motions will be archived.')) return;
    try {
      // If a server-backed meeting is selected, call the RPC for each active motion
      if (selectedMeeting) {
        const md = await fetchMeetingData(selectedMeeting.id);
        const ids = (md.motions || []).map(m => m.id);
        for (const id of ids) {
          try {
            const { data, error } = await endMotion(id);
            if (error) console.error('endMotion error for', id, error);
            else console.log('endMotion result for', id, data);
          } catch (e) {
            console.error('Error ending motion', id, e);
          }
        }
        const refreshed = await fetchMeetingData(selectedMeeting.id);
        setActiveMotions(enrichMotions(refreshed.motions, refreshed.votes));
        setVotingHistory((refreshed.history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      } else {
        // fallback: local dataManager flow
        const data = getCoordinationData() || {};
        const ids = (data.activeMotions || []).map(m => m.id);
        ids.forEach(id => {
          try {
            endCoordinationMotion(id);
          } catch (e) {
            console.error('Error ending motion', id, e);
          }
        });
        refreshFromStorage();
      }

      // clear session pointer
      updateCoordinationData({ currentSession: null });
      setCurrentSession(null);
      // close and reset the 'Propose a New Motion' form so UI is clean after ending session
      setIsFormVisible(false);
      setMotionTitle('');
      setMotionDescription('');
      setMotionSpecial(false);
    } catch (e) {
      console.error('handleEndSession failed', e);
      alert('Failed to end session: ' + (e.message || JSON.stringify(e)));
    }
  };

  const handleSubmitMotion = async (e) => {
    e.preventDefault();
    if (!motionTitle) { alert('Please enter a motion title.'); return; }
    if (!selectedMeeting) { alert('Select a meeting first.'); return; }
    try {
      const { data, error } = await proposeMotion(selectedMeeting.id, motionTitle, motionDescription);
      console.log('proposeMotion result', { data, error });
      if (error) {
        console.error('proposeMotion error', error);
        alert('Failed to propose motion: ' + (error.message || JSON.stringify(error)));
        return;
      }
      // refresh meeting data
      const md = await fetchMeetingData(selectedMeeting.id);
      const { motions, votes, history } = md || {};
      const voteByMotion = {};
      (votes || []).forEach(v => {
        voteByMotion[v.motion_id] = voteByMotion[v.motion_id] || { yes: 0, no: 0, abstain: 0 };
        voteByMotion[v.motion_id][v.choice] = (voteByMotion[v.motion_id][v.choice] || 0) + 1;
      });
      const enriched = (motions || []).map(m => ({ ...m, votes: { for: voteByMotion[m.id]?.yes || 0, against: voteByMotion[m.id]?.no || 0, abstain: voteByMotion[m.id]?.abstain || 0 }, replies: m.replies || [] }));
      setActiveMotions(enriched);
      setVotingHistory((history || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      setMotionTitle(''); setMotionDescription(''); setMotionSpecial(false); setIsFormVisible(false);
      setTimeout(() => newMotionBtnRef.current?.focus(), 0);
    } catch (err) {
      console.error('handleSubmitMotion caught', err);
      alert('Failed to propose motion: ' + (err.message || JSON.stringify(err)));
    }
  };

  const determineOutcome = (motion) => {
    const forVotes = motion?.votes?.for || 0;
    const againstVotes = motion?.votes?.against || 0;
    const abstainVotes = motion?.votes?.abstain || 0;
    const totalVotes = forVotes + againstVotes + abstainVotes;
    if (totalVotes < 1) return undefined;
    if (forVotes > againstVotes) return 'passed';
    if (againstVotes > forVotes) return 'failed';
    return undefined;
  };

  const handleVote = async (motionId, voteType) => {
    if (!currentUser) { alert('Sign in to vote'); return; }
    const map = { for: 'yes', against: 'no', abstain: 'abstain' };
    const choice = map[voteType];
    try {
      const { data, error } = await vote(motionId, choice);
      console.log('vote result', { data, error });
      if (error) {
        console.error('vote error', error);
        alert('Failed to cast vote: ' + (error.message || JSON.stringify(error)));
        return;
      }
      const md = await fetchMeetingData(selectedMeeting.id);
      const { motions, votes } = md || {};
      const enriched = (motions || []).map(m => {
        const v = (votes || []).filter(x => x.motion_id === m.id);
        const counts = { for: 0, against: 0, abstain: 0 };
        v.forEach(item => { if (item.choice === 'yes') counts.for++; else if (item.choice === 'no') counts.against++; else counts.abstain++; });
        return { ...m, votes: counts };
      });
      setActiveMotions(enriched);
    } catch (e) {
      console.error(e);
      alert('Failed to cast vote');
    }
  };

  const handleUndoVote = () => {
    alert('Undo/Revote is not supported in the original coordination.js. To match your existing behavior, the React page keeps one vote per user without revote. If you want revote, I can add it after.');
  };

  // New: functional undo that calls dataManager undo and refreshes UI
  const handleUndoVoteFunctional = (motionId, username) => {
    // Perform undo silently (no popups). If unable to undo, fail silently.
    const ok = undoVoteOnCoordinationMotion(motionId, username);
    if (!ok) {
      // couldn't undo (likely locked or not in voting state) — do nothing visible
      console.warn('undoVoteOnCoordinationMotion returned false for', motionId, username);
      return;
    }
    // Refresh UI from storage after undo
    const data = getCoordinationData();
    setActiveMotions((data?.activeMotions || []).map(m => ({ ...m, votes: m.votes || { for: 0, against: 0, abstain: 0 }, replies: m.replies || [] })));
    // update UI vote counts for the specific motion if present
    const motion = (data?.activeMotions || []).find(m => m.id === motionId);
    if (motion) {
      setActiveMotions(prev => prev.map(m => m.id === motionId ? motion : m));
    }
  };

  const handleDeleteHistory = (itemId) => {
    if (window.confirm('Are you sure you want to delete this history item?')) {
      const newHistory = votingHistory.filter(item => item.id !== itemId);
      setVotingHistory((newHistory || []).map(h => ({ ...h, votes: h.votes || { for: 0, against: 0, abstain: 0 } })));
      // Persist deletion to storage so it doesn't reappear when motions are archived
      const data = getCoordinationData() || {};
      data.votingHistory = newHistory;
      updateCoordinationData({ votingHistory: newHistory });
    }
  };

  // Allow a member who voted FOR a historical motion to overturn it (bring it back to active)
  const handleOverturnHistory = (item) => {
    if (!currentUser) {
      alert('You must be logged in to overturn a decision.');
      return;
    }
    const vote = (item.userVotes && item.userVotes[currentUser]) || '';
    const votedFor = ['for', 'pro'].includes(vote.toString().toLowerCase());
    if (!votedFor) {
      alert('Only members who voted in favor of this motion can overturn the decision.');
      return;
    }
    if (!window.confirm('Bring this motion back to active motions for a new vote?')) return;

    const data = getCoordinationData() || {};
    const newHistory = (data.votingHistory || []).filter(h => h.id !== item.id);

    // Prepare revived motion: reset live voting state but keep previous outcome for audit
    const revived = {
      ...item,
      status: 'voting',
      // store previous votes for reference
      previousOutcome: item.status,
      previousVotes: item.votes,
      votes: { for: 0, against: 0, abstain: 0 },
      userVotes: {},
      voters: [],
      // remove archival timestamps so this becomes a fresh motion
      votingStartTime: new Date().toISOString(),
      endTime: undefined,
      resumedFromHistory: item.id,
      resumedAt: new Date().toISOString(),
    };

    const newActive = [revived, ...(data.activeMotions || [])];
    updateCoordinationData({ activeMotions: newActive, votingHistory: newHistory });
    // Start voting for revived motion
    try { startVotingForMotion(revived.id); } catch (e) { console.warn('startVotingForMotion failed', e); }
    refreshFromStorage();
  };

  const handleClearHistory = () => {
    if (!window.confirm('Clear all voting history? This cannot be undone.')) return;
    setVotingHistory([]);
    updateCoordinationData({ votingHistory: [] });
  };

  // Determine if undo is allowed for a given motion and username during the grace period
  const isUndoAllowed = (motion, username) => {
    if (!motion || !username) return false;
    // Allow undo when a pending user vote exists. Votes finalize immediately
    // in the data layer, but `userVotes` is kept for audit — presence signals
    // that an undo/retract is possible.
    return Boolean(motion.userVotes && motion.userVotes[username]);
  };

  return (
    <div className="coordination-container">
      <h2>Coordination Session</h2>

      {/* --- Meeting Selector + Download --- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontWeight: 700 }}>Meeting:</label>
        <select value={selectedMeeting?.id || ''} onChange={e => {
          const id = e.target.value;
          const m = meetingsList.find(x => x.id === id) || null;
          setSelectedMeeting(m);
        }}>
          <option value="">-- Select Meeting --</option>
          {meetingsList.map(m => (
            <option key={m.id} value={m.id}>{m.title || m.id}</option>
          ))}
        </select>
        <button className="secondary-btn" onClick={async () => {
          if (!selectedMeeting) { alert('Select a meeting to download minutes.'); return; }
          try {
            const minutes = await downloadMinutes(selectedMeeting.id);
            const blob = new Blob([JSON.stringify(minutes, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeTitle = (selectedMeeting.title || selectedMeeting.id).replace(/[^a-z0-9-_]/gi, '_');
            a.download = `${safeTitle}-minutes.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Failed to download minutes', e);
            alert('Failed to download minutes');
          }
        }} style={{ marginLeft: 8 }}>Download Minutes</button>
      </div>

      {/* --- Session Status --- */}
      <section className="session-status">
        <h3>Session Status</h3>
        <div id="session-info">
          {currentSession ? (
            <>
              <div>
                <p>Active Session: {currentSession.name}</p>
                <p style={{ fontSize: '12px', color: '#666' }}>Started: {new Date(currentSession.startTime).toLocaleString()}</p>
              </div>
              <div>
                <button ref={newMotionBtnRef} className="primary-btn" onClick={handleToggleNewMotion}>New Motion</button>
                <button className="secondary-btn" onClick={handleEndSession} style={{marginLeft: '10px'}}>End Session</button>
              </div>
            </>
          ) : (
            <>
              <p>No active session</p>
              <button className="primary-btn" onClick={handleStartSession}>Start New Session</button>
            </>
          )}
        </div>
      </section>

      {/* --- Motion Form --- */}
      {isFormVisible && (
         <section className="motion-form" style={{display: 'block'}}>
            <h3>Propose a New Motion</h3>
            <form onSubmit={handleSubmitMotion}>
                <div className="field-pair">
                  <input ref={motionTitleRef} className="form-input" type="text" placeholder="Motion Title" value={motionTitle} onChange={e => setMotionTitle(e.target.value)} />
                <textarea className="form-textarea" placeholder="Description (optional)" rows="3" value={motionDescription} onChange={e => setMotionDescription(e.target.value)}></textarea>
              </div>
                  <div className="form-buttons" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  <button type="submit" className="primary-btn">Submit Motion</button>
                  <button type="button" className="secondary-btn" onClick={() => { setIsFormVisible(false); setMotionTitle(''); setMotionDescription(''); setMotionSpecial(false); newMotionBtnRef.current?.focus(); }}>Cancel</button>
                <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, marginLeft: 6, whiteSpace: 'nowrap', height: '36px' }}>
                  <input type="checkbox" checked={motionSpecial} onChange={e => setMotionSpecial(e.target.checked)} style={{ marginLeft: 6, marginTop: 0, marginBottom: 0, alignSelf: 'center' }} />
                  <span style={{ marginLeft: 6, lineHeight: '1', alignSelf: 'center' }}>Special Motion</span>
                </label>
              </div>
            </form>
         </section>
      )}

      {/* --- Active Motions --- */}
      <section className="active-motions">
        <h3>Active Motions</h3>
        {/* Per-card resume is shown on each postponed motion; top-level resume button removed */}

        {activeMotions.length > 0 ? (
          // Render tree: top-level motions (parentId falsy) then children recursively
          (() => {
            const top = activeMotions.filter(m => !m.parentId);
            const renderMotion = (motion, level = 0) => {
              const children = activeMotions.filter(m => m.parentId === motion.id);
              const hasActiveSubmotions = activeMotions.some(m => m.parentId === motion.id);
              return (
                <div key={motion.id} style={{ marginLeft: level * 18, marginTop: 12, marginBottom: 24 }}>
                  <MotionCard
                    motion={motion}
                    onVote={handleVote}
                    onUndoVote={handleUndoVoteFunctional}
                    isUndoAllowed={(m, u) => isUndoAllowed(m, u)}
                  />
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="action-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {motion.status === 'postponed' ? (
                        <>
                          <button
                            className="primary-btn"
                            onClick={() => {
                              if (hasActiveSubmotions) {
                                alert('Cannot resume this motion while one or more sub-motions are still active. Finish or end them first.');
                                return;
                              }
                              handleResumeSpecific(motion.id);
                            }}
                            title={hasActiveSubmotions ? 'Cannot resume while sub-motions are still active. Finish or end them first.' : 'Resume this postponed motion'}
                          >
                            Resume
                          </button>
                          {selectedMeeting?.my_role === 'owner' && (
                            <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)}>End Motion</button>
                          )}
                        </>
                      ) : (
                        <>
                          <button className="secondary-btn" onClick={() => showSubForm(motion.id)}>Start Sub-Motion</button>
                          {/* Always show the undo button so the affordance doesn't disappear when other actions (like creating sub-motions) occur.
                              The button is disabled when undo isn't currently allowed. */}
                          <button
                            className="secondary-btn"
                            onClick={() => handleUndoVoteFunctional(motion.id, currentUser)}
                            disabled={!isUndoAllowed(motion, currentUser)}
                            title={isUndoAllowed(motion, currentUser) ? 'Undo your pending vote' : 'Undo not available (no pending vote or vote locked)'}
                          >
                            Undo Vote
                          </button>
                          {motion.status === 'voting' || motion.status === 'open' ? (
                            selectedMeeting?.my_role === 'owner' ? (
                              <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)}>End Motion</button>
                            ) : null
                          ) : (
                            // when not in voting/open state, show Start Voting to owner
                            selectedMeeting?.my_role === 'owner' && motion.status !== 'postponed' && motion.status !== 'passed' && motion.status !== 'failed' && (
                              <button className="secondary-btn" onClick={async () => {
                                try {
                                  const { data, error } = await updateMotion(motion.id, { status: 'open' });
                                  if (error) {
                                    console.error('start voting error', error);
                                    alert('Failed to start voting: ' + (error.message || JSON.stringify(error)));
                                    return;
                                  }
                                  const md = await fetchMeetingData(selectedMeeting.id);
                                  setActiveMotions(enrichMotions(md.motions, md.votes));
                                } catch (e) {
                                  console.error('Failed to start voting', e);
                                  alert('Failed to start voting');
                                }
                              }}>Start Voting</button>
                            )
                          )}
                          <button className="secondary-btn" onClick={() => handlePostpone(motion.id)}>Postpone Decision</button>
                        </>
                      )}
          {/* Edit button shown for all motion states (moved outside the conditional) */}
          <button className="secondary-btn" onClick={() => showEditForm(motion.id, motion)}>Edit</button>
        </div>
                  </div>
                  {editFormVisible[motion.id] && (
                    <div style={{ marginTop: 8 }}>
                      <div className="edit-header"><span className="editing-label">Editing:</span></div>
                      <div className="field-pair">
                        <input className="form-input" type="text" placeholder="Title" value={editFormValues[motion.id]?.title || ''} onChange={e => handleEditInputChange(motion.id, 'title', e.target.value)} />
                        <textarea className="form-textarea" placeholder="Description (optional)" rows={3} value={editFormValues[motion.id]?.description || ''} onChange={e => handleEditInputChange(motion.id, 'description', e.target.value)} />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="primary-btn" onClick={() => handleSubmitEdit(motion.id)}>Save</button>
                        <button className="secondary-btn" onClick={() => cancelEditForm(motion.id)}>Cancel</button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, marginLeft: 6, whiteSpace: 'nowrap', height: '36px' }}>
                          <input type="checkbox" checked={editFormValues[motion.id]?.special || false} onChange={e => handleEditInputChange(motion.id, 'special', e.target.checked)} style={{ marginLeft: 6, marginTop: 0, marginBottom: 0, alignSelf: 'center' }} />
                          <span style={{ marginLeft: 6, lineHeight: '1', alignSelf: 'center' }}>Special Motion</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {subFormVisible[motion.id] && (
                    <div style={{ marginTop: 8 }}>
                      <div className="field-pair">
                        <input className="form-input" type="text" placeholder="Sub-motion title" value={subFormValues[motion.id]?.title || ''} onChange={e => handleSubInputChange(motion.id, 'title', e.target.value)} />
                        <textarea className="form-textarea" placeholder="Description (optional)" rows={4} value={subFormValues[motion.id]?.description || ''} onChange={e => handleSubInputChange(motion.id, 'description', e.target.value)} />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="primary-btn" onClick={() => handleSubmitSubMotion(motion.id)}>Submit Sub-Motion</button>
                        <button className="secondary-btn" onClick={() => cancelSubForm(motion.id)}>Cancel</button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, marginLeft: 6, whiteSpace: 'nowrap', height: '36px' }}>
                          <input type="checkbox" checked={subFormValues[motion.id]?.special || false} onChange={e => handleSubInputChange(motion.id, 'special', e.target.checked)} style={{ marginLeft: 6, marginTop: 0, marginBottom: 0, alignSelf: 'center' }} />
                          <span style={{ marginLeft: 6, lineHeight: '1', alignSelf: 'center' }}>Special Motion</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {/* Replies / Discussion (hidden when motion is postponed) */}
                    {motion.status !== 'postponed' && (
                  (!motion.special) ? (
                  <div className="motion-replies" style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <strong className="discussion-title">Discussion</strong>
                    </div>
                    {motion.replies && motion.replies.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        {motion.replies.map(r => (
                          <div key={r.id} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={
                                  r.stance === 'pro' ? { background: '#e6f4ea', color: '#0a6b2b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 } :
                                  r.stance === 'con' ? { background: '#fdecea', color: '#a10b0b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 } :
                                  { background: '#f2f2f2', color: '#666', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }
                                }>{r.stance.toUpperCase()}</div>
                                <div style={{ fontSize: 12, color: '#666' }}>{r.createdBy} @ {new Date(r.createdAt).toLocaleString()}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
                                {r.createdBy === currentUser && (
                                  <>
                                    <button className="secondary-btn" onClick={() => showReplyEditForm(motion.id, r)}>Edit</button>
                                    <button className="secondary-btn" onClick={() => handleDeleteReply(motion.id, r.id)}>Delete</button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ marginTop: 4 }}>
                              {replyEditVisible[r.id] ? (
                                <div>
                                  <textarea ref={el => { try { replyEditTextareaRefs.current[r.id] = el; } catch (e) {} }} className="form-textarea" rows={3} value={replyEditValues[r.id]?.text || ''} onChange={e => handleReplyEditChange(r.id, 'text', e.target.value)} />
                                  <div className="reply-controls" style={{ marginTop: 6 }}>
                                    <label className="reply-label">Stance:</label>
                                    <select value={replyEditValues[r.id]?.stance || r.stance || 'neutral'} onChange={e => handleReplyEditChange(r.id, 'stance', e.target.value)}>
                                      <option value="pro">Pro</option>
                                      <option value="con">Con</option>
                                      <option value="neutral">Neutral</option>
                                    </select>
                                  </div>
                                  <div style={{ marginTop: 6 }}>
                                    <button className="primary-btn" onClick={() => handleSubmitReplyEdit(r.id)}>Save</button>
                                    <button className="secondary-btn" onClick={() => cancelReplyEdit(r.id)} style={{ marginLeft: 8 }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div>{r.text}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>No discussion yet.</div>
                    )}
                    {/* Replies list rendered above; place Reply button at the bottom-left of the discussion area */}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button className="secondary-btn" onClick={() => showReplyForm(motion.id)}>Reply</button>
                      </div>
                      {replyFormVisible[motion.id] && (
                        <div style={{ marginTop: 8 }}>
                          <textarea ref={el => { try { replyTextareaRefs.current[motion.id] = el; } catch (e) {} }} className="form-textarea" rows={3} placeholder="Write your reply..." value={replyFormValues[motion.id]?.text || ''} onChange={e => handleReplyInputChange(motion.id, 'text', e.target.value)} />
                          <div className="reply-controls">
                            <label className="reply-label">Stance:</label>
                            <select value={replyFormValues[motion.id]?.stance || 'neutral'} onChange={e => handleReplyInputChange(motion.id, 'stance', e.target.value)}>
                              <option value="pro">Pro</option>
                              <option value="con">Con</option>
                              <option value="neutral">Neutral</option>
                            </select>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <button className="primary-btn" onClick={() => handleSubmitReply(motion.id)}>Submit Reply</button>
                            <button className="secondary-btn" onClick={() => cancelReplyForm(motion.id)} style={{ marginLeft: 8 }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic' }}>Discussion is disabled for special motions.</div>
                  )
                  )}
                  {children.map(c => renderMotion(c, level + 1))}
                </div>
              );
            };

            return top.map(m => renderMotion(m));
          })()
        ) : (
          <p className="no-motions">No active motions</p>
        )}
      </section>
      
      {/* --- Voting History --- */}
      <section className="voting-history">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Voting History</h3>
          <div>
            <button className="secondary-btn" onClick={handleClearHistory} style={{ padding: '6px 10px' }}>Clear All</button>
          </div>
        </div>
        {votingHistory.length > 0 ? (
          votingHistory.map(item => (
            <div key={item.id} className="history-item">
              <div className="history-header">
                    <div className="history-left">
                      <div className="history-title">{item.title}</div>
                    </div>
                    <div className="history-actions">
                      {item.special && (
                        <div className="special-badge history-badge">Special Motion</div>
                      )}
                      <div className={`history-result ${item.status}`}>{item.status}</div>
                      <button className="secondary-btn" style={{ padding: '6px 8px' }} onClick={() => toggleHistoryDiscussion(item.id)}>
                        {historyDiscussionOpen[item.id] ? 'Hide Discussion' : 'Show Discussion'}
                      </button>
                      <button className="secondary-btn" style={{ padding: '6px 8px' }} onClick={() => toggleHistoryVoters(item.id)}>
                        {historyVotersOpen[item.id] ? 'Hide Voters' : 'Show Voters'}
                      </button>
                      {/* Show Overturn when current user voted for this motion in the past */}
                      {(item.userVotes && ['for', 'pro'].includes(((item.userVotes[currentUser]||'') + '').toString().toLowerCase())) && (
                        <button className="primary-btn" onClick={() => handleOverturnHistory(item)}>Overturn</button>
                      )}
                      <button className="delete-history-btn" title="Delete this item" onClick={() => handleDeleteHistory(item.id)}>×</button>
                    </div>
                  </div>
              <div className="history-votes">
                For: {item.votes?.for || 0} | Against: {item.votes?.against || 0} | Abstain: {item.votes?.abstain || 0}
              </div>

              {/* Collapsible discussion area for archived motion */}
              {historyDiscussionOpen[item.id] && (
                <div className="motion-replies" style={{ marginTop: 10 }}>
                  <div className="history-title" style={{ fontSize: 13, marginBottom: 8 }}>Discussion</div>
                  {/* Support multiple possible keys for archived replies (defensive) */}
                  {((item.replies && item.replies.length) || (item.discussion && item.discussion.length)) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(item.replies || item.discussion).map(reply => {
                        const raw = (reply.stance || '').toString().toLowerCase();
                        const stanceKey = (raw === 'for' || raw === 'pro') ? 'for' : (raw === 'against' || raw === 'con') ? 'against' : 'neutral';
                        const stanceLabel = stanceKey === 'for' ? 'Pro' : stanceKey === 'against' ? 'Con' : 'Neutral';
                        return (
                          <div key={reply.id || `${reply.createdAt}-${Math.random()}`} className={`discussion-reply ${stanceKey}`}>
                            <div className="reply-meta">
                              <div style={{ fontWeight: 700 }}>{reply.author || reply.createdBy || reply.username || 'Unknown'}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className={`reply-stance ${stanceKey}`}>{stanceLabel}</div>
                                <div style={{ fontSize: 12, color: '#666' }}>{reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}</div>
                              </div>
                            </div>
                            <div style={{ marginTop: 6, color: 'var(--muted)' }}>{reply.text || reply.body || ''}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-history" style={{ margin: 0 }}>No discussion history for this motion.</p>
                  )}
                </div>
              )}
              {/* Collapsible voters list for archived motion */}
              {historyVotersOpen[item.id] && (
                <div className="voters-list" style={{ marginTop: 10 }}>
                  <div className="history-title" style={{ fontSize: 13, marginBottom: 8 }}>Voters</div>
                  {item.userVotes && Object.keys(item.userVotes).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {Object.entries(item.userVotes).map(([username, vote]) => {
                        const raw = (vote || '').toString().toLowerCase();
                        const vKey = (raw === 'for' || raw === 'pro') ? 'for' : (raw === 'against' || raw === 'con') ? 'against' : 'neutral';
                        const vLabel = vKey === 'for' ? 'For' : vKey === 'against' ? 'Against' : 'Abstain';
                        return (
                          <div key={username} className={`voter-row ${vKey}`} style={{ padding: 8, background: 'var(--card)', borderRadius: 8, border: '1px solid rgba(15,23,42,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ fontWeight: 700 }}>{username}</div>
                              <div className={`reply-stance ${vKey}`}>{vLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="no-history" style={{ margin: 0 }}>No voter records for this motion.</p>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="no-history">No voting history</p>
        )}
      </section>
    </div>
  );
}

export default Coordination;
