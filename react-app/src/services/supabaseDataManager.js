import supabase from '../supabaseClient';

// Supabase-backed data manager for meetings, motions, votes, chats and subscriptions.
// This file provides helper functions you can call from your React components.

async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

export async function createMeeting({ title, description = '', status = 'scheduled', coordination = {} }) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('meetings')
    .insert({ title, description, status, owner: user.id, coordination })
    .select()
    .single();
  // If title uniqueness violated, normalize the error for the client
  if (error) {
    // Postgres unique violation code is '23505' but Supabase may return a message
    const msg = (error.code === '23505' || (error.message || '').toLowerCase().includes('duplicate')) ? 'Meeting title already exists. Choose a different title.' : error.message || JSON.stringify(error);
    return { data: null, error: { ...error, message: msg } };
  }

  if (!error && data) {
    // ensure the meeting creator is added as an attendee (owner/chair)
    try {
      await supabase.from('meeting_attendees').upsert({
        meeting_id: data.id,
        user_id: user.id,
        role: 'owner',
        joined_at: new Date().toISOString()
      }, { onConflict: 'meeting_id,user_id' }).select();
    } catch (e) {
      // non-fatal: don't prevent meeting creation if attendee upsert fails
      console.error('Failed to create meeting_attendees row for owner', e);
    }
  }

  return { data, error: null };
}

export async function inviteUser(meetingId, inviteeId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  // create invitation (audit) and an attendee row with role 'invited'
  // create only the invitation (do not pre-create meeting_attendees row)
  // fetch meeting title to denormalize into the invitation row
  let meetingTitle = null;
  try {
    const { data: mdata, error: mErr } = await supabase.from('meetings').select('title').eq('id', meetingId).single();
    if (!mErr && mdata) meetingTitle = mdata.title || null;
  } catch (e) {
    console.error('Failed to fetch meeting title for invitation', e);
  }

  // capture inviter email from the authenticated user object (if present)
  const inviterEmail = user?.email || null;

  const { data, error } = await supabase.from('invitations').insert({
    meeting_id: meetingId,
    invitee: inviteeId,
    inviter: user.id,
    status: 'pending',
    meeting_title: meetingTitle,
    inviter_email: inviterEmail
  }).select().single();

  return { data, error };
}

// Invite by email using Postgres RPC `invite_user_by_email` (defined in Supabase SQL)
export async function inviteUserByEmail(meetingId, inviteeEmail) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  // call the RPC which will validate the caller and perform the insert as SECURITY DEFINER
  const { data, error } = await supabase.rpc('invite_user_by_email', { meeting: meetingId, invite_email: inviteeEmail });
  return { data, error };
}

export async function getMyInvitations() {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('invitations').select('*').eq('invitee', user.id).order('created_at', { ascending: false });
  return { data, error };
}

export async function declineInvite(meetingId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  // remove the invitation row
  const { error } = await supabase.from('invitations').delete().match({ meeting_id: meetingId, invitee: user.id });
  if (error) return { error };

  // remove any invited attendee row for this user
  const { error: attErr } = await supabase.from('meeting_attendees').delete().match({ meeting_id: meetingId, user_id: user.id });
  return { error: attErr || null };
}

export async function acceptInvite(meetingId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('meeting_attendees').upsert({
    meeting_id: meetingId,
    user_id: user.id,
    role: 'member',
    joined_at: new Date().toISOString()
    }, { onConflict: 'meeting_id,user_id' }).select();

  if (!error) {
    // remove the invitation row since the invite has been accepted
    const { error: delErr, data: delData } = await supabase.from('invitations').delete().match({ meeting_id: meetingId, invitee: user.id });
    if (delErr) {
      // log and return a helpful error so UI can surface it
      console.error('Failed to delete invitation after accept:', delErr);
      return { data, error: delErr };
    }
  }

  return { data, error };
}

export async function getUserMeetings() {
  const user = await getUser();
  if (!user) return { data: null, error: new Error('Not authenticated') };

  // fetch attendee rows for this user to get meeting ids and roles
  const { data: attendees, error: attErr } = await supabase
    .from('meeting_attendees')
    .select('meeting_id, role')
    .eq('user_id', user.id);

  if (attErr) return { data: null, error: attErr };
  const meetingIds = attendees.map((a) => a.meeting_id).filter(Boolean);
  if (meetingIds.length === 0) return { data: [], error: null };

  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .in('id', meetingIds)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error };

  // merge role into meeting objects
  const roleByMeeting = {};
  attendees.forEach(a => { roleByMeeting[a.meeting_id] = a.role; });
  const merged = (meetings || []).map(m => ({ ...m, my_role: roleByMeeting[m.id] || null }));
  return { data: merged, error: null };
}

