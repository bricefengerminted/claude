import { RRWebEvent, EventType, IncrementalSource, MouseInteractions } from '../types'

/**
 * Adjust timing of rrweb events to create professional pacing.
 *
 * - Compresses long pauses (e.g., when the user was thinking)
 * - Adds brief pauses after clicks (for readability)
 * - Applies playback speed multiplier
 * - Ensures minimum spacing between events
 */
export function adjustTiming(
  events: RRWebEvent[],
  maxPauseMs: number,
  playbackSpeed: number,
): RRWebEvent[] {
  if (events.length < 2) return events;

  const postClickPause = 300;   // brief pause after clicks so viewers can see what happened
  const minEventGap = 8;        // minimum ms between events (~120fps)

  let timeShift = 0;
  let lastClickTimestamp = -Infinity;

  const adjusted: RRWebEvent[] = events.map((event, i) => {
    if (i === 0) {
      return { ...event };
    }

    const prevOriginal = events[i - 1].timestamp;
    const currOriginal = event.timestamp;
    let gap = currOriginal - prevOriginal;

    // Compress long pauses
    if (gap > maxPauseMs) {
      const compressed = maxPauseMs * 0.3; // compress to 30% of max
      timeShift += gap - compressed;
      gap = compressed;
    }

    // Add post-click pause if this event comes right after a click
    const timeSinceClick = currOriginal - lastClickTimestamp;
    if (timeSinceClick > 0 && timeSinceClick < postClickPause) {
      const extraPause = postClickPause - timeSinceClick;
      timeShift -= extraPause; // negative shift = add time
    }

    // Track clicks
    if (
      event.type === EventType.IncrementalSnapshot &&
      event.data?.source === IncrementalSource.MouseInteraction &&
      event.data?.type === MouseInteractions.Click
    ) {
      lastClickTimestamp = currOriginal;
    }

    // Apply speed multiplier to the gap
    const adjustedGap = Math.max(minEventGap, gap / playbackSpeed);
    const originalGap = currOriginal - prevOriginal;
    timeShift += originalGap - adjustedGap;

    return {
      ...event,
      timestamp: Math.round(currOriginal - timeShift),
    };
  });

  // Normalize so first event starts at timestamp 0 (relative)
  if (adjusted.length > 0) {
    const baseTime = adjusted[0].timestamp;
    if (baseTime !== events[0].timestamp) {
      const offset = events[0].timestamp - baseTime;
      for (const evt of adjusted) {
        evt.timestamp += offset;
      }
    }
  }

  return adjusted;
}

/**
 * Remove dead time at the start and end of a recording.
 * Trims events where nothing meaningful is happening.
 */
export function trimDeadTime(events: RRWebEvent[]): RRWebEvent[] {
  if (events.length < 10) return events;

  // Find first meaningful interaction (mouse move, click, or scroll)
  let startIdx = 0;
  for (let i = 0; i < events.length; i++) {
    if (
      events[i].type === EventType.IncrementalSnapshot &&
      (events[i].data?.source === IncrementalSource.MouseMove ||
        events[i].data?.source === IncrementalSource.MouseInteraction ||
        events[i].data?.source === IncrementalSource.Scroll)
    ) {
      // Keep a few events before the first interaction for context
      startIdx = Math.max(0, i - 3);
      break;
    }
  }

  // Find last meaningful interaction
  let endIdx = events.length - 1;
  for (let i = events.length - 1; i >= 0; i--) {
    if (
      events[i].type === EventType.IncrementalSnapshot &&
      (events[i].data?.source === IncrementalSource.MouseMove ||
        events[i].data?.source === IncrementalSource.MouseInteraction ||
        events[i].data?.source === IncrementalSource.Scroll)
    ) {
      // Keep a few events after the last interaction
      endIdx = Math.min(events.length - 1, i + 3);
      break;
    }
  }

  // Always keep full snapshot and meta events from the beginning
  const preamble = events
    .slice(0, startIdx)
    .filter(
      (e) =>
        e.type === EventType.FullSnapshot ||
        e.type === EventType.Meta ||
        e.type === EventType.DomContentLoaded ||
        e.type === EventType.Load
    );

  return [...preamble, ...events.slice(startIdx, endIdx + 1)];
}
