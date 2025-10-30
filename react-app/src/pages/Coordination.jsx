// /pages/Coordination.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCoordinationData,
  updateCoordinationData,
  addCoordinationMotion,
  addCoordinationSubMotion,
  startVotingForMotion,
  voteOnCoordinationMotion,
  postponeCoordinationMotion,
  resumeLastPostponedCoordinationMotion,
  resumeSpecificPostponedCoordinationMotion,
  endCoordinationMotion,
  undoVoteOnCoordinationMotion
  , finalizeVoteLockOnCoordinationMotion
} from '../services/dataManager';

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
        <div className="motion-title">{motion.title}</div>
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
  const { user } = useAuth();
  const currentUser = user || 'guest';
  // How long after casting a vote before the vote is finalized/locked (ms)
  const VOTE_LOCK_DELAY_MS = 5000; // 5 seconds
  // How long after outcome before the motion is archived into history (ms)
  // Keep this >= VOTE_LOCK_DELAY_MS so users have time to undo before archive
  const ARCHIVE_DELAY_MS = 5000; // 5 seconds
  // Keep track of scheduled lock timers so we can cancel them if user undoes their vote
  const lockTimersRef = useRef({});
  // Keep client-side lock deadlines so UI can allow undo during grace period even if storage lags
  const lockDeadlinesRef = useRef({});
  // Inline sub-motion form state (mapping motionId -> visible)
  const [subFormVisible, setSubFormVisible] = useState({});
  const [subFormValues, setSubFormValues] = useState({});
  
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
  const handleSubInputChange = (id, field, value) => {
    setSubFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitSubMotion = (parentId) => {
    const vals = subFormValues[parentId] || {};
    if (!vals.title || vals.title.trim() === '') { alert('Please enter a sub-motion title.'); return; }
    const sub = addCoordinationSubMotion({ parentId, title: vals.title.trim(), description: (vals.description || '').trim(), sessionId: currentSession?.id });
    if (sub) {
      // start voting quickly
      setTimeout(() => { startVotingForMotion(sub.id); refreshFromStorage(); }, 200);
      cancelSubForm(parentId);
      refreshFromStorage();
    } else {
      alert('Failed to add sub-motion.');
    }
  };

  const handlePostpone = (motionId) => {
    if (!window.confirm('Postpone decision on this motion? It will be moved to a postponed stack.')) return;
    if (postponeCoordinationMotion(motionId)) {
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
      if (motion && motion.userVotes && motion.userVotes[username]) {
        try {
          const lockKey = `${resumed.id}::${username}`;
          // clear any existing timer
          if (lockTimersRef.current[lockKey]) {
            clearTimeout(lockTimersRef.current[lockKey]);
          }
          lockDeadlinesRef.current[lockKey] = Date.now() + VOTE_LOCK_DELAY_MS;
          lockTimersRef.current[lockKey] = setTimeout(() => {
            finalizeVoteLockOnCoordinationMotion(resumed.id, username);
            const refreshedAfterLock = getCoordinationData();
            setActiveMotions(refreshedAfterLock?.activeMotions || []);
            delete lockTimersRef.current[lockKey];
            delete lockDeadlinesRef.current[lockKey];
          }, VOTE_LOCK_DELAY_MS);
        } catch (e) {
          console.error('Error scheduling resume vote lock:', e);
        }
      }
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
      if (motion && motion.userVotes && motion.userVotes[username]) {
        try {
          const lockKey = `${resumed.id}::${username}`;
          if (lockTimersRef.current[lockKey]) {
            clearTimeout(lockTimersRef.current[lockKey]);
          }
          lockDeadlinesRef.current[lockKey] = Date.now() + VOTE_LOCK_DELAY_MS;
          lockTimersRef.current[lockKey] = setTimeout(() => {
            finalizeVoteLockOnCoordinationMotion(resumed.id, username);
            const refreshedAfterLock = getCoordinationData();
            setActiveMotions(refreshedAfterLock?.activeMotions || []);
            delete lockTimersRef.current[lockKey];
            delete lockDeadlinesRef.current[lockKey];
          }, VOTE_LOCK_DELAY_MS);
        } catch (e) {
          console.error('Error scheduling resume vote lock:', e);
        }
      }
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
    // Clear any pending lock timers related to this motion for all users
    Object.keys(lockTimersRef.current).forEach(k => {
      if (k.startsWith(`${motionId}::`)) {
        clearTimeout(lockTimersRef.current[k]);
        delete lockTimersRef.current[k];
      }
    });
    // Clear any client-side deadlines for this motion
    Object.keys(lockDeadlinesRef.current).forEach(k => {
      if (k.startsWith(`${motionId}::`)) {
        delete lockDeadlinesRef.current[k];
      }
    });
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
      const data = getCoordinationData() || {};
      const active = (data.activeMotions || []).map(m => m.status === 'voting' ? { ...m, status: 'expired', endTime: new Date().toISOString() } : m);
      const toArchive = active.filter(m => m.status !== 'pending');
      // Merge stored votingHistory with new archived items, avoiding duplicates (by id)
      const existing = data.votingHistory || [];
      const merged = [
        ...existing,
        ...toArchive.filter(a => !existing.some(e => e.id === a.id))
      ];
      updateCoordinationData({
        currentSession: null,
        votingHistory: merged,
        activeMotions: []
      });
      // Update UI from persisted/merged history to avoid reintroducing deleted items
      setVotingHistory(merged);
      setActiveMotions([]);
      setCurrentSession(null);
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
    const motion = addCoordinationMotion({ title: motionTitle, description: motionDescription, sessionId: currentSession.id });
    setActiveMotions(prev => [motion, ...prev]);
    setTimeout(() => {
      startVotingForMotion(motion.id);
      const refreshed = getCoordinationData();
      setActiveMotions(refreshed?.activeMotions || []);
    }, 5000);
    // Reset form
    setMotionTitle('');
    setMotionDescription('');
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

    // Schedule automatic finalize/lock for this user's vote after VOTE_LOCK_DELAY_MS
    try {
      const lockKey = `${motionId}::${username}`;
      if (lockTimersRef.current[lockKey]) {
        clearTimeout(lockTimersRef.current[lockKey]);
      }
      // set client-side deadline
      lockDeadlinesRef.current[lockKey] = Date.now() + VOTE_LOCK_DELAY_MS;
      lockTimersRef.current[lockKey] = setTimeout(() => {
        finalizeVoteLockOnCoordinationMotion(motionId, username);
        const refreshedAfterLock = getCoordinationData();
        setActiveMotions(refreshedAfterLock?.activeMotions || []);
        // remove timer entry
        delete lockTimersRef.current[lockKey];
        delete lockDeadlinesRef.current[lockKey];
      }, VOTE_LOCK_DELAY_MS);
    } catch (e) {
      // ignore scheduling errors
      console.error('Error scheduling vote lock:', e);
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
    // Cancel any scheduled lock for this user's vote
    try {
      const lockKey = `${motionId}::${username}`;
      if (lockTimersRef.current[lockKey]) {
        clearTimeout(lockTimersRef.current[lockKey]);
        delete lockTimersRef.current[lockKey];
      }
      // also clear client-side deadline
      if (lockDeadlinesRef.current[lockKey]) {
        delete lockDeadlinesRef.current[lockKey];
      }
    } catch (e) {
      console.error('Error cancelling vote lock timer:', e);
    }
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
    const hasUserVote = motion.userVotes && motion.userVotes[username];
    if (!hasUserVote) return false;
    // If the vote is finalized in storage, disallow
    if (motion.voters && motion.voters.includes(username)) return false;
    // If a client-side deadline exists and is still in the future, allow undo
    const lockKey = `${motion.id}::${username}`;
    const deadline = lockDeadlinesRef.current[lockKey];
    if (deadline && Date.now() < deadline) return true;
    // otherwise allow undo if no deadline (fallback) and not locked
    return !deadline;
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
                <button className="primary-btn" onClick={() => setIsFormVisible(true)}>New Motion</button>
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
              <input type="text" placeholder="Motion Title" value={motionTitle} onChange={e => setMotionTitle(e.target.value)} />
              <textarea placeholder="Description (optional)" rows="3" value={motionDescription} onChange={e => setMotionDescription(e.target.value)}></textarea>
              <div className="form-buttons">
                <button type="submit" className="primary-btn">Submit Motion</button>
                <button type="button" className="secondary-btn" onClick={() => setIsFormVisible(false)}>Cancel</button>
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
              return (
                <div key={motion.id} style={{ marginLeft: level * 18 }}>
                  <MotionCard
                    motion={motion}
                    onVote={handleVote}
                    onUndoVote={handleUndoVoteFunctional}
                    isUndoAllowed={(m, u) => isUndoAllowed(m, u)}
                  />
                  <div style={{ marginTop: 8 }}>
                    {motion.status === 'postponed' ? (
                      <button className="primary-btn" onClick={() => handleResumeSpecific(motion.id)}>Resume</button>
                    ) : (
                      <>
                        <button className="secondary-btn" onClick={() => showSubForm(motion.id)}>Start Sub-Motion</button>
                        {/* show undo button on card row if allowed (helps the main/card-level visibility) */}
                        {isUndoAllowed(motion, currentUser) && (
                          <button className="secondary-btn" onClick={() => handleUndoVoteFunctional(motion.id, currentUser)} style={{ marginLeft: 8 }}>Undo Vote</button>
                        )}
                        {motion.status === 'voting' && (
                          <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)} style={{ marginLeft: 8 }}>End Motion</button>
                        )}
                        <button className="secondary-btn" onClick={() => handlePostpone(motion.id)} style={{ marginLeft: 8 }}>Postpone Decision</button>
                      </>
                    )}
                  </div>
                  {subFormVisible[motion.id] && (
                    <div style={{ marginTop: 8 }}>
                      <input type="text" placeholder="Sub-motion title" value={subFormValues[motion.id]?.title || ''} onChange={e => handleSubInputChange(motion.id, 'title', e.target.value)} />
                      <input type="text" placeholder="Description (optional)" value={subFormValues[motion.id]?.description || ''} onChange={e => handleSubInputChange(motion.id, 'description', e.target.value)} style={{ display: 'block', marginTop: 6 }} />
                      <div style={{ marginTop: 6 }}>
                        <button className="primary-btn" onClick={() => handleSubmitSubMotion(motion.id)}>Submit Sub-Motion</button>
                        <button className="secondary-btn" onClick={() => cancelSubForm(motion.id)} style={{ marginLeft: 8 }}>Cancel</button>
                      </div>
                    </div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Voting History</h3>
          <div>
            <button className="secondary-btn" onClick={handleClearHistory}>Clear All</button>
          </div>
        </div>
        {votingHistory.length > 0 ? (
          votingHistory.map(item => (
            <div key={item.id} className="history-item">
              <div className="history-header">
                <div className="history-title">{item.title}</div>
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