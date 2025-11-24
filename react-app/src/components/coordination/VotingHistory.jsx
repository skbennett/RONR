import React from 'react';

const VotingHistory = ({ votingHistory, historyDiscussionOpen, historyVotersOpen, currentUser, toggleHistoryDiscussion, toggleHistoryVoters, handleOverturnHistory, handleDeleteHistory, handleClearHistory }) => {
  return (
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
                {(item.userVotes && ['for', 'pro'].includes(((item.userVotes[currentUser]||'') + '').toString().toLowerCase())) && (
                  <button className="primary-btn" onClick={() => handleOverturnHistory(item)}>Overturn</button>
                )}
                <button className="delete-history-btn" title="Delete this item" onClick={() => handleDeleteHistory(item.historyRowId || null, item.id)}>×</button>
              </div>
            </div>
            <div className="history-votes">
              For: {item.votes.for} | Against: {item.votes.against} | Abstain: {item.votes.abstain}
            </div>

            {historyDiscussionOpen[item.id] && (
              <div className="motion-replies" style={{ marginTop: 10 }}>
                <div className="history-title" style={{ fontSize: 13, marginBottom: 8 }}>Discussion</div>
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
  );
};

export default VotingHistory;
