// /pages/Coordination.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getCoordinationData,
  updateCoordinationData,
  addCoordinationMotion,
  startVotingForMotion,
  voteOnCoordinationMotion,
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
              {canUndo && (
            <div style={{ marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>You voted: {userVote}. You can change or undo your vote.</p>
              <button className="secondary-btn" onClick={() => onUndoVote(motion.id, currentUser)}>Undo Vote</button>
            </div>
          )}
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
  
  // --- DATA INITIALIZATION ---
  useEffect(() => {
    const data = getCoordinationData();
    if (data) {
      setActiveMotions(data.activeMotions || []);
      setVotingHistory(data.votingHistory || []);
      setCurrentSession(data.currentSession || null);
    }
  }, []);

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
    setTimeout(() => {
      const latest = getCoordinationData();
      const motion = (latest?.activeMotions || []).find(m => m.id === motionId);
      if (!motion || motion.status !== 'voting') return;
      const outcome = determineOutcome(motion);
      if (outcome) {
        // Mark motion as completed immediately so UI displays the completed state,
        // but wait ARCHIVE_DELAY_MS before moving it to voting history.
        motion.status = 'completed';
        motion.outcome = outcome; // 'passed'|'failed'
        motion.endTime = new Date().toISOString();
        updateCoordinationData({ activeMotions: latest.activeMotions });
        setActiveMotions([...latest.activeMotions]);
        setTimeout(() => {
          const after = getCoordinationData();
          const idx = (after?.activeMotions || []).findIndex(m => m.id === motionId);
          if (idx !== -1) {
            const [finished] = after.activeMotions.splice(idx, 1);
            // ensure archived item carries the final outcome in its status
            finished.status = finished.outcome || finished.status;
            // clean up outcome fields
            delete finished.outcome;
            // Clear any pending lock timers for this motion (all users)
            Object.keys(lockTimersRef.current).forEach(k => {
              if (k.startsWith(`${motionId}::`)) {
                clearTimeout(lockTimersRef.current[k]);
                delete lockTimersRef.current[k];
              }
            });
            after.votingHistory = after.votingHistory || [];
            after.votingHistory.unshift(finished);
            updateCoordinationData(after);
            setActiveMotions([...after.activeMotions]);
            setVotingHistory([...after.votingHistory]);
          }
        }, ARCHIVE_DELAY_MS);
      }
  }, VOTE_LOCK_DELAY_MS);
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
        {activeMotions.length > 0 ? (
          activeMotions.map(motion => (
            <MotionCard
              key={motion.id}
              motion={motion}
              onVote={handleVote}
              onUndoVote={handleUndoVoteFunctional}
              isUndoAllowed={(m, u) => isUndoAllowed(m, u)}
            />
          ))
        ) : (
          <p className="no-motions">No active motions</p>
        )}
      </section>
      
      {/* --- Voting History --- */}
      <section className="voting-history">
        <h3>Voting History</h3>
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