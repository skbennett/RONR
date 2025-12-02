// /pages/Coordination.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import sb from '../services/supabaseDataManager';
import useMeetingRealtime from '../hooks/useMeetingRealtime';
import supabase from '../supabaseClient';
import './coordination.css';
import MotionCard from '../components/coordination/MotionCard';
import MotionForm from '../components/coordination/MotionForm';
import VotingHistory from '../components/coordination/VotingHistory';
import MeetingSelector from '../components/coordination/MeetingSelector';
import { formatDateTime, formatCreatedAt } from '../utils/meetingUtils';


// --- The Main Coordination Page Component ---
function Coordination() {
  // --- STATE MANAGEMENT ---
  const [currentSession, setCurrentSession] = useState(null);
  const [activeMotions, setActiveMotions] = useState([]);
  const [votingHistory, setVotingHistory] = useState([]);
  const [userMeetingsList, setUserMeetingsList] = useState([]);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [motionTitle, setMotionTitle] = useState('');
  const [motionDescription, setMotionDescription] = useState('');
  const [motionSpecial, setMotionSpecial] = useState(false);
  const { user } = useAuth();
  // Normalize current user to a string id when available (supabase user.id), or fall back to 'guest' or local username
  const currentUser = (user && (user.id || user)) || 'guest';
  const newMotionBtnRef = useRef(null);
  const motionTitleRef = useRef(null);
  // No client-side lock timers: votes finalize immediately server-side.
  // Inline sub-motion form state (mapping motionId -> visible)
  const [subFormVisible, setSubFormVisible] = useState({});
  const [subFormValues, setSubFormValues] = useState({});
  // Inline reply form state (mapping motionId -> visible)
  const [replyFormVisible, setReplyFormVisible] = useState({});
  const [replyFormValues, setReplyFormValues] = useState({});
  // Inline reply edit state (mapping replyId -> visible)
  const [replyEditVisible, setReplyEditVisible] = useState({});
  const [replyEditValues, setReplyEditValues] = useState({});
  // Refs for reply textareas so we can focus them when forms open
  const replyTextareaRefs = useRef({});
  const replyEditTextareaRefs = useRef({});
  // Inline edit form for motions
  const [editFormVisible, setEditFormVisible] = useState({});
  const [editFormValues, setEditFormValues] = useState({});
  // History discussion toggles (id -> bool)
  const [historyDiscussionOpen, setHistoryDiscussionOpen] = useState({});

  // History voters toggles (id -> bool)
  const [historyVotersOpen, setHistoryVotersOpen] = useState({});

  // Chat messages state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  const toggleHistoryDiscussion = (id) => {
    setHistoryDiscussionOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleHistoryVoters = (id) => {
    setHistoryVotersOpen(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // Helper: map motions + votes (DB shape) into the frontend shape used by this page
  const mapMotionsWithVotes = (motions, votes) => {
    const votesByMotion = {};
    (votes || []).forEach(v => {
      const mid = v.motion_id || v.motionId || v.motion;
      if (!mid) return;
      votesByMotion[mid] = votesByMotion[mid] || { for: 0, against: 0, abstain: 0, userVotes: {}, voters: [] };
      const choice = (v.choice || v.vote || '').toString().toLowerCase();
      const userId = v.user_id || v.userId || v.user;
      if (choice === 'yes') votesByMotion[mid].for++;
      else if (choice === 'no') votesByMotion[mid].against++;
      else votesByMotion[mid].abstain++;
      if (userId) {
        votesByMotion[mid].userVotes[userId] = choice === 'yes' ? 'for' : choice === 'no' ? 'against' : 'abstain';
        if (!votesByMotion[mid].voters.includes(userId)) votesByMotion[mid].voters.push(userId);
      }
    });

    return (motions || []).map(m => {
      const vm = votesByMotion[m.id] || { for: 0, against: 0, abstain: 0, userVotes: {}, voters: [] };
      return {
        ...m,
        // keep original db fields but normalize status to 'voting' for 'open'
        status: m.status === 'open' ? 'voting' : m.status,
        votes: { for: vm.for || 0, against: vm.against || 0, abstain: vm.abstain || 0 },
        userVotes: vm.userVotes,
        voters: vm.voters,
        // ensure replies field exists (motions fetched separately in DB via motion_replies)
        replies: m.replies || []
      };
    });
  };

  // Build a UI-friendly history list by merging history rows with motions and vote aggregates.
  const normalizeHistoryItems = (history, motions = [], votes = []) => {
    const motionById = {};
    (motions || []).forEach(m => { if (m && m.id) motionById[m.id] = m; });

    const votesByMotion = {};
    (votes || []).forEach(v => {
      const mid = v.motion_id || v.motionId || v.motion;
      if (!mid) return;
      votesByMotion[mid] = votesByMotion[mid] || { for: 0, against: 0, abstain: 0, userVotes: {}, voters: [] };
      const choice = (v.choice || v.vote || '').toString().toLowerCase();
      const userId = v.user_id || v.userId || v.user;
      if (choice === 'yes') votesByMotion[mid].for++;
      else if (choice === 'no') votesByMotion[mid].against++;
      else votesByMotion[mid].abstain++;
      if (userId) {
        votesByMotion[mid].userVotes[userId] = choice === 'yes' ? 'for' : choice === 'no' ? 'against' : 'abstain';
        if (!votesByMotion[mid].voters.includes(userId)) votesByMotion[mid].voters.push(userId);
      }
    });

    // Build a map keyed by motion id (or history id for standalone events) and prefer a single representative
    const itemsByKey = {};

    (history || []).forEach(h => {
      const ev = h.event || {};
      // resolve a motion id if present
      const mid = ev.motion_id || ev.motion?.id || ev.motionId || (ev.reply && (ev.reply.motion_id || ev.reply.motionId));
      const key = mid || h.id;

      // closed/ended motions are the canonical history entries we prefer
      if (h.event_type === 'motion_closed' || ev.motion_id) {
        const motion = motionById[mid] || ev.motion || {};
        const vm = votesByMotion[mid] || { for: 0, against: 0, abstain: 0, userVotes: {}, voters: [] };
        itemsByKey[key] = {
          id: mid || h.id,
          historyRowId: h.id,
          title: motion.title || ev.title || `Motion ${mid || h.id}`,
          status: ev.outcome || motion.status || 'closed',
          votes: { for: (ev.votes && (ev.votes.yes || ev.votes.for)) || vm.for || 0, against: (ev.votes && (ev.votes.no || ev.votes.against)) || vm.against || 0, abstain: (ev.votes && ev.votes.abstain) || vm.abstain || 0 },
          userVotes: vm.userVotes || {},
          voters: vm.voters || [],
          replies: motion.replies || [],
          special: motion.special || false,
          created_at: h.created_at || h.createdAt,
          raw: h,
          _kind: 'closed'
        };
        return;
      }

      // Proposed motions: only add if we don't already have a closed entry for this motion
      if (h.event_type === 'motion_proposed' && ev.motion) {
        const motion = ev.motion;
        const vm = votesByMotion[motion.id] || { for: 0, against: 0, abstain: 0, userVotes: {}, voters: [] };
        if (!itemsByKey[key] || itemsByKey[key]._kind !== 'closed') {
          itemsByKey[key] = {
            id: motion.id || h.id,
            historyRowId: h.id,
            title: motion.title || `Motion ${motion.id || h.id}`,
            status: motion.status || 'proposed',
            votes: { for: vm.for || 0, against: vm.against || 0, abstain: vm.abstain || 0 },
            userVotes: vm.userVotes || {},
            voters: vm.voters || [],
            replies: motion.replies || [],
            special: motion.special || false,
            created_at: h.created_at || h.createdAt,
            raw: h,
            _kind: itemsByKey[key]?._kind || 'proposed'
          };
        }
        return;
      }

      // Reply events: attach to the motion entry if possible, otherwise create a small reply entry
      if (h.event_type === 'reply_added' && ev.reply) {
        const r = ev.reply;
        if (mid) {
          itemsByKey[key] = itemsByKey[key] || { id: mid, historyRowId: h.id, title: motionById[mid]?.title || `Motion ${mid}`, status: 'closed', votes: votesByMotion[mid] || { for: 0, against: 0, abstain: 0 }, userVotes: (votesByMotion[mid] && votesByMotion[mid].userVotes) || {}, voters: (votesByMotion[mid] && votesByMotion[mid].voters) || [], replies: [], special: motionById[mid]?.special || false, created_at: h.created_at || h.createdAt, raw: h };
          itemsByKey[key].replies = (itemsByKey[key].replies || []).concat(r);
        } else {
          // standalone reply/history entry
          itemsByKey[key] = itemsByKey[key] || {
            id: r.id || h.id,
            historyRowId: h.id,
            title: `Reply: ${r.text?.slice(0,40) || ''}`,
            status: 'reply',
            votes: { for: 0, against: 0, abstain: 0 },
            userVotes: {},
            voters: [],
            replies: [r],
            created_at: h.created_at || h.createdAt,
            raw: h
          };
        }
        return;
      }

      // Fallback: keep one entry per history id if nothing else matched
      if (!itemsByKey[key]) {
        itemsByKey[key] = {
          id: h.id,
          title: (typeof ev === 'string' ? ev : (ev.title || ev.motion?.title || h.event_type)),
          status: h.event_type,
          votes: { for: 0, against: 0, abstain: 0 },
          userVotes: {},
          voters: [],
          replies: [],
          created_at: h.created_at || h.createdAt,
          raw: h
        };
      }
    });

    // Convert to array and sort by created_at desc (newest first). Remove internal _kind markers.
    const items = Object.values(itemsByKey).map(it => {
      const copy = { ...it };
      delete copy._kind;
      return copy;
    }).sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    return items;
  };

  // Filter mapped motions to the subset that should be shown as "active".
  // Include motions whose status is 'voting' or 'postponed', and any ancestors
  // (parents) needed to preserve the motion tree for active sub-motions.
  const filterActiveMotions = (mapped) => {
    const active = new Set((mapped || []).filter(m => ['voting', 'postponed'].includes(m.status)).map(m => m.id));
    // include ancestors of active motions
    let added = true;
    while (added) {
      added = false;
      for (const m of (mapped || [])) {
        if (m.parentId && active.has(m.id) && !active.has(m.parentId)) {
          active.add(m.parentId);
          added = true;
        }
      }
    }
    return (mapped || []).filter(m => active.has(m.id));
  };

  // --- DATA INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      // If user is signed in, prefer opening a meeting they own automatically
      try {
        if (user && user.id) {
          const { data: userMeetings, error } = await sb.getUserMeetings();
          setUserMeetingsList(userMeetings || []);
          if (!error && Array.isArray(userMeetings)) {
            // prefer meetings where the signed-in user is the owner
            const owned = userMeetings.find(m => (m.owner && m.owner === user.id) || (m.my_role && m.my_role === 'owner'));
            if (owned) {
              const sess = { 
                id: owned.id, 
                name: owned.title || owned.name || `Meeting ${owned.id}`, 
                startTime: owned.coordination?.date && owned.coordination?.time ? 
                  formatDateTime(owned.coordination.date, owned.coordination.time) :
                  formatCreatedAt(owned.created_at)
              };
              setCurrentSession(sess);
              const res = await sb.fetchMeetingData(sess.id);
              const mapped = mapMotionsWithVotes(res.motions || [], res.votes || []);
              setActiveMotions(filterActiveMotions(mapped));
              setVotingHistory(normalizeHistoryItems(res.history || [], res.motions || [], res.votes || []));
              setCurrentSession(res.meeting || sess);
              return;
            }
            // If user has meetings but none owned, pick the first they participate in
            if ((userMeetings || []).length > 0) {
              const first = userMeetings[0];
              const sess = { 
                id: first.id, 
                name: first.title || first.name || `Meeting ${first.id}`, 
                startTime: first.coordination?.date && first.coordination?.time ?
                  formatDateTime(first.coordination.date, first.coordination.time) :
                  formatCreatedAt(first.created_at)
              };
              const res = await sb.fetchMeetingData(sess.id);
              const mapped = mapMotionsWithVotes(res.motions || [], res.votes || []);
              setCurrentSession(res.meeting || sess);
              setActiveMotions(filterActiveMotions(mapped));
              setVotingHistory(normalizeHistoryItems(res.history || [], res.motions || [], res.votes || []));
              return;
            }
            // If the user has no meetings at all, create one automatically so coordination works
            const { data: created, error: createErr } = await sb.createMeeting({ title: `Meeting ${user.id.substring(0,8)}`, description: '' });
            if (!createErr && created && created.id) {
              const sess = { 
                id: created.id, 
                name: created.title || `Meeting ${created.id}`, 
                startTime: formatCreatedAt(created.created_at)
              };
              const res = await sb.fetchMeetingData(sess.id);
              const mapped = mapMotionsWithVotes(res.motions || [], res.votes || []);
              setCurrentSession(res.meeting || sess);
              setActiveMotions(filterActiveMotions(mapped));
              setVotingHistory(normalizeHistoryItems(res.history || [], res.motions || [], res.votes || []));
              return;
            }
          }
        }
      } catch (e) {
        console.warn('auto-open owned meeting failed', e);
      }
      // If we reach here and haven't returned, there's no meeting selected; leave UI empty.
    };
    init();
  }, [user]);

  

  // --- Sub-motion helpers & utilities ---
  // Utility: refresh local state from storage
  const refreshFromStorage = () => {
    // Always refresh from Supabase when a currentSession exists
    const sess = currentSession;
    if (sess && typeof sess.id === 'string') {
      (async () => {
        try {
          const res = await sb.fetchMeetingData(sess.id);
          const mapped = mapMotionsWithVotes(res.motions || [], res.votes || []);
          setActiveMotions(filterActiveMotions(mapped));
          setVotingHistory(normalizeHistoryItems(res.history || [], res.motions || [], res.votes || []));
          setChatMessages(res.chats || []);
          setCurrentSession(res.meeting || sess);
        } catch (e) {
          console.error('refreshFromStorage failed', e);
        }
      })();
    }
    };

  // Subscribe to realtime updates using reusable hook
  // The meeting_history stream is the canonical event source for all meeting changes:
  // motions, votes, chats, etc. This ensures consistency and prevents duplicate/conflicting updates.
  useMeetingRealtime(currentSession && currentSession.id, {
    onMeeting: (payload) => {
      const rec = payload.record || payload.new || payload;
      if (rec) setCurrentSession(prev => ({ ...(prev || {}), ...rec }));
    },
    onMotions: (payload) => {
      const op = (payload.eventType || payload.event || payload.type || '').toString().toUpperCase() || (payload.new ? 'INSERT' : payload.old ? 'DELETE' : 'UPDATE');
      const rec = payload.record || payload.new || payload.old || payload;
      if (!rec || !rec.id) return refreshFromStorage();
      setActiveMotions(prev => {
        try {
          if (op === 'INSERT') {
            const m = { ...rec, status: rec.status === 'open' ? 'voting' : rec.status, votes: { for: 0, against: 0, abstain: 0 }, userVotes: {}, voters: [], replies: rec.replies || [] };
            return filterActiveMotions([m].concat(prev || []));
          } else if (op === 'UPDATE') {
            return filterActiveMotions((prev || []).map(pm => pm.id === rec.id ? { ...pm, ...rec } : pm));
          } else if (op === 'DELETE') {
            return (prev || []).filter(pm => pm.id !== rec.id);
          }
        } catch (e) {
          console.error('onMotions handler failed, falling back to full refresh', e);
          refreshFromStorage();
        }
        return prev;
      });
    },
    onChats: (payload) => {
      // Handle new chat messages in real-time without full refresh
      const op = (payload.eventType || payload.event || payload.type || '').toString().toUpperCase() || (payload.new ? 'INSERT' : payload.old ? 'DELETE' : 'UPDATE');
      const rec = payload.record || payload.new || payload.old || payload;
      if (!rec || !rec.id) return refreshFromStorage();
      
      if (op === 'INSERT') {
        // Add new chat message to the list
        setChatMessages(prev => [...(prev || []), rec]);
        // Auto-scroll to bottom on new message
        setTimeout(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, 0);
      } else if (op === 'DELETE') {
        // Remove deleted chat
        setChatMessages(prev => (prev || []).filter(c => c.id !== rec.id));
      } else if (op === 'UPDATE') {
        // Update modified chat (e.g., edited message)
        setChatMessages(prev => (prev || []).map(c => c.id === rec.id ? rec : c));
      }
    },
    // meeting_history is the canonical event stream for all meeting actions
    // (motion_proposed, vote_cast, chat, motion_closed, etc.).
    // Process vote_cast events for live vote tally updates, fall back to full refresh for other events.
    onHistory: (payload) => {
      try { console.debug('[Coordination] onHistory payload', payload); } catch (e) {}
      try {
        const op = (payload.eventType || payload.event || payload.type || '').toString().toUpperCase() || (payload.new ? 'INSERT' : payload.old ? 'DELETE' : 'UPDATE');
        const rec = payload.record || payload.new || payload;
        // Only handle INSERT events (new history entries)
        if (op === 'INSERT' && rec && rec.event_type) {
          const et = (rec.event_type || '').toString();
          // vote_cast events: update vote tallies in real-time without full refresh
          if (et === 'vote_cast' && rec.event) {
            try {
              const ev = typeof rec.event === 'string' ? JSON.parse(rec.event) : rec.event;
              const mid = ev.motion_id || ev.motionId || ev.motion;
              const uid = ev.user_id || ev.userId || ev.user;
              const choice = (ev.choice || '').toString().toLowerCase();
              if (mid && uid && choice) {
                // Update activeMotions counts and voters
                setActiveMotions(prev => (prev || []).map(m => {
                  if (m.id !== mid) return m;
                  const copy = { ...m, votes: { ...(m.votes || { for: 0, against: 0, abstain: 0 }) }, userVotes: { ...(m.userVotes || {}) }, voters: Array.isArray(m.voters) ? [...m.voters] : [] };
                  const prevVote = copy.userVotes && copy.userVotes[uid];
                  const dec = (v) => { if (v === 'yes' || v === 'for') copy.votes.for = Math.max(0, (copy.votes.for || 0) - 1); else if (v === 'no' || v === 'against') copy.votes.against = Math.max(0, (copy.votes.against || 0) - 1); else copy.votes.abstain = Math.max(0, (copy.votes.abstain || 0) - 1); };
                  const inc = (v) => { if (v === 'yes' || v === 'for') copy.votes.for = (copy.votes.for || 0) + 1; else if (v === 'no' || v === 'against') copy.votes.against = (copy.votes.against || 0) + 1; else copy.votes.abstain = (copy.votes.abstain || 0) + 1; };
                  if (prevVote) dec(prevVote);
                  inc(choice);
                  copy.userVotes[uid] = (choice === 'yes' ? 'for' : choice === 'no' ? 'against' : 'abstain');
                  if (!copy.voters.includes(uid)) copy.voters.push(uid);
                  return copy;
                }));

                // Update votingHistory similarly
                setVotingHistory(prev => (prev || []).map(item => {
                  if (item.id !== mid) return item;
                  const copy = { ...item, votes: { ...(item.votes || { for: 0, against: 0, abstain: 0 }) }, userVotes: { ...(item.userVotes || {}) }, voters: Array.isArray(item.voters) ? [...item.voters] : [] };
                  const prevVote = copy.userVotes && copy.userVotes[uid];
                  const dec = (v) => { if (v === 'for') copy.votes.for = Math.max(0, (copy.votes.for || 0) - 1); else if (v === 'against') copy.votes.against = Math.max(0, (copy.votes.against || 0) - 1); else copy.votes.abstain = Math.max(0, (copy.votes.abstain || 0) - 1); };
                  const inc = (v) => { if (v === 'for') copy.votes.for = (copy.votes.for || 0) + 1; else if (v === 'against') copy.votes.against = (copy.votes.against || 0) + 1; else copy.votes.abstain = (copy.votes.abstain || 0) + 1; };
                  if (prevVote) dec(prevVote);
                  const mapped = (choice === 'yes' ? 'for' : choice === 'no' ? 'against' : 'abstain');
                  inc(mapped);
                  copy.userVotes[uid] = mapped;
                  if (!copy.voters.includes(uid)) copy.voters.push(uid);
                  return copy;
                }));
                return; // Vote event handled without full refresh
              }
            } catch (e) {
              console.error('Failed to parse vote_cast event', e);
            }
          }
        }
        // For all other history changes (motion closed, postponed, etc.), do a full refresh
        refreshFromStorage();
      } catch (e) {
        console.error('onHistory handler failed', e);
        refreshFromStorage();
      }
    },
    onAttendees: (payload) => {
      // Attendee changes can affect roles/visibility; refresh meeting state
      try { refreshFromStorage(); } catch (e) { console.error('onAttendees handler failed', e); }
    }
  });

    // Handler: user selected a meeting from the dropdown
    const handleSelectMeeting = async (meetingId) => {
      if (!meetingId) return;
      try {
        // set a lightweight current session while fetching
        setCurrentSession({ id: meetingId, name: `Meeting ${meetingId}`, startTime: new Date().toISOString() });
        const res = await sb.fetchMeetingData(meetingId);
        const mapped = mapMotionsWithVotes(res.motions || [], res.votes || []);
        setActiveMotions(filterActiveMotions(mapped));
        setVotingHistory(normalizeHistoryItems(res.history || [], res.motions || [], res.votes || []));
        setCurrentSession(res.meeting || { id: meetingId });
      } catch (e) {
        console.error('handleSelectMeeting failed', e);
        alert('Failed to select meeting');
      }
      };

  const showSubForm = (id) => setSubFormVisible(prev => ({ ...prev, [id]: true }));
  const cancelSubForm = (id) => {
    setSubFormVisible(prev => ({ ...prev, [id]: false }));
    setSubFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
  };
  const openSubFormWithDefaults = (id) => {
    setSubFormVisible(prev => ({ ...prev, [id]: true }));
    setSubFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), title: (prev[id] && prev[id].title) || '', description: (prev[id] && prev[id].description) || '', special: (prev[id] && typeof prev[id].special !== 'undefined') ? prev[id].special : false } }));
  };
  const handleSubInputChange = (id, field, value) => {
    setSubFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitSubMotion = (parentId) => {
    const vals = subFormValues[parentId] || {};
    if (!vals.title || vals.title.trim() === '') { alert('Please enter a sub-motion title.'); return; }
    // remote if currentSession looks like a meeting id
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.proposeSubMotion(currentSession.id, parentId, vals.title.trim(), (vals.description || '').trim());
        if (error) { alert('Failed to add sub-motion.'); console.error(error); return; }
        // postpone the parent motion on the server
        try { await sb.postponeMotion(parentId); } catch (e) { console.warn('failed to postpone parent motion', e); }
        setReplyFormVisible(prev => ({ ...prev, [parentId]: false }));
        cancelSubForm(parentId);
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  // --- Edit helpers ---
  const showEditForm = (id, motion) => {
    // Toggle the edit form for a motion: open with values if closed, close and clear values if open
    setEditFormVisible(prev => ({ ...prev, [id]: !prev[id] }));
    setEditFormValues(prev => {
      const copy = { ...prev };
      if (prev[id]) {
        // currently open -> close: remove stored values
        delete copy[id];
      } else {
        // currently closed -> open: populate defaults from motion
        copy[id] = { title: motion.title || '', description: motion.description || '', special: !!motion.special };
      }
      return copy;
    });
  };
  const cancelEditForm = (id) => {
    setEditFormVisible(prev => ({ ...prev, [id]: false }));
    setEditFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
  };
  const handleEditInputChange = (id, field, value) => {
    setEditFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitEdit = (motionId) => {
    const vals = editFormValues[motionId] || {};
    if (!vals.title || vals.title.trim() === '') { alert('Please enter a title.'); return; }
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.updateMotion(motionId, { title: vals.title.trim(), description: (vals.description || '').trim(), special: !!vals.special });
        if (error) { alert('Failed to update motion.'); console.error(error); return; }
        cancelEditForm(motionId);
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  // --- Reply helpers ---
  const showReplyForm = (id) => {
    // Toggle reply form: open with defaults if closed, close and clear values if open
    setReplyFormVisible(prev => ({ ...prev, [id]: !prev[id] }));
    setReplyFormValues(prev => {
      const copy = { ...prev };
      if (prev[id]) {
        // was open -> now closing: remove draft
        delete copy[id];
      } else {
        // was closed -> now opening: populate defaults
        copy[id] = { ...(prev[id] || {}), stance: (prev[id] && prev[id].stance) || 'neutral', text: (prev[id] && prev[id].text) || '' };
      }
      // If opening, focus the newly rendered textarea on next tick and move cursor to end
      setTimeout(() => {
        if (!prev[id]) {
          try {
            const el = replyTextareaRefs.current[id];
            if (el) {
              el.focus();
              const len = (el.value || '').length;
              // place caret at end
              el.setSelectionRange(len, len);
            }
          } catch (e) {}
        }
      }, 0);
      return copy;
    });
  };
  const cancelReplyForm = (id) => {
    setReplyFormVisible(prev => ({ ...prev, [id]: false }));
    setReplyFormValues(prev => { const c = { ...prev }; delete c[id]; return c; });
    // cleanup ref
    try { delete replyTextareaRefs.current[id]; } catch (e) {}
  };
  const handleReplyInputChange = (id, field, value) => {
    setReplyFormValues(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleSubmitReply = (motionId) => {
    const vals = replyFormValues[motionId] || {};
    if (!vals.text || vals.text.trim() === '') { alert('Please enter reply text.'); return; }
    // default missing stance to 'neutral' rather than showing a popup
    const stance = vals.stance || 'neutral';
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.addReply(motionId, vals.text.trim(), stance, null);
        if (error) { alert('Failed to add reply.'); console.error(error); return; }
        cancelReplyForm(motionId);
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  // --- Reply edit/delete helpers ---
  const showReplyEditForm = (motionId, reply) => {
    setReplyEditVisible(prev => ({ ...prev, [reply.id]: !prev[reply.id] }));
    setReplyEditValues(prev => {
      const copy = { ...prev };
      if (prev[reply.id]) {
        delete copy[reply.id];
      } else {
        copy[reply.id] = { motionId, text: reply.text || '', stance: reply.stance || 'neutral' };
      }
      // Focus edit textarea when opening and move cursor to end of existing text
      setTimeout(() => {
        if (!prev[reply.id]) {
          try {
            const el = replyEditTextareaRefs.current[reply.id];
            if (el) {
              el.focus();
              const len = (el.value || '').length;
              el.setSelectionRange(len, len);
            }
          } catch (e) {}
        }
      }, 0);
      return copy;
    });
  };
  const cancelReplyEdit = (replyId) => {
    setReplyEditVisible(prev => ({ ...prev, [replyId]: false }));
    setReplyEditValues(prev => { const c = { ...prev }; delete c[replyId]; return c; });
    // cleanup ref
    try { delete replyEditTextareaRefs.current[replyId]; } catch (e) {}
  };
  const handleReplyEditChange = (replyId, field, value) => {
    setReplyEditValues(prev => ({ ...prev, [replyId]: { ...(prev[replyId] || {}), [field]: value } }));
  };
  const handleSubmitReplyEdit = (replyId) => {
    const vals = replyEditValues[replyId] || {};
    if (!vals.text || vals.text.trim() === '') { alert('Please enter reply text.'); return; }
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.updateReply(replyId, vals.text.trim(), vals.stance);
        if (error) { alert('Failed to update reply.'); console.error(error); return; }
        cancelReplyEdit(replyId);
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };
  const handleDeleteReply = (motionId, replyId) => {
    if (!window.confirm('Delete this reply? This cannot be undone.')) return;
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.deleteReply(replyId);
        if (error) { alert('Failed to delete reply.'); console.error(error); return; }
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  const handlePostpone = (motionId) => {
    if (!window.confirm('Postpone decision on this motion? It will be moved to a postponed stack.')) return;
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.postponeMotion(motionId);
        if (error) { alert('Failed to postpone motion.'); console.error(error); return; }
        setReplyFormVisible(prev => ({ ...prev, [motionId]: false }));
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  const handleResumePostponed = () => {
    // Remote: find last postponed motion for this meeting and resume it
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        try {
          const data = await sb.fetchMeetingData(currentSession.id);
          const postponed = (data.motions || []).filter(m => m.status === 'postponed');
          if (!postponed || postponed.length === 0) { alert('No postponed motions to resume.'); return; }
          const last = postponed[postponed.length - 1];
          const { data: resumed, error } = await sb.resumeMotion(last.id);
          if (error) { alert('Failed to resume motion.'); console.error(error); return; }
          setReplyFormVisible(prev => ({ ...prev, [last.id]: false }));
          alert(`Resumed motion: ${last.title}`);
          refreshFromStorage();
        } catch (e) {
          console.error(e);
          alert('Failed to resume postponed motion.');
        }
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  const handleResumeSpecific = (motionId) => {
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.resumeMotion(motionId);
        if (error) { alert('Failed to resume this motion (it may not be postponed).'); console.error(error); return; }
        setReplyFormVisible(prev => ({ ...prev, [data.id]: false }));
        alert(`Resumed motion: ${data.title}`);
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  const handleEndMotion = (motionId) => {
    if (!window.confirm('End this motion now and record the outcome based on current votes?')) return;
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.endMotion(motionId);
        if (error) { alert('Failed to end motion.'); console.error(error); return; }
        // try to resume parent if provided in event (not guaranteed)
        // refresh UI
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  // --- EVENT HANDLERS ---
  const handleStartSession = () => {
    const sessionName = prompt('Enter session name:', `Session ${new Date().toLocaleDateString()}`);
    if (sessionName) {
      if (!user || !user.id) {
        alert('Sign in to create or join a meeting.');
        return;
      }
      (async () => {
        try {
          const { data, error } = await sb.createMeeting({ title: sessionName, description: '' });
          if (error || !data) { alert('Failed to create meeting'); console.error(error); return; }
          const sess = { id: data.id, name: data.title || sessionName, startTime: formatCreatedAt(data.created_at) };
          setCurrentSession(sess);
          // load meeting
          const res = await sb.fetchMeetingData(sess.id);
          const mapped = mapMotionsWithVotes(res.motions || [], res.votes || []);
          setActiveMotions(mapped);
          setVotingHistory(normalizeHistoryItems(res.history || [], res.motions || [], res.votes || []));
        } catch (e) {
          console.error('create meeting failed', e);
          alert('Failed to create meeting');
        }
      })();
    }
  };

  // Toggle the 'Propose a New Motion' form and manage keyboard focus (tab in/out)
  const handleToggleNewMotion = () => {
    if (isFormVisible) {
      setIsFormVisible(false);
      // return focus to the New Motion button
      setTimeout(() => newMotionBtnRef.current?.focus(), 0);
    } else {
      setMotionTitle('');
      setMotionDescription('');
      setMotionSpecial(false);
      setIsFormVisible(true);
      // focus the title input after the form is visible
      setTimeout(() => motionTitleRef.current?.focus(), 0);
    }
  };

  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end the current session? Active motions will be archived.')) {
      // End each active motion using the canonical end function so outcomes
      // are computed consistently (2/3 rule) and archived into history.
      if (currentSession && typeof currentSession.id === 'string') {
        // For remote meetings, call endMotion RPC for each open/postponed motion
        (async () => {
          try {
            const data = await sb.fetchMeetingData(currentSession.id);
            const ids = (data.motions || []).map(m => m.id);
            for (const id of ids) {
              try { await sb.endMotion(id); } catch (e) { console.error('Error ending motion', id, e); }
            }
          } catch (e) { console.error('Failed to fetch meeting motions to end', e); }
          refreshFromStorage();
        })();
      }
      // clear session pointer
      setCurrentSession(null);
      // close and reset the 'Propose a New Motion' form so UI is clean after ending session
      setIsFormVisible(false);
      setMotionTitle('');
      setMotionDescription('');
      setMotionSpecial(false);
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
      if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.proposeMotion(currentSession.id, motionTitle, motionDescription || '');
        if (error) { alert('Failed to propose motion.'); console.error(error); return; }
        // refresh list
        refreshFromStorage();
        setMotionTitle('');
        setMotionDescription('');
        setMotionSpecial(false);
        setIsFormVisible(false);
        setTimeout(() => newMotionBtnRef.current?.focus(), 0);
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
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
    // Map front-end vote types ('for'|'against'|'abstain') to DB choices ('yes'|'no'|'abstain')
    const map = { for: 'yes', against: 'no', abstain: 'abstain' };
    const choice = map[voteType];
    if (!choice) return;
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        const { data, error } = await sb.vote(motionId, choice);
        if (error) { alert('You have already voted on this motion or an error occurred.'); console.error(error); return; }
        refreshFromStorage();
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  const handleUndoVote = () => {
    alert('Undo/Revote is not supported in the original coordination.js. To match your existing behavior, the React page keeps one vote per user without revote. If you want revote, I can add it after.');
  };

  // New: functional undo that calls dataManager undo and refreshes UI
  const handleUndoVoteFunctional = (motionId, username) => {
    // Perform undo silently (no popups). If unable to undo, fail silently.
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        try {
          const { error } = await sb.undoVote(motionId);
          if (error) { console.warn('undoVote failed', error); return; }
          refreshFromStorage();
        } catch (e) { console.warn('undoVote error', e); }
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

const handleDeleteHistory = async (historyRowId, itemId) => {
  console.log('handleDeleteHistory called', { historyRowId, itemId });

  if (!window.confirm('Are you sure you want to delete this history item?')) return;
  
  if (!(currentSession && typeof currentSession.id === 'string')) {
    alert('No active remote meeting. Sign in or ensure a meeting exists.');
    return;
  }

  try {
    if (itemId) {
      console.log('Motion ID detected. Starting Bulk Delete for:', itemId);

      // 1. Fetch all history for this meeting to find matches
      // (Requires the SELECT policy we added!)
      const { data: rows, error: selectErr } = await supabase
        .from('meeting_history')
        .select('id, event')
        .eq('meeting_id', currentSession.id);

      if (selectErr) throw selectErr;

      // 2. Filter client-side to find every row related to this Motion ID
      const toDeleteIds = (rows || []).filter(r => {
        const ev = r.event || {};
        // Check all possible locations for the ID in your JSON
        const mid = ev.motion_id || ev.motion?.id || ev.motionId || (ev.reply && (ev.reply.motion_id || ev.reply.motionId));
        return mid === itemId;
      }).map(r => r.id);

      if (toDeleteIds.length === 0) {
        // Edge case: If we couldn't find matches by JSON, maybe fallback to single delete?
        console.warn('No matching rows found by Motion ID.');
      } else {
        console.log('Found matching rows to delete:', toDeleteIds);

        // 3. Delete them all
        const { error: delBatchErr } = await supabase
          .from('meeting_history')
          .delete()
          .in('id', toDeleteIds);

        if (delBatchErr) throw delBatchErr;

        console.log('Bulk delete complete');
        refreshFromStorage();
        return; // DONE! We skip the single delete below.
      }
    }
  } catch (e) {
    console.error('Delete flow failed:', e);
    alert('Failed to delete history item. check console for details.');
  }
};

  // Allow a member who voted FOR a historical motion to overturn it (bring it back to active)
  const handleOverturnHistory = (item) => {
    if (!currentUser) {
      alert('You must be logged in to overturn a decision.');
      return;
    }
    const uid = (user && user.id) || currentUser;
    const vote = (item.userVotes && item.userVotes[uid]) || '';
    const votedFor = ['for', 'pro'].includes((vote + '').toString().toLowerCase());
    if (!votedFor) {
      alert('Only members who voted in favor of this motion can overturn the decision.');
      return;
    }
    if (!window.confirm('Bring this motion back to active motions for a new vote?')) return;
    if (currentSession && typeof currentSession.id === 'string') {
      // create a new motion to represent the revived one
      (async () => {
        try {
          const { data: newMotion, error } = await sb.proposeMotion(currentSession.id, item.title, item.description || '');
          if (error) { alert('Failed to revive motion'); console.error(error); return; }
          refreshFromStorage();
        } catch (e) { console.error(e); alert('Failed to revive motion'); }
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm('Clear all voting history? This cannot be undone.')) return;
    if (currentSession && typeof currentSession.id === 'string') {
      (async () => {
        try {
          const { error } = await supabase.from('meeting_history').delete().match({ meeting_id: currentSession.id });
          if (error) { alert('Failed to clear history'); console.error(error); return; }
          refreshFromStorage();
        } catch (e) { console.error(e); alert('Failed to clear history'); }
      })();
    } else {
      alert('No active remote meeting. Sign in or ensure a meeting exists.');
    }
  };

  // Determine if undo is allowed for a given motion and username during the grace period
  const isUndoAllowed = (motion, username) => {
    if (!motion || !username) return false;
    // Allow undo when a pending user vote exists. Votes finalize immediately
    // in the data layer, but `userVotes` is kept for audit — presence signals
    // that an undo/retract is possible.
    return Boolean(motion.userVotes && motion.userVotes[username]);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (!currentSession || !currentSession.id) {
      alert('No active session. Please start or select a session first.');
      return;
    }
    try {
      const { data, error } = await sb.sendChat(currentSession.id, chatInput.trim());
      if (error) {
        alert('Failed to send message');
        console.error(error);
        return;
      }
      setChatInput('');
      // Auto-scroll to bottom after sending
      setTimeout(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, 0);
    } catch (e) {
      console.error('Error sending chat', e);
      alert('Failed to send message');
    }
  };

  return (
    <div className="coordination-container">
      <h2>Coordination Session</h2>

      {/* --- Session Status --- */}
      <section className="session-status">
        <h3>Session Status</h3>
        <MeetingSelector meetings={userMeetingsList} selectedMeetingId={currentSession?.id} onSelectMeeting={handleSelectMeeting} />
        <div id="session-info">
          {currentSession ? (
            <>
              <div>
                <p>Active Session: {currentSession.name}</p>
                <p style={{ fontSize: '12px', color: '#666' }}>Started: {currentSession.startTime}</p>
              </div>
              <div>
                <button ref={newMotionBtnRef} className="primary-btn" onClick={handleToggleNewMotion}>New Motion</button>
                <button className="secondary-btn" onClick={handleEndSession} style={{marginLeft: '10px'}}>End Session</button>
                {/* Manual connect/create removed — meetings are created/selected automatically for signed-in users */}
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
        <MotionForm
          motionTitleRef={motionTitleRef}
          motionTitle={motionTitle}
          setMotionTitle={setMotionTitle}
          motionDescription={motionDescription}
          setMotionDescription={setMotionDescription}
          motionSpecial={motionSpecial}
          setMotionSpecial={setMotionSpecial}
          onSubmit={handleSubmitMotion}
          onCancel={() => { setIsFormVisible(false); setMotionTitle(''); setMotionDescription(''); setMotionSpecial(false); newMotionBtnRef.current?.focus(); }}
        />
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
              const hasActiveSubmotions = activeMotions.some(m => m.parentId === motion.id);
              return (
                <div key={motion.id} style={{ marginLeft: level * 18, marginTop: 12, marginBottom: 24 }}>
                  <MotionCard
                    motion={motion}
                    onVote={handleVote}
                    onUndoVote={handleUndoVoteFunctional}
                    isUndoAllowed={(m, u) => isUndoAllowed(m, u)}
                  />
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="action-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {motion.status === 'postponed' ? (
                        <>
                          <button
                            className="primary-btn"
                            onClick={() => {
                              if (hasActiveSubmotions) {
                                alert('Cannot resume this motion while one or more sub-motions are still active. Finish or end them first.');
                                return;
                              }
                              handleResumeSpecific(motion.id);
                            }}
                            title={hasActiveSubmotions ? 'Cannot resume while sub-motions are still active. Finish or end them first.' : 'Resume this postponed motion'}
                          >
                            Resume
                          </button>
                          <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)}>End Motion</button>
                        </>
                      ) : (
                        <>
                          <button className="secondary-btn" onClick={() => showSubForm(motion.id)}>Start Sub-Motion</button>
                          {/* Always show the undo button so the affordance doesn't disappear when other actions (like creating sub-motions) occur.
                              The button is disabled when undo isn't currently allowed. */}
                          <button
                            className="secondary-btn"
                            onClick={() => handleUndoVoteFunctional(motion.id, currentUser)}
                            disabled={!isUndoAllowed(motion, currentUser)}
                            title={isUndoAllowed(motion, currentUser) ? 'Undo your pending vote' : 'Undo not available (no pending vote or vote locked)'}
                          >
                            Undo Vote
                          </button>
                          {motion.status === 'voting' && (
                            <button className="secondary-btn" onClick={() => handleEndMotion(motion.id)}>End Motion</button>
                          )}
                          <button className="secondary-btn" onClick={() => handlePostpone(motion.id)}>Postpone Decision</button>
                        </>
                      )}
          {/* Edit button shown for all motion states (moved outside the conditional) */}
          <button className="secondary-btn" onClick={() => showEditForm(motion.id, motion)}>Edit</button>
        </div>
                  </div>
                  {editFormVisible[motion.id] && (
                    <div style={{ marginTop: 8 }}>
                      <div className="edit-header"><span className="editing-label">Editing:</span></div>
                      <div className="field-pair">
                        <input className="form-input" type="text" placeholder="Title" value={editFormValues[motion.id]?.title || ''} onChange={e => handleEditInputChange(motion.id, 'title', e.target.value)} />
                        <textarea className="form-textarea" placeholder="Description (optional)" rows={3} value={editFormValues[motion.id]?.description || ''} onChange={e => handleEditInputChange(motion.id, 'description', e.target.value)} />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="primary-btn" onClick={() => handleSubmitEdit(motion.id)}>Save</button>
                        <button className="secondary-btn" onClick={() => cancelEditForm(motion.id)}>Cancel</button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, marginLeft: 6, whiteSpace: 'nowrap', height: '36px' }}>
                          <input type="checkbox" checked={editFormValues[motion.id]?.special || false} onChange={e => handleEditInputChange(motion.id, 'special', e.target.checked)} style={{ marginLeft: 6, marginTop: 0, marginBottom: 0, alignSelf: 'center' }} />
                          <span style={{ marginLeft: 6, lineHeight: '1', alignSelf: 'center' }}>Special Motion</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {subFormVisible[motion.id] && (
                    <div style={{ marginTop: 8 }}>
                      <div className="field-pair">
                        <input className="form-input" type="text" placeholder="Sub-motion title" value={subFormValues[motion.id]?.title || ''} onChange={e => handleSubInputChange(motion.id, 'title', e.target.value)} />
                        <textarea className="form-textarea" placeholder="Description (optional)" rows={4} value={subFormValues[motion.id]?.description || ''} onChange={e => handleSubInputChange(motion.id, 'description', e.target.value)} />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="primary-btn" onClick={() => handleSubmitSubMotion(motion.id)}>Submit Sub-Motion</button>
                        <button className="secondary-btn" onClick={() => cancelSubForm(motion.id)}>Cancel</button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, marginLeft: 6, whiteSpace: 'nowrap', height: '36px' }}>
                          <input type="checkbox" checked={subFormValues[motion.id]?.special || false} onChange={e => handleSubInputChange(motion.id, 'special', e.target.checked)} style={{ marginLeft: 6, marginTop: 0, marginBottom: 0, alignSelf: 'center' }} />
                          <span style={{ marginLeft: 6, lineHeight: '1', alignSelf: 'center' }}>Special Motion</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {/* Replies / Discussion (hidden when motion is postponed) */}
                    {motion.status !== 'postponed' && (
                  (!motion.special) ? (
                  <div className="motion-replies" style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <strong className="discussion-title">Discussion</strong>
                    </div>
                    {motion.replies && motion.replies.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        {motion.replies.map(r => (
                          <div key={r.id} style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={
                                  r.stance === 'pro' ? { background: '#e6f4ea', color: '#0a6b2b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 } :
                                  r.stance === 'con' ? { background: '#fdecea', color: '#a10b0b', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 } :
                                  { background: '#f2f2f2', color: '#666', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }
                                }>{r.stance.toUpperCase()}</div>
                                <div style={{ fontSize: 12, color: '#666' }}>{r.author_email || 'Unknown User'} @ {formatCreatedAt(r.created_at)}</div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
                                {r.author === currentUser && (
                                  <>
                                    <button className="secondary-btn" onClick={() => showReplyEditForm(motion.id, r)}>Edit</button>
                                    <button className="secondary-btn" onClick={() => handleDeleteReply(motion.id, r.id)}>Delete</button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div style={{ marginTop: 4 }}>
                              {replyEditVisible[r.id] ? (
                                <div>
                                  <textarea ref={el => { try { replyEditTextareaRefs.current[r.id] = el; } catch (e) {} }} className="form-textarea" rows={3} value={replyEditValues[r.id]?.text || ''} onChange={e => handleReplyEditChange(r.id, 'text', e.target.value)} />
                                  <div className="reply-controls" style={{ marginTop: 6 }}>
                                    <label className="reply-label">Stance:</label>
                                    <select value={replyEditValues[r.id]?.stance || r.stance || 'neutral'} onChange={e => handleReplyEditChange(r.id, 'stance', e.target.value)}>
                                      <option value="pro">Pro</option>
                                      <option value="con">Con</option>
                                      <option value="neutral">Neutral</option>
                                    </select>
                                  </div>
                                  <div style={{ marginTop: 6 }}>
                                    <button className="primary-btn" onClick={() => handleSubmitReplyEdit(r.id)}>Save</button>
                                    <button className="secondary-btn" onClick={() => cancelReplyEdit(r.id)} style={{ marginLeft: 8 }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div>{r.text}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>No discussion yet.</div>
                    )}
                    {/* Replies list rendered above; place Reply button at the bottom-left of the discussion area */}
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button className="secondary-btn" onClick={() => showReplyForm(motion.id)}>Reply</button>
                      </div>
                      {replyFormVisible[motion.id] && (
                        <div style={{ marginTop: 8 }}>
                          <textarea ref={el => { try { replyTextareaRefs.current[motion.id] = el; } catch (e) {} }} className="form-textarea" rows={3} placeholder="Write your reply..." value={replyFormValues[motion.id]?.text || ''} onChange={e => handleReplyInputChange(motion.id, 'text', e.target.value)} />
                          <div className="reply-controls">
                            <label className="reply-label">Stance:</label>
                            <select value={replyFormValues[motion.id]?.stance || 'neutral'} onChange={e => handleReplyInputChange(motion.id, 'stance', e.target.value)}>
                              <option value="pro">Pro</option>
                              <option value="con">Con</option>
                              <option value="neutral">Neutral</option>
                            </select>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <button className="primary-btn" onClick={() => handleSubmitReply(motion.id)}>Submit Reply</button>
                            <button className="secondary-btn" onClick={() => cancelReplyForm(motion.id)} style={{ marginLeft: 8 }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#666', fontStyle: 'italic' }}>Discussion is disabled for special motions.</div>
                  )
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
      <VotingHistory
        votingHistory={votingHistory}
        historyDiscussionOpen={historyDiscussionOpen}
        historyVotersOpen={historyVotersOpen}
        currentUser={currentUser}
        toggleHistoryDiscussion={toggleHistoryDiscussion}
        toggleHistoryVoters={toggleHistoryVoters}
        handleOverturnHistory={handleOverturnHistory}
        handleDeleteHistory={handleDeleteHistory}
        handleClearHistory={handleClearHistory}
      />

      {/* --- Chat Section --- */}
      <section className="chat-section" style={{ marginTop: '30px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
        <h3>Meeting Chat</h3>
        <div className="chat-messages" style={{ border: '1px solid #ddd', borderRadius: '8px', height: '300px', overflowY: 'auto', padding: '12px', marginBottom: '12px', backgroundColor: '#f9f9f9' }}>
          {(chatMessages && chatMessages.length > 0) ? (
            chatMessages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '12px' }}>{msg.user_email || 'Unknown User'}</strong>
                  <span style={{ fontSize: '11px', color: '#999' }}>{formatCreatedAt(msg.created_at)}</span>
                </div>
                <div style={{ fontSize: '14px', color: '#333' }}>{msg.message}</div>
              </div>
            ))
          ) : (
            <div style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', paddingTop: '130px' }}>No messages yet. Start the conversation!</div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
            disabled={!currentSession}
          />
          <button type="submit" className="primary-btn" disabled={!currentSession || !chatInput.trim()}>Send</button>
        </form>
      </section>
    </div>
  );
}

export default Coordination;
