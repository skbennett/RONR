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

// --- Coordination-Specific Methods (Add these as you build the page) ---

export const getCoordinationData = () => {
    return getPageData('coordination');
};

export const updateCoordinationData = (updates) => {
    const currentData = getPageData('coordination') || {};
    const newData = { ...currentData, ...updates };
    return setPageData('coordination', newData);
};