// Fetch attendees for a meeting via SECURITY DEFINER RPC which enforces authorization
export async function getMeetingAttendees(meetingId) {
  const { data, error } = await supabase.rpc('get_meeting_attendees', { meeting: meetingId });
  return { data, error };
}

// Remove an attendee from a meeting via SECURITY DEFINER RPC (owner or chair)
export async function removeMeetingAttendee(meetingId, attendeeId) {
  const { data, error } = await supabase.rpc('remove_meeting_attendee', { meeting: meetingId, attendee: attendeeId });
  return { data, error };
}

export async function leaveMeeting(meetingId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('meeting_attendees').delete().match({ meeting_id: meetingId, user_id: user.id });
  return { error };
}

export async function deleteMeeting(meetingId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  // perform a delete of the meeting row. The RPC / policies should ensure only authorized callers can delete.
  // This will cascade according to your DB constraints; if you require explicit cleanup, update this logic.
  // request the deleted rows back so the client can confirm deletion
  const { data, error } = await supabase.from('meetings').delete().match({ id: meetingId }).select();
  return { data: data || null, error };
}

export async function exportMeetingMinutes(meetingId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  // fetch meeting history ordered chronologically
  const [{ data: history, error: histErr }, attendeesRes] = await Promise.all([
    supabase
      .from('meeting_history')
      .select('created_at, event_type, event')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true }),
    // reuse existing RPC to fetch attendees with emails if available
    getMeetingAttendees(meetingId)
  ]);

  // getMeetingAttendees returns { data, error }
  const attendees = attendeesRes?.data || [];
  const error = histErr || attendeesRes?.error || null;
  return { data: { history: history || [], attendees }, error };
}

// Helper: fetch user emails by user IDs
async function fetchUserEmails(userIds) {
  if (!userIds || userIds.length === 0) return {};
  
  // Deduplicate
  const uniqueIds = [...new Set(userIds)];
  
  // Fetch from auth.users using RLS-safe admin query
  // Since we can't directly query auth.users from the client, we'll use a cached approach
  // Store emails in a client-side cache
  const emailCache = {};
  
  // For now, we'll return the userIds and rely on client-side data where available
  // In production, you might want to create a users_profile table and sync emails
  return emailCache;
}

// fetch meeting data (motions, votes, chats, history) in one call set
export async function fetchMeetingData(meetingId) {
  const meetingP = supabase.from('meetings').select('*').eq('id', meetingId).single();
  const motionsP = supabase.from('motions').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
  const chatsP = supabase.from('chats').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
  const historyP = supabase.from('meeting_history').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
  const attendeesP = getMeetingAttendees(meetingId);

  const [{ data: meeting }, { data: motions }, { data: chats }, { data: history }, attendeesRes] = await Promise.all([meetingP, motionsP, chatsP, historyP, attendeesP]);

  // Build email map from attendees
  let emailMap = {};
  if (attendeesRes && attendeesRes.data) {
    (attendeesRes.data || []).forEach(a => {
      if (a.user_id && a.email) {
        emailMap[a.user_id] = a.email;
      }
    });
  }

  // Collect all unique user IDs from motions, replies, and chats
  const uniqueUserIds = new Set();
  (motions || []).forEach(m => {
    if (m.proposer) uniqueUserIds.add(m.proposer);
  });
  (chats || []).forEach(c => {
    if (c.user_id) uniqueUserIds.add(c.user_id);
  });

  // Also fetch all motion replies to get authors
  const motionIds = (motions || []).map(m => m.id);
  let replies = [];
  if (motionIds.length) {
    const { data: r } = await supabase.from('motion_replies').select('*').in('motion_id', motionIds).order('created_at', { ascending: true });
    replies = r || [];
    (replies || []).forEach(r => {
      if (r.author) uniqueUserIds.add(r.author);
    });
  }

  // Fetch emails for any users not in attendee list
  const missingUserIds = Array.from(uniqueUserIds).filter(id => !emailMap[id]);
  if (missingUserIds.length > 0) {
    // Query auth.users via RPC or via meeting_attendees (if they're attendees)
    // For now, try to get them from meeting_attendees as a fallback
    const { data: additionalAttendees } = await supabase.rpc('get_meeting_attendees', { meeting: meetingId });
    if (additionalAttendees) {
      (additionalAttendees || []).forEach(a => {
        if (a.user_id && a.email) {
          emailMap[a.user_id] = a.email;
        }
      });
    }
  }

  // attach vote counts per motion
  let votes = [];
  if (motionIds.length) {
    const { data: v } = await supabase.from('votes').select('*').in('motion_id', motionIds);
    votes = v || [];
  }

  // Enrich motions with proposer emails
  const motionsWithReplies = (motions || []).map(m => {
    const motionReplies = (replies || []).filter(rr => rr.motion_id === m.id);
    // Enrich replies with author emails
    const enrichedReplies = motionReplies.map(r => ({
      ...r,
      author_email: emailMap[r.author] || 'Unknown User'
    }));
    return {
      ...m,
      proposer_email: emailMap[m.proposer] || 'Unknown User',
      replies: enrichedReplies
    };
  });

  // Enrich chats with user emails
  const enrichedChats = (chats || []).map(c => ({
    ...c,
    user_email: emailMap[c.user_id] || 'Unknown User'
  }));

  return { meeting, motions: motionsWithReplies, votes, chats: enrichedChats, history: history || [] };
}

