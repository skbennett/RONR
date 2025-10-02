// Coordination page logic for CourtOrder
document.addEventListener("DOMContentLoaded", () => {
    // Wait for data manager to be available
    if (typeof window.dataManager === 'undefined') {
        setTimeout(() => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }, 100);
        return;
    }

    // DOM elements
    const sessionInfo = document.getElementById('session-info');
    const startSessionBtn = document.getElementById('start-session-btn');
    const motionForm = document.getElementById('motion-form');
    const motionTitle = document.getElementById('motion-title');
    const motionDescription = document.getElementById('motion-description');
    const submitMotionBtn = document.getElementById('submit-motion-btn');
    const cancelMotionBtn = document.getElementById('cancel-motion-btn');
    const motionsContainer = document.getElementById('motions-container');
    const historyContainer = document.getElementById('history-container');

    let currentSession = null;

    // Initialize page
    function init() {
        loadSessionState();
        renderMotions();
        renderHistory();
        setupEventListeners();
    }

    // Setup event listeners
    function setupEventListeners() {
        startSessionBtn.addEventListener('click', startSession);
        submitMotionBtn.addEventListener('click', submitMotion);
        cancelMotionBtn.addEventListener('click', cancelMotion);
    }

    // Load session state
    function loadSessionState() {
        const data = window.dataManager.getPageData('coordination');
        currentSession = data.currentSession;
        updateSessionDisplay();
    }

    // Update session display
    function updateSessionDisplay() {
        if (currentSession) {
            sessionInfo.innerHTML = `
                <div>
                    <p>Active Session: ${currentSession.name}</p>
                    <p style="font-size: 12px; color: #666;">Started: ${new Date(currentSession.startTime).toLocaleString()}</p>
                </div>
                <div>
                    <button id="new-motion-btn" class="primary-btn">New Motion</button>
                    <button id="end-session-btn" class="secondary-btn">End Session</button>
                </div>
            `;
            
            // Add event listeners for new buttons
            document.getElementById('new-motion-btn').addEventListener('click', showMotionForm);
            document.getElementById('end-session-btn').addEventListener('click', endSession);
        } else {
            sessionInfo.innerHTML = `
                <p>No active session</p>
                <button id="start-session-btn" class="primary-btn">Start New Session</button>
            `;
            document.getElementById('start-session-btn').addEventListener('click', startSession);
        }
    }

    // Start new session
    function startSession() {
        const sessionName = prompt('Enter session name:') || `Session ${new Date().toLocaleDateString()}`;
        
        currentSession = {
            id: Date.now(),
            name: sessionName,
            startTime: new Date().toISOString(),
            moderator: window.dataManager.getCurrentUser()
        };

        window.dataManager.updatePageData('coordination', { currentSession });
        updateSessionDisplay();
    }

    // End session
    function endSession() {
        if (confirm('Are you sure you want to end the current session?')) {
            // Move active motions to history
            const data = window.dataManager.getPageData('coordination');
            const activeMotions = data.activeMotions || [];
            
            activeMotions.forEach(motion => {
                if (motion.status === 'voting') {
                    motion.status = 'expired';
                    motion.endTime = new Date().toISOString();
                }
            });

            // Clear session and update data
            window.dataManager.updatePageData('coordination', {
                currentSession: null,
                votingHistory: [...(data.votingHistory || []), ...activeMotions.filter(m => m.status !== 'pending')],
                activeMotions: []
            });

            currentSession = null;
            updateSessionDisplay();
            renderMotions();
            renderHistory();
        }
    }

    // Show motion form
    function showMotionForm() {
        if (!currentSession) {
            alert('Please start a session first.');
            return;
        }
        motionForm.style.display = 'block';
        motionTitle.focus();
    }

    // Cancel motion
    function cancelMotion() {
        motionForm.style.display = 'none';
        motionTitle.value = '';
        motionDescription.value = '';
    }

    // Submit motion
    function submitMotion() {
        const title = motionTitle.value.trim();
        const description = motionDescription.value.trim();

        if (!title) {
            alert('Please enter a motion title.');
            return;
        }

        if (!currentSession) {
            alert('No active session. Please start a session first.');
            return;
        }

        // Create motion using data manager
        const motion = window.dataManager.addMotion({
            title,
            description,
            sessionId: currentSession.id
        });

        // Start voting immediately
        setTimeout(() => {
            startVoting(motion.id);
        }, 1000);

        cancelMotion();
        renderMotions();
    }

    // Start voting on a motion
    function startVoting(motionId) {
        const data = window.dataManager.getPageData('coordination');
        const motion = data.activeMotions.find(m => m.id === motionId);
        
        if (motion) {
            motion.status = 'voting';
            motion.votingStartTime = new Date().toISOString();
            window.dataManager.setPageData('coordination', data);
            renderMotions();
        }
    }

    // Vote on motion
    function voteOnMotion(motionId, vote) {
        const currentUser = window.dataManager.getCurrentUser();
        
        if (window.dataManager.voteOnMotion(motionId, vote, currentUser)) {
            renderMotions();
            
            // Check if motion should be resolved
            setTimeout(() => {
                checkMotionResolution(motionId);
            }, 500);
        } else {
            alert('You have already voted on this motion.');
        }
    }

    // Check if motion should be resolved
    function checkMotionResolution(motionId) {
        const data = window.dataManager.getPageData('coordination');
        const motion = data.activeMotions.find(m => m.id === motionId);
        
        if (!motion || motion.status !== 'voting') return;

        const totalVotes = motion.votes.for + motion.votes.against + motion.votes.abstain;
        
        // Simple resolution: motion passes if more for than against
        if (totalVotes >= 1) { // Minimum votes to resolve (can be adjusted)
            if (motion.votes.for > motion.votes.against) {
                motion.status = 'passed';
            } else if (motion.votes.against > motion.votes.for) {
                motion.status = 'failed';
            }
            
            if (motion.status !== 'voting') {
                motion.endTime = new Date().toISOString();
                
                // Move to history after a delay
                setTimeout(() => {
                    moveMotionToHistory(motionId);
                }, 3000);
            }
        }
        
        window.dataManager.setPageData('coordination', data);
        renderMotions();
    }

    // Move motion to history
    function moveMotionToHistory(motionId) {
        const data = window.dataManager.getPageData('coordination');
        const motionIndex = data.activeMotions.findIndex(m => m.id === motionId);
        
        if (motionIndex !== -1) {
            const motion = data.activeMotions.splice(motionIndex, 1)[0];
            data.votingHistory = data.votingHistory || [];
            data.votingHistory.unshift(motion); // Add to beginning
            
            window.dataManager.setPageData('coordination', data);
            renderMotions();
            renderHistory();
        }
    }

    // Render active motions
    function renderMotions() {
        const data = window.dataManager.getPageData('coordination');
        const activeMotions = data.activeMotions || [];

        if (activeMotions.length === 0) {
            motionsContainer.innerHTML = '<p class="no-motions">No active motions</p>';
            return;
        }

        motionsContainer.innerHTML = activeMotions.map(motion => {
            const currentUser = window.dataManager.getCurrentUser();
            const hasVoted = motion.voters && motion.voters.includes(currentUser);
            
            return `
                <div class="motion-card">
                    <div class="motion-header">
                        <div class="motion-title">${motion.title}</div>
                        <div class="motion-status ${motion.status}">${motion.status}</div>
                    </div>
                    ${motion.description ? `<div class="motion-description">${motion.description}</div>` : ''}
                    <div class="motion-meta">
                        Proposed by: ${motion.createdBy} | ${new Date(motion.createdAt).toLocaleString()}
                    </div>
                    ${motion.status === 'voting' ? `
                        <div class="voting-section">
                            <div class="vote-counts">
                                <div class="vote-count">
                                    <span>For:</span>
                                    <span class="count">${motion.votes.for}</span>
                                </div>
                                <div class="vote-count">
                                    <span>Against:</span>
                                    <span class="count">${motion.votes.against}</span>
                                </div>
                                <div class="vote-count">
                                    <span>Abstain:</span>
                                    <span class="count">${motion.votes.abstain}</span>
                                </div>
                            </div>
                            <div class="vote-buttons">
                                <button class="vote-btn for" onclick="voteOnMotion(${motion.id}, 'for')" ${hasVoted ? 'disabled' : ''}>
                                    Vote For
                                </button>
                                <button class="vote-btn against" onclick="voteOnMotion(${motion.id}, 'against')" ${hasVoted ? 'disabled' : ''}>
                                    Vote Against
                                </button>
                                <button class="vote-btn abstain" onclick="voteOnMotion(${motion.id}, 'abstain')" ${hasVoted ? 'disabled' : ''}>
                                    Abstain
                                </button>
                            </div>
                            ${hasVoted ? '<p style="font-size: 12px; color: #666; margin-top: 10px;">You have voted on this motion.</p>' : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Render voting history
    function renderHistory() {
        const data = window.dataManager.getPageData('coordination');
        const history = data.votingHistory || [];

        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="no-history">No voting history</p>';
            return;
        }

        historyContainer.innerHTML = `
            <div class="history-controls">
                <button id="clear-history-btn" class="secondary-btn" style="margin-bottom: 15px;">Clear All History</button>
            </div>
            ${history.slice(0, 10).map((motion, index) => `
                <div class="history-item">
                    <div class="history-header">
                        <div class="history-title">${motion.title}</div>
                        <div class="history-actions">
                            <div class="history-result ${motion.status}">${motion.status}</div>
                            <button class="delete-history-btn" onclick="deleteHistoryItem(${index})" title="Delete this item">×</button>
                        </div>
                    </div>
                    <div class="history-votes">
                        For: ${motion.votes.for} | Against: ${motion.votes.against} | Abstain: ${motion.votes.abstain}
                    </div>
                    <div style="font-size: 11px; color: #888; margin-top: 5px;">
                        ${new Date(motion.createdAt).toLocaleString()}
                        ${motion.endTime ? ` - ${new Date(motion.endTime).toLocaleString()}` : ''}
                    </div>
                </div>
            `).join('')}
        `;

        // Add event listener for clear all button
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', clearAllHistory);
        }
    }

    // Delete individual history item
    function deleteHistoryItem(index) {
        if (confirm('Are you sure you want to delete this history item?')) {
            const data = window.dataManager.getPageData('coordination');
            data.votingHistory = data.votingHistory || [];
            data.votingHistory.splice(index, 1);
            window.dataManager.setPageData('coordination', data);
            renderHistory();
        }
    }

    // Clear all history
    function clearAllHistory() {
        if (confirm('Are you sure you want to clear all voting history? This action cannot be undone.')) {
            const data = window.dataManager.getPageData('coordination');
            data.votingHistory = [];
            window.dataManager.setPageData('coordination', data);
            renderHistory();
        }
    }

    // Make functions globally available
    window.voteOnMotion = voteOnMotion;
    window.deleteHistoryItem = deleteHistoryItem;
    window.clearAllHistory = clearAllHistory;

    // Initialize the page
    init();
});
