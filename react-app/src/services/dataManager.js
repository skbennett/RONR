// /dataManager.js
// This file manages data storage and retrieval for the application using localStorage.
const STORAGE_PREFIX = "courtorder_";

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
    const authData = JSON.parse(localStorage.getItem("courtorder_auth"));
    return authData && authData.isLoggedIn ? authData.username : "anonymous";
  } catch (e) {
    return "anonymous";
  }
};

// --- Main Exported Functions ---

export const initializeAllData = () => {
  // Initialize default data if it doesn't exist for each page
  if (!getPageData("meetings")) {
    setPageData("meetings", {
      originalMeetings: [
        {
          id: 1,
          title: "Board Meeting",
          date: "2025-01-15",
          time: "15:00",
          joined: false,
          createdBy: "system",
        },
        {
          id: 2,
          title: "Finance Committee",
          date: "2025-01-20",
          time: "10:00",
          joined: false,
          createdBy: "system",
        },
        {
          id: 3,
          title: "Planning Commission",
          date: "2025-01-25",
          time: "14:30",
          joined: false,
          createdBy: "system",
        },
        {
          id: 4,
          title: "Public Safety Review",
          date: "2025-01-30",
          time: "16:00",
          joined: false,
          createdBy: "system",
        },
      ],
      userMeetings: [],
      temporarilyRemoved: [],
      nextMeetingId: 5,
    });
  } else {
    // Reset temporarily removed meetings on page load
    const data = getPageData("meetings");
    if (data && data.temporarilyRemoved) {
      data.temporarilyRemoved = [];
      setPageData("meetings", data);
    }
  }

  if (!getPageData("coordination")) {
    setPageData("coordination", {
      activeMotions: [],
      votingHistory: [],
      currentSession: null,
      nextMotionId: 1,
      nextReplyId: 1,
      postponedStack: [],
    });
  }
};

// --- Meetings-Specific Methods ---

export const getAllMeetings = () => {
  const data = getPageData("meetings");
  if (!data) return [];

  // Filter out temporarily removed system meetings
  const activeSystemMeetings = data.originalMeetings.filter(
    (meeting) =>
      !data.temporarilyRemoved || !data.temporarilyRemoved.includes(meeting.id)
  );

  return [...activeSystemMeetings, ...data.userMeetings];
};

export const addMeeting = (meetingData) => {
  const data = getPageData("meetings");
  if (!data) return null;

  const newMeeting = {
    id: data.nextMeetingId++,
    ...meetingData,
    joined: false,
    createdBy: getCurrentUser(),
  };

  data.userMeetings.push(newMeeting);
  setPageData("meetings", data);
  return newMeeting;
};

export const updateMeeting = (meetingId, updates) => {
  const data = getPageData("meetings");
  if (!data) return false;

  // Check user meetings
  let meeting = data.userMeetings.find((m) => m.id === meetingId);
  if (meeting) {
    Object.assign(meeting, updates);
    setPageData("meetings", data);
    return true;
  }

  // Check and update original meetings (only 'joined' status)
  meeting = data.originalMeetings.find((m) => m.id === meetingId);
  if (meeting) {
    meeting.joined = updates.joined;
    setPageData("meetings", data);
    return true;
  }

  return false;
};

export const deleteMeeting = (meetingId) => {
  const data = getPageData("meetings");
  if (!data) return false;

  // Check if it's a system meeting - if so, add to temporarily removed list
  const systemMeeting = data.originalMeetings.find((m) => m.id === meetingId);
  if (systemMeeting) {
    if (!data.temporarilyRemoved) {
      data.temporarilyRemoved = [];
    }
    data.temporarilyRemoved.push(meetingId);
    setPageData("meetings", data);
    return true;
  }

  // For user meetings, actually delete them
  const initialLength = data.userMeetings.length;
  data.userMeetings = data.userMeetings.filter((m) => m.id !== meetingId);

  if (data.userMeetings.length < initialLength) {
    setPageData("meetings", data);
    return true;
  }
  return false;
};

// --- Coordination-Specific Methods ---

export const getCoordinationData = () => {
  return getPageData("coordination");
};

export const updateCoordinationData = (updates) => {
  const currentData = getPageData("coordination") || {};
  const newData = { ...currentData, ...updates };
  return setPageData("coordination", newData);
};

export const addCoordinationMotion = ({
  title,
  description,
  sessionId,
  special = false,
}) => {
  const data = getPageData("coordination");
  if (!data) return null;
  const id = data.nextMotionId++;
  const motion = {
    id,
    title,
    description,
    // special: when true, this motion does not allow discussion or replies
    special: Boolean(special),
    status: "pending",
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUser(),
    sessionId,
    votes: { for: 0, against: 0, abstain: 0 },
    voters: [],
    replies: [],
  };
  data.activeMotions.unshift(motion);
  setPageData("coordination", data);
  return motion;
};

