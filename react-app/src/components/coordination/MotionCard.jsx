import React, { useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCreatedAt } from '../../utils/meetingUtils';

const MotionCard = ({ motion, onVote, onUndoVote, isUndoAllowed }) => {
  const { user } = useAuth();
  const currentUser = (user && (user.id || user)) || 'guest';
  const scheduledToArchiveRef = useRef(new Set());
  const userVote = motion.userVotes ? motion.userVotes[currentUser] : undefined;
  const hasVoted = Boolean(userVote);
  const canUndo = isUndoAllowed ? isUndoAllowed(motion, currentUser) : hasVoted;
  
  // Get proposer email from motion data
  const proposerEmail = motion.proposer_email || 'Unknown User';
  const createdAt = formatCreatedAt(motion.created_at || motion.createdAt);
  
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
        Proposed by: {proposerEmail} | {createdAt}
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

export default MotionCard;