export async function proposeMotion(meetingId, title, description = '') {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('motions').insert({
    meeting_id: meetingId,
    title,
    description,
    proposer: user.id
  }).select().single();

  if (!error) {
    await supabase.from('meeting_history').insert({ meeting_id: meetingId, event_type: 'motion_proposed', event: { motion: data } });
  }

  return { data, error };
}

// propose a sub-motion (parent_id optional)
export async function proposeSubMotion(meetingId, parentId, title, description = '') {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('motions').insert({
    meeting_id: meetingId,
    parent_id: parentId,
    title,
    description,
    proposer: user.id
  }).select().single();
  if (!error) {
    await supabase.from('meeting_history').insert({ meeting_id: meetingId, event_type: 'submotion_proposed', event: { motion: data } });
  }
  return { data, error };
}

// Replies (discussion) for motions
export async function addReply(motionId, text, stance = 'neutral', parentReplyId = null) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('motion_replies').insert({
    motion_id: motionId,
    parent_reply_id: parentReplyId,
    author: user.id,
    text,
    stance
  }).select().single();
  if (!error) {
    // log to meeting history
    const meetingId = (await _meetingIdForMotion(motionId));
    await supabase.from('meeting_history').insert({ meeting_id: meetingId, event_type: 'reply_added', event: { reply: data } });
  }
  return { data, error };
}

export async function updateReply(replyId, text, stance) {
  const { data, error } = await supabase.from('motion_replies').update({ text, stance }).match({ id: replyId }).select().single();
  return { data, error };
}

export async function deleteReply(replyId) {
  const { data, error } = await supabase.from('motion_replies').delete().match({ id: replyId }).select().single();
  return { data, error };
}

export async function updateMotion(motionId, fields = {}) {
  const { data, error } = await supabase.from('motions').update(fields).match({ id: motionId }).select().single();
  if (!error) {
    const meetingId = data.meeting_id;
    await supabase.from('meeting_history').insert({ meeting_id: meetingId, event_type: 'motion_updated', event: { motion: data } });
  }
  return { data, error };
}

export async function postponeMotion(motionId) {
  const { data, error } = await supabase.from('motions').update({ status: 'postponed' }).match({ id: motionId }).select().single();
  if (!error) {
    await supabase.from('meeting_history').insert({ meeting_id: data.meeting_id, event_type: 'motion_postponed', event: { motion_id: motionId, at: new Date().toISOString() } });
  }
  return { data, error };
}

export async function resumeMotion(motionId) {
  const { data, error } = await supabase.from('motions').update({ status: 'open' }).match({ id: motionId }).select().single();
  if (!error) {
    await supabase.from('meeting_history').insert({ meeting_id: data.meeting_id, event_type: 'motion_resumed', event: { motion_id: motionId, at: new Date().toISOString() } });
  }
  return { data, error };
}

export async function endMotion(motionId) {
  // call RPC end_motion
  const { data, error } = await supabase.rpc('end_motion', { motion: motionId });
  return { data, error };
}

export async function undoVote(motionId) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('votes').delete().match({ motion_id: motionId, user_id: user.id });
  if (!error) {
    const meetingId = await _meetingIdForMotion(motionId);
    await supabase.from('meeting_history').insert({ meeting_id: meetingId, event_type: 'vote_removed', event: { motion_id: motionId, user_id: user.id, at: new Date().toISOString() } });
  }
  return { error };
}

export async function vote(motionId, choice) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  if (!['yes','no','abstain'].includes(choice)) throw new Error('Invalid choice');

  const { data, error } = await supabase.from('votes').upsert({
    motion_id: motionId,
    user_id: user.id,
    choice
  }, { onConflict: 'motion_id,user_id' }).select();

  if (!error) {
    await supabase.from('meeting_history').insert({ meeting_id: (await _meetingIdForMotion(motionId)), event_type: 'vote_cast', event: { motion_id: motionId, user_id: user.id, choice, at: new Date().toISOString() } });
  }

  return { data, error };
}

async function _meetingIdForMotion(motionId) {
  const { data, error } = await supabase.from('motions').select('meeting_id').eq('id', motionId).single();
  return data?.meeting_id || null;
}