// Add a reply to a motion (supports optional parentReplyId for threaded replies)
export const addCoordinationReply = ({
  motionId,
  parentReplyId = null,
  text,
  stance,
}) => {
  const data = getPageData("coordination");
  if (!data) return null;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion) return null;
  const id = data.nextReplyId++;
  const reply = {
    id,
    motionId,
    parentReplyId: parentReplyId || null,
    text: (text || "").trim(),
    stance: stance || "neutral", // 'pro' | 'con' | 'neutral'
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUser(),
  };
  motion.replies = motion.replies || [];
  motion.replies.push(reply);
  setPageData("coordination", data);
  return reply;
};

export const startVotingForMotion = (motionId) => {
  const data = getPageData("coordination");
  if (!data) return false;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion) return false;
  motion.status = "voting";
  motion.votingStartTime = new Date().toISOString();
  return setPageData("coordination", data);
};

export const voteOnCoordinationMotion = (motionId, vote, username) => {
  const data = getPageData("coordination");
  if (!data) return false;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion || motion.status !== "voting") return false;
  if (!["for", "against", "abstain"].includes(vote)) return false;
  motion.voters = motion.voters || [];
  motion.userVotes = motion.userVotes || {};
  // If user already finalized (locked), block further changes until they Undo
  if (motion.voters.includes(username)) return false;
  // Record vote counts and mark the vote as finalized immediately so the
  // user cannot switch selections without first using Undo Vote.
  motion.votes = motion.votes || { for: 0, against: 0, abstain: 0 };
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

  // Immediately finalize/lock this user's vote (require explicit Undo to retract)
  if (!motion.voters.includes(username)) motion.voters.push(username);

  return setPageData("coordination", data);
};

export const undoVoteOnCoordinationMotion = (motionId, username) => {
  const data = getPageData("coordination");
  if (!data) return false;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion || motion.status !== "voting") return false;
  motion.voters = motion.voters || [];
  motion.userVotes = motion.userVotes || {};
  // Determine prior vote (if any). We allow undo if the user has a recorded userVote.
  // In some scenarios the vote may have been 'finalized' into voters but userVotes
  // was left in-place for audit; allow undo as long as userVotes still exist.
  const prior = motion.userVotes[username];
  if (!prior) return false;
  motion.votes = motion.votes || { for: 0, against: 0, abstain: 0 };
  // decrement the tally for the prior vote
  motion.votes[prior] = Math.max(0, (motion.votes[prior] || 0) - 1);
  // remove recorded pending vote
  delete motion.userVotes[username];
  // if the user was already added to the voters (finalized), remove them there too
  const iv = motion.voters.indexOf(username);
  if (iv !== -1) {
    motion.voters.splice(iv, 1);
  }
  return setPageData("coordination", data);
};

export const finalizeVoteLockOnCoordinationMotion = (motionId, username) => {
  const data = getPageData("coordination");
  if (!data) return false;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion || motion.status !== "voting") return false;
  motion.voters = motion.voters || [];
  motion.userVotes = motion.userVotes || {};
  if (!motion.userVotes[username]) return false; // nothing to lock
  if (!motion.voters.includes(username)) {
    motion.voters.push(username);
  }
  return setPageData("coordination", data);
};

// --- Sub-motion & Postpone/Resume ---
export const addCoordinationSubMotion = ({
  parentId,
  title,
  description,
  sessionId,
  special = false,
}) => {
  const data = getPageData("coordination");
  if (!data) return null;
  const id = data.nextMotionId++;
  const motion = {
    id,
    parentId: parentId || null,
    title,
    description,
    special: Boolean(special),
    status: "pending",
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUser(),
    sessionId,
    votes: { for: 0, against: 0, abstain: 0 },
    voters: [],
  };
  data.activeMotions.unshift(motion);
  // Add child reference on parent for convenience
  if (parentId) {
    const parent = data.activeMotions.find((m) => m.id === parentId);
    if (parent) {
      parent.submotions = parent.submotions || [];
      parent.submotions.push(id);
    }
  }
  setPageData("coordination", data);
  return motion;
};

export const postponeCoordinationMotion = (motionId) => {
  const data = getPageData("coordination");
  if (!data) return false;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion) return false;
  // Reset vote state when postponing: clear tallies and any per-user vote locks
  motion.status = "postponed";
  motion.votes = { for: 0, against: 0, abstain: 0 };
  motion.userVotes = {};
  motion.voters = [];
  // clear voting start time when postponed
  if (motion.votingStartTime) delete motion.votingStartTime;
  data.postponedStack = data.postponedStack || [];
  // push onto stack
  data.postponedStack.push(motionId);
  return setPageData("coordination", data);
};

