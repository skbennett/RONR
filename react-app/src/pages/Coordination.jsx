// /pages/Coordination.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCoordinationData,
  updateCoordinationData,
  addCoordinationMotion,
  addCoordinationSubMotion,
  addCoordinationReply,
  updateCoordinationMotion,
  startVotingForMotion,
  voteOnCoordinationMotion,
  postponeCoordinationMotion,
  resumeLastPostponedCoordinationMotion,
  resumeSpecificPostponedCoordinationMotion,
  endCoordinationMotion,
  undoVoteOnCoordinationMotion
} from '../services/dataManager';
import './Coordination.css';

// --- Helper Components (for better organization) ---

// Component for a single active motion card
const MotionCard = ({ motion, onVote, onUndoVote, isUndoAllowed }) => {
  const { user } = useAuth();
  const currentUser = user || 'guest';
  const scheduledToArchiveRef = useRef(new Set());
  // dataManager stores per-user votes in `userVotes` (not votesByUser)
  const userVote = motion.userVotes ? motion.userVotes[currentUser] : undefined;
  const hasVoted = Boolean(userVote);
  const canUndo = isUndoAllowed ? isUndoAllowed(motion, currentUser) : hasVoted;
  return (
    <div className="motion-card">
      <div className="motion-header">
        <div className="motion-header-left">
          <div className="motion-title">{motion.title}</div>
          {motion.special && (
            <div className="special-badge">Special Motion</div>
          )}
        </div>
        <div className={`motion-status ${motion.status}`}>{motion.status}</div>
      </div>
      {motion.description && <div className="motion-description">{motion.description}</div>}
      <div className="motion-meta">
        Proposed by: {motion.createdBy} | {new Date(motion.createdAt).toLocaleString()}
      </div>
      {motion.status === 'voting' && (
        <div className="voting-section">
          <div className="vote-counts">
            <div className="vote-count"><span>For:</span><span className="count">{motion.votes.for}</span></div>
            <div className="vote-count"><span>Against:</span><span className="count">{motion.votes.against}</span></div>
            <div className="vote-count"><span>Abstain:</span><span className="count">{motion.votes.abstain}</span></div>
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
            <div className="vote-count"><span>For:</span><span className="count">{motion.votes.for}</span></div>
            <div className="vote-count"><span>Against:</span><span className="count">{motion.votes.against}</span></div>
            <div className="vote-count"><span>Abstain:</span><span className="count">{motion.votes.abstain}</span></div>
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
  const [currentSession, setCurrentSession] = useState(null);
  const [activeMotions, setActiveMotions] = useState([]);
  const [votingHistory, setVotingHistory] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [motionTitle, setMotionTitle] = useState('');
  const [motionDescription, setMotionDescription] = useState('');
  const [motionSpecial, setMotionSpecial] = useState(false);
  const { user } = useAuth();
  const currentUser = user || 'guest';
  // No client-side lock timers: votes finalize immediately server-side.
  // Inline sub-motion form state (mapping motionId -> visible)
  const [subFormVisible, setSubFormVisible] = useState({});
  const [subFormValues, setSubFormValues] = useState({});
  // Inline reply form state (mapping motionId -> visible)
  const [replyFormVisible, setReplyFormVisible] = useState({});
  const [replyFormValues, setReplyFormValues] = useState({});
  // Inline edit form for motions
  const [editFormVisible, setEditFormVisible] = useState({});
  const [editFormValues, setEditFormValues] = useState({});
  
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
      return copy;
    });
  };
  const cancelReplyForm = (id) => {
    setReplyFormVisible(prev => ({ ...prev, [id]: false }));
    setReplyFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
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
                <button className="primary-btn" onClick={() => { setMotionTitle(''); setMotionDescription(''); setMotionSpecial(false); setIsFormVisible(true); }}>New Motion</button>
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
                <input className="form-input" type="text" placeholder="Motion Title" value={motionTitle} onChange={e => setMotionTitle(e.target.value)} />
                <textarea className="form-textarea" placeholder="Description (optional)" rows="3" value={motionDescription} onChange={e => setMotionDescription(e.target.value)}></textarea>
              </div>
                <div className="form-buttons" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8 }}>
                <button type="submit" className="primary-btn">Submit Motion</button>
                <button type="button" className="secondary-btn" onClick={() => { setIsFormVisible(false); setMotionTitle(''); setMotionDescription(''); setMotionSpecial(false); }}>Cancel</button>
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
                    </div>

                    {/* Edit button visually separated to the right */}
                    <div className="action-edit" style={{ marginLeft: 12 }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <strong className="discussion-title">Discussion</strong>
                      <button className="secondary-btn" onClick={() => showReplyForm(motion.id)} style={{ marginLeft: 'auto' }}>Reply</button>
                    </div>
                    {motion.replies && motion.replies.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        {motion.replies.map(r => (
                          <div key={r.id} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={
                                r.stance === 'pro' ? { background: '#e6f4ea', color: '#0a6b2b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 } :
                                r.stance === 'con' ? { background: '#fdecea', color: '#a10b0b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 } :
                                { background: '#f2f2f2', color: '#666', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }
                              }>{r.stance.toUpperCase()}</div>
                              <div style={{ fontSize: 12, color: '#666' }}>{r.createdBy} @ {new Date(r.createdAt).toLocaleString()}</div>
                            </div>
                            <div style={{ marginTop: 4 }}>{r.text}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>No discussion yet.</div>
                    )}
                    {replyFormVisible[motion.id] && (
                      <div style={{ marginTop: 8 }}>
                        <textarea className="form-textarea" rows={3} placeholder="Write your reply..." value={replyFormValues[motion.id]?.text || ''} onChange={e => handleReplyInputChange(motion.id, 'text', e.target.value)} />
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
              <div className="history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="history-title">{item.title}</div>
                  {item.special && (
                    <div style={{ background: '#f2f2f2', color: '#333', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #e0e0e0' }}>Special Motion</div>
                  )}
                </div>
                <div className="history-actions">
                  <div className={`history-result ${item.status}`}>{item.status}</div>
                  <button className="delete-history-btn" title="Delete this item" onClick={() => handleDeleteHistory(item.id)}>×</button>
                </div>
              </div>
              <div className="history-votes">
                For: {item.votes.for} | Against: {item.votes.against} | Abstain: {item.votes.abstain}
              </div>
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
