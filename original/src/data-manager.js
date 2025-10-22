// Data management system for CourtOrder pages
class DataManager {
    constructor() {
        this.STORAGE_PREFIX = 'courtorder_';
        this.initializePageData();
    }

    // Initialize default data for all pages
    initializePageData() {
        // Home page data
        if (!this.getPageData('home')) {
            this.setPageData('home', {
                welcomeMessage: 'Welcome to CourtOrder',
                recentActivity: [],
                userPreferences: {
                    theme: 'default',
                    notifications: true
                }
            });
        }

        // Meetings page data
        if (!this.getPageData('meetings')) {
            this.setPageData('meetings', {
                originalMeetings: [
                    { id: 1, title: "Board Meeting", date: "2025-09-25", time: "15:00", joined: false, status: "upcoming", createdBy: "system" },
                    { id: 2, title: "Finance Committee", date: "2025-09-27", time: "10:00", joined: false, status: "upcoming", createdBy: "system" },
                    { id: 3, title: "Annual General Assembly", date: "2025-10-02", time: "13:00", joined: false, status: "upcoming", createdBy: "system" },
                    { id: 4, title: "Project Planning", date: "2025-10-05", time: "16:30", joined: false, status: "upcoming", createdBy: "system" }
                ],
                userMeetings: [],
                nextMeetingId: 5,
                filters: {
                    showPast: false,
                    showJoined: true,
                    showUpcoming: true
                }
            });
        }

        // Coordination page data
        if (!this.getPageData('coordination')) {
            this.setPageData('coordination', {
                activeMotions: [],
                votingHistory: [],
                currentSession: null,
                participants: [],
                nextMotionId: 1,
                sessionSettings: {
                    allowAnonymousVoting: false,
                    requireSecond: true,
                    votingTimeLimit: 300 // 5 minutes
                }
            });
        }
    }

    // Get data for a specific page
    getPageData(pageName) {
        try {
            const data = localStorage.getItem(`${this.STORAGE_PREFIX}${pageName}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`Error loading data for page ${pageName}:`, e);
            return null;
        }
    }

    // Set data for a specific page
    setPageData(pageName, data) {
        try {
            localStorage.setItem(`${this.STORAGE_PREFIX}${pageName}`, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Error saving data for page ${pageName}:`, e);
            return false;
        }
    }

    // Update specific field in page data
    updatePageData(pageName, updates) {
        const currentData = this.getPageData(pageName) || {};
        const newData = { ...currentData, ...updates };
        return this.setPageData(pageName, newData);
    }

    // Clear all data for a page
    clearPageData(pageName) {
        localStorage.removeItem(`${this.STORAGE_PREFIX}${pageName}`);
    }

    // Clear all application data
    clearAllData() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        this.initializePageData();
    }

    // Export all data
    exportData() {
        const data = {};
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.STORAGE_PREFIX)) {
                const pageName = key.replace(this.STORAGE_PREFIX, '');
                data[pageName] = this.getPageData(pageName);
            }
        });
        return data;
    }

    // Import data
    importData(data) {
        try {
            Object.keys(data).forEach(pageName => {
                this.setPageData(pageName, data[pageName]);
            });
            return true;
        } catch (e) {
            console.error('Error importing data:', e);
            return false;
        }
    }

    // Meetings-specific methods
    addMeeting(meetingData) {
        const data = this.getPageData('meetings');
        const newMeeting = {
            id: data.nextMeetingId++,
            ...meetingData,
            joined: false,
            status: 'upcoming',
            createdBy: this.getCurrentUser(),
            createdAt: new Date().toISOString()
        };
        
        data.userMeetings.push(newMeeting);
        this.setPageData('meetings', data);
        return newMeeting;
    }

    updateMeeting(meetingId, updates) {
        const data = this.getPageData('meetings');
        
        // Check user meetings first
        const userMeetingIndex = data.userMeetings.findIndex(m => m.id === meetingId);
        if (userMeetingIndex !== -1) {
            data.userMeetings[userMeetingIndex] = { ...data.userMeetings[userMeetingIndex], ...updates };
            this.setPageData('meetings', data);
            return true;
        }
        
        // Check original meetings (limited updates allowed)
        const originalMeetingIndex = data.originalMeetings.findIndex(m => m.id === meetingId);
        if (originalMeetingIndex !== -1) {
            // Only allow certain fields to be updated for original meetings
            const allowedUpdates = { joined: updates.joined };
            data.originalMeetings[originalMeetingIndex] = { ...data.originalMeetings[originalMeetingIndex], ...allowedUpdates };
            this.setPageData('meetings', data);
            return true;
        }
        
        return false;
    }

    deleteMeeting(meetingId) {
        const data = this.getPageData('meetings');
        const initialLength = data.userMeetings.length;
        data.userMeetings = data.userMeetings.filter(m => m.id !== meetingId);
        
        if (data.userMeetings.length < initialLength) {
            this.setPageData('meetings', data);
            return true;
        }
        return false;
    }

    getAllMeetings() {
        const data = this.getPageData('meetings');
        return [...data.originalMeetings, ...data.userMeetings];
    }

    // Coordination-specific methods
    addMotion(motionData) {
        const data = this.getPageData('coordination');
        const newMotion = {
            id: data.nextMotionId++,
            ...motionData,
            status: 'pending',
            votes: { for: 0, against: 0, abstain: 0 },
            voters: [],
            createdBy: this.getCurrentUser(),
            createdAt: new Date().toISOString()
        };
        
        data.activeMotions.push(newMotion);
        this.setPageData('coordination', data);
        return newMotion;
    }

    voteOnMotion(motionId, vote, voter) {
        const data = this.getPageData('coordination');
        const motion = data.activeMotions.find(m => m.id === motionId);
        
        if (!motion || motion.voters.includes(voter)) {
            return false; // Motion not found or user already voted
        }
        
        motion.votes[vote]++;
        motion.voters.push(voter);
        
        this.setPageData('coordination', data);
        return true;
    }

    // Helper method to get current user
    getCurrentUser() {
        try {
            const authData = JSON.parse(localStorage.getItem('courtorder_auth'));
            return authData && authData.isLoggedIn ? authData.username : 'anonymous';
        } catch (e) {
            return 'anonymous';
        }
    }
}

// Global data manager instance
window.dataManager = new DataManager();
