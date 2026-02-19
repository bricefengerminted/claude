import { RRWebEvent, EventType, IncrementalSource } from '../types'

/**
 * Ease-in-out cubic easing
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface ScrollGroup {
  events: RRWebEvent[];
  startIndex: number;
  nodeId: number;
}

/**
 * Group consecutive scroll events that happen on the same element
 * within a short time window.
 */
function groupScrollEvents(events: RRWebEvent[], windowMs: number): ScrollGroup[] {
  const groups: ScrollGroup[] = [];
  let currentGroup: ScrollGroup | null = null as ScrollGroup | null;

  events.forEach((event, index) => {
    if (
      event.type !== EventType.IncrementalSnapshot ||
      event.data?.source !== IncrementalSource.Scroll
    ) {
      // Non-scroll event breaks the group
      if (currentGroup && currentGroup.events.length > 1) {
        groups.push(currentGroup);
      }
      currentGroup = null;
      return;
    }

    const nodeId = event.data.id ?? 0;

    if (
      currentGroup &&
      currentGroup.nodeId === nodeId &&
      event.timestamp - currentGroup.events[currentGroup.events.length - 1].timestamp < windowMs
    ) {
      currentGroup.events.push(event);
    } else {
      if (currentGroup && currentGroup.events.length > 1) {
        groups.push(currentGroup);
      }
      currentGroup = { events: [event], startIndex: index, nodeId };
    }
  });

  if (currentGroup && currentGroup.events.length > 1) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Normalize scroll events to be smooth and consistent.
 *
 * Takes jerky mouse-wheel scroll events and replaces them with
 * evenly-paced, eased scroll animations.
 *
 * @param events - Raw rrweb events
 * @param intensity - 0 to 100, how aggressively to smooth
 * @returns Events with normalized scrolling
 */
export function smoothScroll(events: RRWebEvent[], intensity: number): RRWebEvent[] {
  if (intensity === 0) return events;

  const windowMs = 50 + (intensity / 100) * 200; // 50-250ms grouping window
  const minDuration = 200 + (intensity / 100) * 400; // 200-600ms minimum scroll duration
  const fps = 60;
  const frameMs = 1000 / fps;

  const groups = groupScrollEvents(events, windowMs);
  if (groups.length === 0) return events;

  // Build a set of event timestamps to replace
  const replacements = new Map<number, RRWebEvent[]>();
  const toRemove = new Set<number>();

  for (const group of groups) {
    const first = group.events[0];
    const last = group.events[group.events.length - 1];

    const startY = first.data.y ?? 0;
    const endY = last.data.y ?? 0;
    const startX = first.data.x ?? 0;
    const endX = last.data.x ?? 0;

    // Skip if scroll delta is tiny
    if (Math.abs(endY - startY) < 5 && Math.abs(endX - startX) < 5) continue;

    const rawDuration = last.timestamp - first.timestamp;
    const duration = Math.max(rawDuration, minDuration);
    const numFrames = Math.max(2, Math.ceil(duration / frameMs));

    // Generate smooth scroll events
    const smoothEvents: RRWebEvent[] = [];
    for (let i = 0; i <= numFrames; i++) {
      const t = i / numFrames;
      const eased = easeInOutCubic(t);

      smoothEvents.push({
        type: EventType.IncrementalSnapshot,
        data: {
          source: IncrementalSource.Scroll,
          id: first.data.id,
          x: Math.round(lerp(startX, endX, eased)),
          y: Math.round(lerp(startY, endY, eased)),
        },
        timestamp: Math.round(first.timestamp + duration * t),
      });
    }

    // Mark originals for removal, store replacements at the first event's position
    const firstOriginalTimestamp = first.timestamp;
    replacements.set(firstOriginalTimestamp, smoothEvents);

    for (const evt of group.events) {
      toRemove.add(evt.timestamp);
    }
  }

  // Rebuild event list with replacements
  const result: RRWebEvent[] = [];
  for (const event of events) {
    if (replacements.has(event.timestamp)) {
      result.push(...replacements.get(event.timestamp)!);
      replacements.delete(event.timestamp);
    } else if (!toRemove.has(event.timestamp)) {
      result.push(event);
    }
  }

  // Sort by timestamp to maintain order
  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}
