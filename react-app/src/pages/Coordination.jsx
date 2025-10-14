// /pages/Coordination.jsx

import React, { useState, useEffect } from 'react';

// --- Helper Components (for better organization) ---

// Component for a single active motion card
const MotionCard = ({ motion, onVote }) => {
  const currentUser = 'user123'; // In a real app, this would come from auth context
  const hasVoted = motion.voters && motion.voters.includes(currentUser);

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
            <button className="vote-btn for" onClick={() => onVote(motion.id, 'for')} disabled={hasVoted}>Vote For</button>
            <button className="vote-btn against" onClick={() => onVote(motion.id, 'against')} disabled={hasVoted}>Vote Against</button>
            <button className="vote-btn abstain" onClick={() => onVote(motion.id, 'abstain')} disabled={hasVoted}>Abstain</button>
          </div>
          {hasVoted && <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>You have voted on this motion.</p>}
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
  
  // --- DATA INITIALIZATION ---
  useEffect(() => {
    // Mocking initial data load from a data manager or API
    const initialMotions = [
      { id: 1, title: 'Adopt New Logo', description: 'Motion to adopt the new branding package as the official logo.', status: 'voting', createdAt: new Date().toISOString(), createdBy: 'Jane Doe', votes: { for: 3, against: 1, abstain: 1 }, voters: [] },
      { id: 2, title: 'Approve Q4 Budget', description: '', status: 'pending', createdAt: new Date().toISOString(), createdBy: 'John Smith', votes: { for: 0, against: 0, abstain: 0 }, voters: [] }
    ];
    const initialHistory = [
      { id: 3, title: 'Adjourn Previous Meeting', status: 'passed', createdAt: new Date().toISOString(), endTime: new Date().toISOString(), votes: { for: 5, against: 0, abstain: 0 } }
    ];
    setActiveMotions(initialMotions);
    setVotingHistory(initialHistory);
  }, []);

  // --- EVENT HANDLERS ---
  const handleStartSession = () => {
    const sessionName = prompt('Enter session name:', `Session ${new Date().toLocaleDateString()}`);
    if (sessionName) {
      setCurrentSession({ id: Date.now(), name: sessionName, startTime: new Date().toISOString() });
    }
  };

  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end the current session? Active motions will be archived.')) {
      const remainingMotions = activeMotions.map(m => ({ ...m, status: 'expired' }));
      setVotingHistory([...remainingMotions, ...votingHistory]);
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
    const newMotion = {
      id: Date.now(),
      title: motionTitle,
      description: motionDescription,
      status: 'voting', // Start voting immediately
      createdAt: new Date().toISOString(),
      createdBy: 'user123', // Mock current user
      votes: { for: 0, against: 0, abstain: 0 },
      voters: [],
    };
    setActiveMotions([newMotion, ...activeMotions]);
    // Reset form
    setMotionTitle('');
    setMotionDescription('');
    setIsFormVisible(false);
  };

  const handleVote = (motionId, voteType) => {
    setActiveMotions(activeMotions.map(motion => {
      if (motion.id === motionId && !motion.voters.includes('user123')) {
        return {
          ...motion,
          votes: { ...motion.votes, [voteType]: motion.votes[voteType] + 1 },
          voters: [...motion.voters, 'user123'],
        };
      }
      return motion;
    }));
  };

  const handleDeleteHistory = (itemId) => {
    if (window.confirm('Are you sure you want to delete this history item?')) {
      setVotingHistory(votingHistory.filter(item => item.id !== itemId));
    }
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
          activeMotions.map(motion => <MotionCard key={motion.id} motion={motion} onVote={handleVote} />)
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