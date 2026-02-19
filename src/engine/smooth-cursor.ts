import { RRWebEvent, EventType, IncrementalSource, Position } from '../types'

/**
 * Catmull-Rom spline interpolation for smooth cursor paths.
 * Takes 4 control points and a parameter t (0-1), returns interpolated value.
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Ease-in-out cubic function for natural-feeling movement
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Compute distance between two points
 */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Downsample points that are very close together (jitter removal)
 */
function removeJitter(positions: Position[], minDistance: number): Position[] {
  if (positions.length <= 2) return positions;
  const result: Position[] = [positions[0]];
  for (let i = 1; i < positions.length - 1; i++) {
    if (dist(positions[i], result[result.length - 1]) >= minDistance) {
      result.push(positions[i]);
    }
  }
  result.push(positions[positions.length - 1]); // always keep last
  return result;
}

/**
 * Apply Catmull-Rom spline interpolation to a set of positions.
 * Generates smooth paths between the recorded points.
 */
function interpolatePositions(positions: Position[], stepsPerSegment: number): Position[] {
  if (positions.length < 4) return positions;

  const smoothed: Position[] = [];

  for (let i = 0; i < positions.length - 1; i++) {
    const p0 = positions[Math.max(0, i - 1)];
    const p1 = positions[i];
    const p2 = positions[Math.min(positions.length - 1, i + 1)];
    const p3 = positions[Math.min(positions.length - 1, i + 2)];

    for (let step = 0; step < stepsPerSegment; step++) {
      const t = step / stepsPerSegment;
      const eased = easeInOutCubic(t);

      smoothed.push({
        x: Math.round(catmullRom(p0.x, p1.x, p2.x, p3.x, eased)),
        y: Math.round(catmullRom(p0.y, p1.y, p2.y, p3.y, eased)),
        id: p1.id,
        timeOffset: Math.round(
          p1.timeOffset + (p2.timeOffset - p1.timeOffset) * t
        ),
      });
    }
  }

  // Add the last point
  smoothed.push(positions[positions.length - 1]);
  return smoothed;
}

/**
 * Smooth cursor movements in rrweb events.
 *
 * @param events - Raw rrweb events
 * @param intensity - 0 to 100, how aggressively to smooth
 * @returns Events with smoothed mouse movements
 */
export function smoothCursor(events: RRWebEvent[], intensity: number): RRWebEvent[] {
  if (intensity === 0) return events;

  // Map intensity (0-100) to algorithm parameters
  const minDistance = 2 + (intensity / 100) * 8;       // 2-10px jitter threshold
  const stepsPerSegment = 2 + Math.round((intensity / 100) * 4); // 2-6 interpolation steps

  return events.map((event) => {
    if (
      event.type !== EventType.IncrementalSnapshot ||
      event.data?.source !== IncrementalSource.MouseMove
    ) {
      return event;
    }

    const positions: Position[] = event.data.positions;
    if (!positions || positions.length < 3) return event;

    // Step 1: Remove jitter (tiny back-and-forth movements)
    const dejittered = removeJitter(positions, minDistance);

    // Step 2: Interpolate with Catmull-Rom for smooth curves
    const smoothed = interpolatePositions(dejittered, stepsPerSegment);

    return {
      ...event,
      data: {
        ...event.data,
        positions: smoothed,
      },
    };
  });
}