export async function sendChat(meetingId, message, meta = {}) {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('chats').insert({
    meeting_id: meetingId,
    user_id: user.id,
    message,
    meta
  }).select().single();

  if (!error) {
    await supabase.from('meeting_history').insert({ meeting_id: meetingId, event_type: 'chat', event: { chat: data } });
  }

  return { data, error };
}

// Subscribe to meeting-specific realtime events. handlers: { onMeeting, onMotions, onHistory, onChats, onAttendees }
export function subscribeToMeeting(meetingId, handlers = {}) {
  const channel = supabase.channel(`meeting:${meetingId}`);
  console.log(`[sb] Creating realtime channel for meeting ${meetingId}`);

  if (handlers.onMeeting) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `id=eq.${meetingId}` }, payload => {
      console.log('[sb] onMeeting payload:', payload);
      handlers.onMeeting(payload);
    });
  }
  if (handlers.onMotions) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'motions', filter: `meeting_id=eq.${meetingId}` }, payload => {
      console.log('[sb] onMotions payload:', payload);
      handlers.onMotions(payload);
    });
  }
  if (handlers.onChats) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `meeting_id=eq.${meetingId}` }, payload => {
      console.log('[sb] onChats payload:', payload);
      handlers.onChats(payload);
    });
  }
  // Listen to canonical meeting_history rows for this meeting. Many actions write into
  // meeting_history (votes, chat, motion lifecycle events). Subscribing here lets the
  // client update a single canonical stream and then fetch as-needed.
  if (handlers.onHistory) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_history', filter: `meeting_id=eq.${meetingId}` }, payload => {
      console.log('[sb] onHistory payload:', payload);
      handlers.onHistory(payload);
    });
  }
  if (handlers.onAttendees) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_attendees', filter: `meeting_id=eq.${meetingId}` }, payload => {
      console.log('[sb] onAttendees payload:', payload);
      handlers.onAttendees(payload);
    });
  }

  channel.subscribe((status) => {
    console.log(`[sb] Channel subscription status for meeting ${meetingId}:`, status);
    if (status === 'SUBSCRIBED') {
      console.log(`[sb] Successfully subscribed to meeting ${meetingId}`);
    } else if (status === 'CHANNEL_ERROR') {
      console.error(`[sb] Channel error for meeting ${meetingId}`);
    } else if (status === 'TIMED_OUT') {
      console.error(`[sb] Channel subscription timed out for meeting ${meetingId}`);
    }
  });
  
  return channel;
}

export async function downloadMinutes(meetingId) {
  const meetingP = supabase.from('meetings').select('*').eq('id', meetingId).single();
  const motionsP = supabase.from('motions').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
  const chatsP = supabase.from('chats').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });
  const historyP = supabase.from('meeting_history').select('*').eq('meeting_id', meetingId).order('created_at', { ascending: true });

  const [{ data: meeting }, { data: motions }, { data: chats }, { data: history }] = await Promise.all([meetingP, motionsP, chatsP, historyP]);

  // fetch votes for each motion
  const motionIds = (motions || []).map(m => m.id);
  let votes = [];
  if (motionIds.length) {
    const { data: v } = await supabase.from('votes').select('*').in('motion_id', motionIds);
    votes = v || [];
  }

  // fetch motion replies and attach to motions
  let replies = [];
  if (motionIds.length) {
    const { data: r } = await supabase.from('motion_replies').select('*').in('motion_id', motionIds).order('created_at', { ascending: true });
    replies = r || [];
  }

  const motionsWithReplies = (motions || []).map(m => ({ ...m, replies: (replies || []).filter(rr => rr.motion_id === m.id) }));

  const minutes = { meeting, motions: motionsWithReplies, votes, chats, history };
  return minutes;
}

export async function transferChair(meetingId, fromUserId, toUserId) {
  const { data, error } = await supabase.rpc('transfer_chair', { meeting: meetingId, from_user: fromUserId, to_user: toUserId });
  return { data, error };
}

// utility: subscribe to this user's attendee rows to learn invitations/joined changes
export function subscribeToMyAttendees(userId, handler) {
  const channel = supabase.channel(`user:${userId}:attendees`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_attendees', filter: `user_id=eq.${userId}` }, payload => handler(payload))
    .subscribe();
  return channel;
}

export default {
  createMeeting,
  inviteUser,
  inviteUserByEmail,
  getMyInvitations,
  declineInvite,
  acceptInvite,
  getUserMeetings,
  fetchMeetingData,
  proposeMotion,
  proposeSubMotion,
  vote,
  undoVote,
  addReply,
  updateReply,
  deleteReply,
  updateMotion,
  postponeMotion,
  resumeMotion,
  endMotion,
  sendChat,
  subscribeToMeeting,
  downloadMinutes,
  leaveMeeting,
  getMeetingAttendees,
  removeMeetingAttendee,
  transferChair,
  subscribeToMyAttendees
};
