import { RRWebEvent, EnhancementSettings } from '../types'
import { smoothCursor } from './smooth-cursor'
import { smoothScroll } from './smooth-scroll'
import { adjustTiming, trimDeadTime } from './timing'

/**
 * Main enhancement pipeline.
 *
 * Takes raw rrweb events and applies a series of transformations
 * to produce polished, marketing-ready demo recordings.
 *
 * Pipeline order matters:
 * 1. Trim dead time (remove idle start/end)
 * 2. Smooth cursor (clean up mouse jitter)
 * 3. Smooth scroll (normalize scroll behavior)
 * 4. Adjust timing (compress pauses, set pacing)
 */
export function enhanceRecording(
  rawEvents: RRWebEvent[],
  settings: EnhancementSettings,
): RRWebEvent[] {
  if (rawEvents.length === 0) return rawEvents;

  // Deep clone to avoid mutating originals
  let events: RRWebEvent[] = JSON.parse(JSON.stringify(rawEvents));

  // Step 1: Trim dead time at start/end
  events = trimDeadTime(events);

  // Step 2: Smooth cursor movements
  events = smoothCursor(events, settings.cursorSmoothing);

  // Step 3: Normalize scrolling
  events = smoothScroll(events, settings.scrollSmoothing);

  // Step 4: Adjust timing and pacing
  events = adjustTiming(events, settings.maxPauseMs, settings.playbackSpeed);

  return events;
}

/**
 * Get enhancement stats for displaying to the user.
 */
export function getEnhancementStats(
  raw: RRWebEvent[],
  enhanced: RRWebEvent[],
): {
  originalDuration: number;
  enhancedDuration: number;
  eventsRemoved: number;
  eventsAdded: number;
  timeSaved: number;
} {
  const originalDuration =
    raw.length > 1 ? raw[raw.length - 1].timestamp - raw[0].timestamp : 0;
  const enhancedDuration =
    enhanced.length > 1
      ? enhanced[enhanced.length - 1].timestamp - enhanced[0].timestamp
      : 0;

  return {
    originalDuration,
    enhancedDuration,
    eventsRemoved: Math.max(0, raw.length - enhanced.length),
    eventsAdded: Math.max(0, enhanced.length - raw.length),
    timeSaved: originalDuration - enhancedDuration,
  };
}