export const resumeLastPostponedCoordinationMotion = () => {
  const data = getPageData("coordination");
  if (!data) return null;
  data.postponedStack = data.postponedStack || [];
  const last = data.postponedStack.pop();
  if (!last) return null;
  const motion = data.activeMotions.find((m) => m.id === last);
  if (!motion) return null;
  // resume directly into voting so it becomes active immediately
  motion.status = "voting";
  motion.votingStartTime = new Date().toISOString();
  setPageData("coordination", data);
  return motion;
};

export const resumeSpecificPostponedCoordinationMotion = (motionId) => {
  const data = getPageData("coordination");
  if (!data) return null;
  data.postponedStack = data.postponedStack || [];
  const idx = data.postponedStack.lastIndexOf(motionId);
  if (idx === -1) return null;
  // remove that specific entry from the stack
  data.postponedStack.splice(idx, 1);
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion) return null;
  // Resume directly into voting so the motion becomes active immediately
  motion.status = "voting";
  motion.votingStartTime = new Date().toISOString();
  setPageData("coordination", data);
  return motion;
};

export const updateCoordinationMotion = (motionId, updates) => {
  const data = getPageData("coordination");
  if (!data) return null;
  const motion = data.activeMotions.find((m) => m.id === motionId);
  if (!motion) return null;
  // Only allow title/description edits via this helper; ignore other fields unless explicitly provided
  if (updates.title !== undefined) motion.title = updates.title;
  if (updates.description !== undefined)
    motion.description = updates.description;
  if (updates.special !== undefined) motion.special = Boolean(updates.special);
  motion.updatedAt = new Date().toISOString();
  motion.updatedBy = getCurrentUser();
  setPageData("coordination", data);
  return motion;
};

export const endCoordinationMotion = (motionId) => {
  const data = getPageData("coordination");
  if (!data) return null;
  data.activeMotions = data.activeMotions || [];
  const idx = data.activeMotions.findIndex((m) => m.id === motionId);
  if (idx === -1) return null;
  // remove the main motion
  const [main] = data.activeMotions.splice(idx, 1);
  if (!main) return null;
  // Determine outcome for the main motion using 2/3 rule excluding abstains
  const forVotes = (main.votes && main.votes.for) || 0;
  const againstVotes = (main.votes && main.votes.against) || 0;
  const abstainVotes = (main.votes && main.votes.abstain) || 0;
  const totalDecisive = forVotes + againstVotes; // exclude abstain
  let outcome = null;
  if (totalDecisive > 0) {
    const threshold = Math.ceil((2 / 3) * totalDecisive);
    outcome = forVotes >= threshold ? "passed" : "failed";
  } else {
    // No decisive votes -> failed by default
    outcome = "failed";
  }
  main.status = outcome;
  main.endTime = new Date().toISOString();

  // Collect descendants (recursive) and remove them from activeMotions
  const toArchive = [main];
  const queue = [main.id];
  while (queue.length) {
    const pid = queue.shift();
    // find immediate children
    const children = data.activeMotions.filter((m) => m.parentId === pid);
    for (const child of children) {
      const cidx = data.activeMotions.findIndex((m) => m.id === child.id);
      if (cidx !== -1) {
        const [removed] = data.activeMotions.splice(cidx, 1);
        queue.push(removed.id);
        // determine archival status for descendant
        // determine archival status for descendant using same 2/3 rule (exclude abstain)
        const rFor = (removed.votes && removed.votes.for) || 0;
        const rAgainst = (removed.votes && removed.votes.against) || 0;
        const rDecisive = rFor + rAgainst;
        if (rDecisive > 0) {
          const rThreshold = Math.ceil((2 / 3) * rDecisive);
          removed.status = rFor >= rThreshold ? "passed" : "failed";
        } else {
          removed.status = "failed";
        }
        removed.endTime = new Date().toISOString();
        // finalize any pending userVotes into voters for archive
        removed.voters = removed.voters || [];
        if (removed.userVotes) {
          Object.keys(removed.userVotes).forEach((u) => {
            if (!removed.voters.includes(u)) removed.voters.push(u);
          });
          // once finalized, we can leave userVotes as-is or remove; keep for audit
        }
        // remove any references from postponedStack
        if (data.postponedStack) {
          data.postponedStack = data.postponedStack.filter(
            (id) => id !== removed.id
          );
        }
        toArchive.push(removed);
      }
    }
  }
  // finalize main's pending votes into voters as well
  main.voters = main.voters || [];
  if (main.userVotes) {
    Object.keys(main.userVotes).forEach((u) => {
      if (!main.voters.includes(u)) main.voters.push(u);
    });
  }
  if (data.postponedStack) {
    data.postponedStack = data.postponedStack.filter((id) => id !== main.id);
  }
  // Persist archived items (most recent first)
  data.votingHistory = data.votingHistory || [];
  // unshift so main appears first followed by its descendants
  for (const item of toArchive) {
    data.votingHistory.unshift(item);
  }

  setPageData("coordination", data);
  return main;
};
