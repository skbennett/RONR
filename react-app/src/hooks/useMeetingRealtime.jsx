import { useEffect, useRef } from 'react';
import sb from '../services/supabaseDataManager';

// useMeetingRealtime subscribes to the Supabase realtime channel for a meeting
// handlers: { onMeeting, onMotions, onHistory, onChats, onAttendees }
export default function useMeetingRealtime(meetingId, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!meetingId) return undefined;

    console.log('[useMeetingRealtime] Setting up subscription for meeting:', meetingId);

    const channel = sb.subscribeToMeeting(meetingId, {
      onMeeting: (p) => handlersRef.current.onMeeting && handlersRef.current.onMeeting(p),
      onMotions: (p) => handlersRef.current.onMotions && handlersRef.current.onMotions(p),
      onHistory: (p) => handlersRef.current.onHistory && handlersRef.current.onHistory(p),
      onChats: (p) => handlersRef.current.onChats && handlersRef.current.onChats(p),
      onAttendees: (p) => handlersRef.current.onAttendees && handlersRef.current.onAttendees(p)
    });

    return () => {
      try {
        console.log('[useMeetingRealtime] Cleaning up subscription for meeting:', meetingId);
        if (channel && typeof channel.unsubscribe === 'function') channel.unsubscribe();
      } catch (e) { /* ignore */ }
    };
  }, [meetingId]);
}
