// /pages/Coordination.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCoordinationData,
  updateCoordinationData,
  addCoordinationMotion,
  addCoordinationSubMotion,
  addCoordinationReply,
  updateCoordinationReply,
  deleteCoordinationReply,
  updateCoordinationMotion,
  startVotingForMotion,
  voteOnCoordinationMotion,
  postponeCoordinationMotion,
  resumeLastPostponedCoordinationMotion,
  resumeSpecificPostponedCoordinationMotion,
  endCoordinationMotion,
  undoVoteOnCoordinationMotion
} from '../services/dataManager';
import './coordination.css';
import MotionCard from '../components/coordination/MotionCard';
import MotionForm from '../components/coordination/MotionForm';
import VotingHistory from '../components/coordination/VotingHistory';


// --- The Main Coordination Page Component ---
function Coordination() {
  // --- STATE MANAGEMENT ---
  const [currentSession, setCurrentSession] = useState(null);
  const [activeMotions, setActiveMotions] = useState([]);
  const [votingHistory, setVotingHistory] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [motionTitle, setMotionTitle] = useState('');
  const [motionDescription, setMotionDescription] = useState('');
  const [motionSpecial, setMotionSpecial] = useState(false);
  const { user } = useAuth();
  const currentUser = user || 'guest';
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
  useEffect(() => {
    const data = getCoordinationData();
    if (data) {
      setActiveMotions(data.activeMotions || []);
      setVotingHistory(data.votingHistory || []);
      setCurrentSession(data.currentSession || null);
    }
  }, []);

  // --- Sub-motion helpers & utilities ---
  // Utility: refresh local state from storage
  const refreshFromStorage = () => {
    const data = getCoordinationData();
    setActiveMotions(data?.activeMotions || []);
    setVotingHistory(data?.votingHistory || []);
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
    const sub = addCoordinationSubMotion({ parentId, title: vals.title.trim(), description: (vals.description || '').trim(), sessionId: currentSession?.id, special: !!vals.special });
    if (sub) {
      // start voting immediately
      startVotingForMotion(sub.id);
      // postpone the parent so work focuses on the submotion first
      try {
        postponeCoordinationMotion(parentId);
      } catch (e) { console.warn('failed to postpone parent motion', e); }
      // close discussion area on parent while postponed
      setReplyFormVisible(prev => ({ ...prev, [parentId]: false }));
      cancelSubForm(parentId);
      refreshFromStorage();
    } else {
      alert('Failed to add sub-motion.');
    }
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
    const updated = updateCoordinationMotion(motionId, { title: vals.title.trim(), description: (vals.description || '').trim(), special: !!vals.special });
    if (updated) {
      cancelEditForm(motionId);
      refreshFromStorage();
    } else {
      alert('Failed to update motion.');
    }
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
    const reply = addCoordinationReply({ motionId, parentReplyId: null, text: vals.text.trim(), stance });
    if (reply) {
      cancelReplyForm(motionId);
      refreshFromStorage();
      // mark todo complete for this small fix
      try { window.__todo && window.__todo.markDone && window.__todo.markDone(3); } catch (e) {}
    } else {
      alert('Failed to add reply.');
    }
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
    const ok = updateCoordinationReply(vals.motionId, replyId, { text: vals.text.trim(), stance: vals.stance });
    if (!ok) { alert('Failed to update reply.'); return; }
    cancelReplyEdit(replyId);
    refreshFromStorage();
  };
  const handleDeleteReply = (motionId, replyId) => {
    if (!window.confirm('Delete this reply? This cannot be undone.')) return;
    const ok = deleteCoordinationReply(motionId, replyId);
    if (!ok) { alert('Failed to delete reply.'); return; }
    refreshFromStorage();
  };

  const handlePostpone = (motionId) => {
    if (!window.confirm('Postpone decision on this motion? It will be moved to a postponed stack.')) return;
    if (postponeCoordinationMotion(motionId)) {
      // close discussion area for postponed motion
      setReplyFormVisible(prev => ({ ...prev, [motionId]: false }));
      // refresh UI without extra popup
      refreshFromStorage();
    } else {
      alert('Failed to postpone motion.');
    }
  };

  const handleResumePostponed = () => {
    const resumed = resumeLastPostponedCoordinationMotion();
    if (resumed) {
      // Ensure voting state is started in storage and UI
      startVotingForMotion(resumed.id);
      // If the current user has an unfinalized vote on this motion, set a fresh undo deadline
      const username = currentUser;
      const data = getCoordinationData() || {};
      const motion = (data.activeMotions || []).find(m => m.id === resumed.id);
      // Votes finalize immediately in dataManager; just refresh UI
  // keep discussion area closed on resume unless user explicitly opens it
  setReplyFormVisible(prev => ({ ...prev, [resumed.id]: false }));
      alert(`Resumed motion: ${resumed.title}`);
      refreshFromStorage();
    } else {
      alert('No postponed motions to resume.');
    }
  };

  const handleResumeSpecific = (motionId) => {
    const resumed = resumeSpecificPostponedCoordinationMotion(motionId);
    if (resumed) {
      // ensure voting is active and persisted
      startVotingForMotion(resumed.id);
      // If the current user has an unfinalized vote on this motion, set a fresh undo deadline
      const username = currentUser;
      const data = getCoordinationData() || {};
      const motion = (data.activeMotions || []).find(m => m.id === resumed.id);
      // Votes finalize immediately in dataManager; just refresh UI
  // keep discussion area closed on resume unless user explicitly opens it
  setReplyFormVisible(prev => ({ ...prev, [resumed.id]: false }));
      alert(`Resumed motion: ${resumed.title}`);
      refreshFromStorage();
    } else {
      alert('Failed to resume this motion (it may not be postponed).');
    }
  };

  const handleEndMotion = (motionId) => {
    if (!window.confirm('End this motion now and record the outcome based on current votes?')) return;
    const ended = endCoordinationMotion(motionId);
    if (!ended) {
      alert('Failed to end motion.');
      return;
    }
    // No client-side timers to clear; refresh UI from storage
    // If this was a submotion, resume its parent (if it was postponed)
    if (ended.parentId) {
      // attempt to resume the parent automatically when the submotion is finished
      try {
        const resumedParent = resumeSpecificPostponedCoordinationMotion(ended.parentId);
        if (resumedParent) {
          // ensure parent is in voting state and keep discussion closed (user must open it)
          startVotingForMotion(resumedParent.id);
          setReplyFormVisible(prev => ({ ...prev, [resumedParent.id]: false }));
        }
      } catch (e) {
        console.warn('failed to resume parent motion after submotion ended', e);
      }
    }
    refreshFromStorage();
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

  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end the current session? Active motions will be archived.')) {
      // End each active motion using the canonical end function so outcomes
      // are computed consistently (2/3 rule) and archived into history.
      const data = getCoordinationData() || {};
      const ids = (data.activeMotions || []).map(m => m.id);
      ids.forEach(id => {
        try {
          endCoordinationMotion(id);
        } catch (e) {
          console.error('Error ending motion', id, e);
        }
      });
      // Refresh from storage to pick up archived history and cleared active motions
      refreshFromStorage();
      // clear session pointer
      updateCoordinationData({ currentSession: null });
      setCurrentSession(null);
      // close and reset the 'Propose a New Motion' form so UI is clean after ending session
      setIsFormVisible(false);
      setMotionTitle('');
      setMotionDescription('');
      setMotionSpecial(false);
    }
  };

  const handleSubmitMotion = (e) => {
    e.preventDefault();
    if (!motionTitle) {
      alert('Please enter a motion title.');
      return;
    }
    if (!currentSession) {
      alert('No active session. Please start a session first.');
      return;
    }
    const motion = addCoordinationMotion({ title: motionTitle, description: motionDescription, sessionId: currentSession.id, special: motionSpecial });
    setActiveMotions(prev => [motion, ...prev]);
    // Start voting immediately for the new motion and refresh UI
    startVotingForMotion(motion.id);
    const refreshed = getCoordinationData();
    setActiveMotions(refreshed?.activeMotions || []);
    // Reset form
    setMotionTitle('');
    setMotionDescription('');
    setMotionSpecial(false);
    setIsFormVisible(false);
    // return focus to New Motion button for keyboard users
    setTimeout(() => newMotionBtnRef.current?.focus(), 0);
  };

  const determineOutcome = (motion) => {
    const forVotes = motion.votes.for;
    const againstVotes = motion.votes.against;
    const totalVotes = forVotes + againstVotes + motion.votes.abstain;
    if (totalVotes < 1) return undefined;
    if (forVotes > againstVotes) return 'passed';
    if (againstVotes > forVotes) return 'failed';
    return undefined;
  };

  const handleVote = (motionId, voteType) => {
    const username = currentUser;
    if (!voteOnCoordinationMotion(motionId, voteType, username)) {
      alert('You have already voted on this motion.');
      return;
    }
    const data = getCoordinationData();
    setActiveMotions(data?.activeMotions || []);

    // Votes are finalized immediately in dataManager; no client-side lock timer.
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
    setActiveMotions(data?.activeMotions || []);
    // update UI vote counts for the specific motion if present
    const motion = (data?.activeMotions || []).find(m => m.id === motionId);
    if (motion) {
      setActiveMotions(prev => prev.map(m => m.id === motionId ? motion : m));
    }
  };

  const handleDeleteHistory = (itemId) => {
    if (window.confirm('Are you sure you want to delete this history item?')) {
      const newHistory = votingHistory.filter(item => item.id !== itemId);
      setVotingHistory(newHistory);
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
        <MotionForm
          motionTitleRef={motionTitleRef}
          motionTitle={motionTitle}
          setMotionTitle={setMotionTitle}
          motionDescription={motionDescription}
          setMotionDescription={setMotionDescription}
          motionSpecial={motionSpecial}
          setMotionSpecial={setMotionSpecial}
          onSubmit={handleSubmitMotion}
          onCancel={() => { setIsFormVisible(false); setMotionTitle(''); setMotionDescription(''); setMotionSpecial(false); newMotionBtnRef.current?.focus(); }}
        />
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
                          <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)}>End Motion</button>
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
                          {motion.status === 'voting' && (
                            <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)}>End Motion</button>
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
      <VotingHistory
        votingHistory={votingHistory}
        historyDiscussionOpen={historyDiscussionOpen}
        historyVotersOpen={historyVotersOpen}
        currentUser={currentUser}
        toggleHistoryDiscussion={toggleHistoryDiscussion}
        toggleHistoryVoters={toggleHistoryVoters}
        handleOverturnHistory={handleOverturnHistory}
        handleDeleteHistory={handleDeleteHistory}
        handleClearHistory={handleClearHistory}
      />
    </div>
  );
}

export default Coordination;
