import { useEffect, useRef } from 'react';
import sb from '../services/supabaseDataManager';

// useMeetingRealtime subscribes to the Supabase realtime channel for a meeting
// handlers: { onMeeting, onMotions, onVotes, onChats, onAttendees }
export default function useMeetingRealtime(meetingId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!meetingId) return undefined;

    const channel = sb.subscribeToMeeting(meetingId, {
      onMeeting: (p) => handlersRef.current.onMeeting && handlersRef.current.onMeeting(p),
      onMotions: (p) => handlersRef.current.onMotions && handlersRef.current.onMotions(p),
      onVotes: (p) => handlersRef.current.onVotes && handlersRef.current.onVotes(p),
      onChats: (p) => handlersRef.current.onChats && handlersRef.current.onChats(p),
      onAttendees: (p) => handlersRef.current.onAttendees && handlersRef.current.onAttendees(p)
    });

    return () => {
      try {
        if (channel && typeof channel.unsubscribe === 'function') channel.unsubscribe();
      } catch (e) { /* ignore */ }
    };
  }, [meetingId]);
}
