// /dataManager.js
// This file manages data storage and retrieval for the application using localStorage.
const STORAGE_PREFIX = 'courtorder_';

// --- Helper Functions ---
const getPageData = (pageName) => {
    try {
        const data = localStorage.getItem(`${STORAGE_PREFIX}${pageName}`);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error(`Error loading data for page ${pageName}:`, e);
        return null;
    }
};

const setPageData = (pageName, data) => {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${pageName}`, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error(`Error saving data for page ${pageName}:`, e);
        return false;
    }
};

const getCurrentUser = () => {
    try {
        const authData = JSON.parse(localStorage.getItem('courtorder_auth'));
        return authData && authData.isLoggedIn ? authData.username : 'anonymous';
    } catch (e) {
        return 'anonymous';
    }
};


// --- Main Exported Functions ---

export const initializeAllData = () => {
    // Initialize default data if it doesn't exist for each page
    if (!getPageData('meetings')) {
        setPageData('meetings', {
            originalMeetings: [
                { id: 1, title: "Board Meeting", date: "2025-01-15", time: "15:00", joined: false, createdBy: "system" },
                { id: 2, title: "Finance Committee", date: "2025-01-20", time: "10:00", joined: false, createdBy: "system" },
                { id: 3, title: "Planning Commission", date: "2025-01-25", time: "14:30", joined: false, createdBy: "system" },
                { id: 4, title: "Public Safety Review", date: "2025-01-30", time: "16:00", joined: false, createdBy: "system" },
            ],
            userMeetings: [],
            temporarilyRemoved: [],
            nextMeetingId: 5,
        });
    } else {
        // Reset temporarily removed meetings on page load
        const data = getPageData('meetings');
        if (data && data.temporarilyRemoved) {
            data.temporarilyRemoved = [];
            setPageData('meetings', data);
        }
    }

    if (!getPageData('coordination')) {
        setPageData('coordination', {
            activeMotions: [],
            votingHistory: [],
            currentSession: null,
            nextMotionId: 1,
        });
    }
};

// --- Meetings-Specific Methods ---

export const getAllMeetings = () => {
    const data = getPageData('meetings');
    if (!data) return [];
    
    // Filter out temporarily removed system meetings
    const activeSystemMeetings = data.originalMeetings.filter(meeting => 
        !data.temporarilyRemoved || !data.temporarilyRemoved.includes(meeting.id)
    );
    
    return [...activeSystemMeetings, ...data.userMeetings];
};

export const addMeeting = (meetingData) => {
    const data = getPageData('meetings');
    if (!data) return null;

    const newMeeting = {
        id: data.nextMeetingId++,
        ...meetingData,
        joined: false,
        createdBy: getCurrentUser(),
    };
    
    data.userMeetings.push(newMeeting);
    setPageData('meetings', data);
    return newMeeting;
};

export const updateMeeting = (meetingId, updates) => {
    const data = getPageData('meetings');
    if (!data) return false;

    // Check user meetings
    let meeting = data.userMeetings.find(m => m.id === meetingId);
    if (meeting) {
        Object.assign(meeting, updates);
        setPageData('meetings', data);
        return true;
    }

    // Check and update original meetings (only 'joined' status)
    meeting = data.originalMeetings.find(m => m.id === meetingId);
    if (meeting) {
        meeting.joined = updates.joined;
        setPageData('meetings', data);
        return true;
    }
    
    return false;
};

export const deleteMeeting = (meetingId) => {
    const data = getPageData('meetings');
    if (!data) return false;

    // Check if it's a system meeting - if so, add to temporarily removed list
    const systemMeeting = data.originalMeetings.find(m => m.id === meetingId);
    if (systemMeeting) {
        if (!data.temporarilyRemoved) {
            data.temporarilyRemoved = [];
        }
        data.temporarilyRemoved.push(meetingId);
        setPageData('meetings', data);
        return true;
    }

    // For user meetings, actually delete them
    const initialLength = data.userMeetings.length;
    data.userMeetings = data.userMeetings.filter(m => m.id !== meetingId);
    
    if (data.userMeetings.length < initialLength) {
        setPageData('meetings', data);
        return true;
    }
    return false;
};

// --- Coordination-Specific Methods ---

export const getCoordinationData = () => {
    return getPageData('coordination');
};

export const updateCoordinationData = (updates) => {
    const currentData = getPageData('coordination') || {};
    const newData = { ...currentData, ...updates };
    return setPageData('coordination', newData);
};

export const addCoordinationMotion = ({ title, description, sessionId }) => {
    const data = getPageData('coordination');
    if (!data) return null;
    const id = data.nextMotionId++;
    const motion = {
        id,
        title,
        description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: getCurrentUser(),
        sessionId,
        votes: { for: 0, against: 0, abstain: 0 },
        voters: [],
    };
    data.activeMotions.unshift(motion);
    setPageData('coordination', data);
    return motion;
};

export const startVotingForMotion = (motionId) => {
    const data = getPageData('coordination');
    if (!data) return false;
    const motion = data.activeMotions.find(m => m.id === motionId);
    if (!motion) return false;
    motion.status = 'voting';
    motion.votingStartTime = new Date().toISOString();
    return setPageData('coordination', data);
};

export const voteOnCoordinationMotion = (motionId, vote, username) => {
    const data = getPageData('coordination');
    if (!data) return false;
    const motion = data.activeMotions.find(m => m.id === motionId);
    if (!motion || motion.status !== 'voting') return false;
    if (!['for', 'against', 'abstain'].includes(vote)) return false;
    motion.voters = motion.voters || [];
    motion.userVotes = motion.userVotes || {};
    // If user already finalized (locked), block further changes
    if (motion.voters.includes(username)) return false;
    motion.votes = motion.votes || { for: 0, against: 0, abstain: 0 };
    // If user had a pending vote (not locked), adjust counts
    const prior = motion.userVotes[username];
    if (prior) {
        if (prior !== vote) {
            motion.votes[prior] = Math.max(0, (motion.votes[prior] || 0) - 1);
            motion.votes[vote] = (motion.votes[vote] || 0) + 1;
            motion.userVotes[username] = vote;
        }
    } else {
        motion.votes[vote] = (motion.votes[vote] || 0) + 1;
        motion.userVotes[username] = vote;
    }
    return setPageData('coordination', data);
};

export const undoVoteOnCoordinationMotion = (motionId, username) => {
    const data = getPageData('coordination');
    if (!data) return false;
    const motion = data.activeMotions.find(m => m.id === motionId);
    if (!motion || motion.status !== 'voting') return false;
    motion.voters = motion.voters || [];
    // If already locked, cannot undo
    if (motion.voters.includes(username)) return false;
    motion.userVotes = motion.userVotes || {};
    const prior = motion.userVotes[username];
    if (!prior) return false;
    motion.votes = motion.votes || { for: 0, against: 0, abstain: 0 };
    motion.votes[prior] = Math.max(0, (motion.votes[prior] || 0) - 1);
    delete motion.userVotes[username];
    return setPageData('coordination', data);
};

export const finalizeVoteLockOnCoordinationMotion = (motionId, username) => {
    const data = getPageData('coordination');
    if (!data) return false;
    const motion = data.activeMotions.find(m => m.id === motionId);
    if (!motion || motion.status !== 'voting') return false;
    motion.voters = motion.voters || [];
    motion.userVotes = motion.userVotes || {};
    if (!motion.userVotes[username]) return false; // nothing to lock
    if (!motion.voters.includes(username)) {
        motion.voters.push(username);
    }
    return setPageData('coordination', data);
};