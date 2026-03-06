import type { AnalysisResult, VideoSegment, ZoomKeyframe } from '../types'

/** How often to sample frames (seconds). Lower = more accurate but slower. */
const SAMPLE_INTERVAL = 0.5;

/** Downscaled resolution for fast pixel comparison */
const ANALYSIS_WIDTH = 160;
const ANALYSIS_HEIGHT = 90;

/** Grid for hotspot detection */
const GRID_COLS = 8;
const GRID_ROWS = 6;

/** If change score stays below this for consecutive frames, it's "dead" */
const DEAD_THRESHOLD = 0.005;

/** Minimum dead segment length in seconds to be worth cutting */
const MIN_DEAD_DURATION = 1.5;

/** Zoom scale for detected activity hotspots (lower = subtler, less jarring) */
const ZOOM_SCALE = 1.25;

/** Minimum time (seconds) to hold a zoom target before moving to a new one */
const ZOOM_HOLD_DURATION = 4.0;

/** Max distance (normalized 0-1) to consider two hotspots as "same area" */
const HOTSPOT_CLUSTER_RADIUS = 0.35;

// ---- Helpers ----

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('Seek failed'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

function extractFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): ImageData {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Returns 0-1 representing percentage of pixels that changed significantly. */
function compareFrames(a: ImageData, b: ImageData, threshold = 30): number {
  let changed = 0;
  const total = a.width * a.height;
  for (let i = 0; i < a.data.length; i += 4) {
    const dr = Math.abs(a.data[i] - b.data[i]);
    const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
    const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (dr + dg + db > threshold) changed++;
  }
  return changed / total;
}

/** Minimum cell activity score to be included in the weighted centroid. */
const CELL_ACTIVITY_THRESHOLD = 0.02;

/** Find the weighted centroid of all active grid cells (not just the top one). */
function findHotspot(
  a: ImageData,
  b: ImageData,
): { x: number; y: number; maxChange: number } {
  const cellW = Math.floor(a.width / GRID_COLS);
  const cellH = Math.floor(a.height / GRID_ROWS);
  let maxChange = 0;

  // First pass: compute per-cell scores
  const cellScores: { col: number; row: number; score: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      let change = 0;
      let count = 0;
      const startY = row * cellH;
      const endY = Math.min(startY + cellH, a.height);
      const startX = col * cellW;
      const endX = Math.min(startX + cellW, a.width);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * a.width + x) * 4;
          const dr = Math.abs(a.data[i] - b.data[i]);
          const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
          const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
          if (dr + dg + db > 30) change++;
          count++;
        }
      }

      const score = change / count;
      if (score > maxChange) maxChange = score;
      if (score >= CELL_ACTIVITY_THRESHOLD) {
        cellScores.push({ col, row, score });
      }
    }
  }

  // Weighted centroid of all active cells
  if (cellScores.length === 0) {
    return { x: 0.5, y: 0.5, maxChange };
  }

  let weightSum = 0;
  let wx = 0;
  let wy = 0;
  for (const cell of cellScores) {
    wx += ((cell.col + 0.5) / GRID_COLS) * cell.score;
    wy += ((cell.row + 0.5) / GRID_ROWS) * cell.score;
    weightSum += cell.score;
  }

  return { x: wx / weightSum, y: wy / weightSum, maxChange };
}

/** Group per-frame change scores into active/dead segments. */
function buildSegments(
  frameScores: { timeSec: number; changeScore: number }[],
  totalDuration: number,
): VideoSegment[] {
  if (frameScores.length === 0) return [];

  const segments: VideoSegment[] = [];
  let segStart = 0;
  let segType: 'active' | 'dead' = frameScores[0].changeScore > DEAD_THRESHOLD ? 'active' : 'dead';
  let sumScore = 0;
  let count = 0;

  for (let i = 0; i < frameScores.length; i++) {
    const isDead = frameScores[i].changeScore <= DEAD_THRESHOLD;
    const currentType = isDead ? 'dead' : 'active';

    if (currentType !== segType) {
      const endTime = frameScores[i].timeSec;
      segments.push({
        startSec: segStart,
        endSec: endTime,
        type: segType,
        avgChangeScore: count > 0 ? sumScore / count : 0,
      });
      segStart = endTime;
      segType = currentType;
      sumScore = 0;
      count = 0;
    }

    sumScore += frameScores[i].changeScore;
    count++;
  }

  // Final segment
  segments.push({
    startSec: segStart,
    endSec: totalDuration,
    type: segType,
    avgChangeScore: count > 0 ? sumScore / count : 0,
  });

  // Merge short dead segments back into active (not worth cutting)
  const merged: VideoSegment[] = [];
  for (const seg of segments) {
    if (seg.type === 'dead' && (seg.endSec - seg.startSec) < MIN_DEAD_DURATION) {
      // Too short to cut - merge into previous active segment
      if (merged.length > 0) {
        merged[merged.length - 1].endSec = seg.endSec;
      } else {
        merged.push({ ...seg, type: 'active' });
      }
    } else {
      // Merge consecutive same-type segments
      if (merged.length > 0 && merged[merged.length - 1].type === seg.type) {
        merged[merged.length - 1].endSec = seg.endSec;
      } else {
        merged.push({ ...seg });
      }
    }
  }

  return merged;
}

/**
 * Cluster raw zoom keyframes into stable "zoom holds".
 * Instead of jumping to a new position every 0.5s, we:
 * 1. Group nearby hotspots (within HOTSPOT_CLUSTER_RADIUS) into clusters
 * 2. Each cluster produces a single zoom keyframe at the cluster centroid
 * 3. Clusters must last at least ZOOM_HOLD_DURATION to become a keyframe
 */
function clusterZoomKeyframes(raw: ZoomKeyframe[]): ZoomKeyframe[] {
  if (raw.length === 0) return [];

  const clusters: { keyframes: ZoomKeyframe[]; centroidX: number; centroidY: number }[] = [];
  let currentCluster: ZoomKeyframe[] = [raw[0]];
  let cx = raw[0].x;
  let cy = raw[0].y;

  for (let i = 1; i < raw.length; i++) {
    const kf = raw[i];
    const dist = Math.sqrt((kf.x - cx) ** 2 + (kf.y - cy) ** 2);

    if (dist <= HOTSPOT_CLUSTER_RADIUS) {
      // Same area - add to current cluster and update running centroid
      currentCluster.push(kf);
      cx = currentCluster.reduce((s, k) => s + k.x, 0) / currentCluster.length;
      cy = currentCluster.reduce((s, k) => s + k.y, 0) / currentCluster.length;
    } else {
      // New area - finalize current cluster
      clusters.push({ keyframes: [...currentCluster], centroidX: cx, centroidY: cy });
      currentCluster = [kf];
      cx = kf.x;
      cy = kf.y;
    }
  }
  // Don't forget the last cluster
  clusters.push({ keyframes: [...currentCluster], centroidX: cx, centroidY: cy });

  // Convert clusters into stable zoom keyframes
  const result: ZoomKeyframe[] = [];
  for (const cluster of clusters) {
    const kfs = cluster.keyframes;
    const duration = kfs[kfs.length - 1].timeSec - kfs[0].timeSec;

    // Only create zoom for clusters that last long enough (activity persists in one area)
    if (duration >= ZOOM_HOLD_DURATION && kfs.length >= 4) {
      // Zoom IN at the start of the cluster
      result.push({
        timeSec: kfs[0].timeSec,
        x: cluster.centroidX,
        y: cluster.centroidY,
        scale: ZOOM_SCALE,
      });
      // Hold at centroid through the cluster
      result.push({
        timeSec: kfs[kfs.length - 1].timeSec,
        x: cluster.centroidX,
        y: cluster.centroidY,
        scale: ZOOM_SCALE,
      });
    }
  }

  return result;
}

/** Smooth zoom keyframes with exponential moving average. */
function smoothZoomKeyframes(raw: ZoomKeyframe[]): ZoomKeyframe[] {
  if (raw.length < 3) return raw;

  const alpha = 0.3; // Lower = smoother
  const smoothed: ZoomKeyframe[] = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = smoothed[i - 1];
    smoothed.push({
      timeSec: raw[i].timeSec,
      x: prev.x * (1 - alpha) + raw[i].x * alpha,
      y: prev.y * (1 - alpha) + raw[i].y * alpha,
      scale: raw[i].scale,
    });
  }
  return smoothed;
}

// ---- Main analysis function ----

export interface AnalysisOptions {
  sampleInterval?: number;
  deadThreshold?: number;
  onProgress?: (pct: number) => void;
}

export async function analyzeVideo(
  videoUrl: string,
  options: AnalysisOptions = {},
): Promise<AnalysisResult> {
  const interval = options.sampleInterval ?? SAMPLE_INTERVAL;

  // Create offscreen video element
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.preload = 'auto';

  // Wait for video to load metadata
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('Failed to load video')), { once: true });
  });

  // Fix Infinity duration (common with webm from MediaRecorder)
  if (!isFinite(video.duration)) {
    video.currentTime = 1e10;
    await new Promise<void>((resolve) => {
      video.addEventListener('timeupdate', function fix() {
        video.removeEventListener('timeupdate', fix);
        video.currentTime = 0;
        resolve();
      });
    });
    // Wait for seek back to 0
    await new Promise<void>((resolve) => {
      video.addEventListener('seeked', () => resolve(), { once: true });
    });
  }

  const totalDuration = video.duration;
  const canvas = document.createElement('canvas');
  canvas.width = ANALYSIS_WIDTH;
  canvas.height = ANALYSIS_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const frameScores: { timeSec: number; changeScore: number }[] = [];
  const rawHotspots: ZoomKeyframe[] = [];

  // Extract first frame
  await seekTo(video, 0);
  let prevFrame = extractFrame(video, canvas, ctx);

  const totalFrames = Math.ceil(totalDuration / interval);
  let frameIndex = 0;

  for (let t = interval; t < totalDuration; t += interval) {
    await seekTo(video, t);
    const currentFrame = extractFrame(video, canvas, ctx);

    const changeScore = compareFrames(prevFrame, currentFrame);
    frameScores.push({ timeSec: t, changeScore });

    // Hotspot detection for zoom
    if (changeScore > DEAD_THRESHOLD) {
      const hotspot = findHotspot(prevFrame, currentFrame);
      if (hotspot.maxChange > 0.02) {
        rawHotspots.push({
          timeSec: t,
          x: hotspot.x,
          y: hotspot.y,
          scale: ZOOM_SCALE,
        });
      }
    }

    prevFrame = currentFrame;
    frameIndex++;
    options.onProgress?.(Math.round((frameIndex / totalFrames) * 100));
  }

  const segments = buildSegments(frameScores, totalDuration);

  // Cluster → smooth → add ease-in/out resets
  const clustered = clusterZoomKeyframes(rawHotspots);
  const zoomKeyframes = smoothZoomKeyframes(clustered);

  // Add a "reset" keyframe at start and end so zoom eases in/out
  if (zoomKeyframes.length > 0) {
    if (zoomKeyframes[0].timeSec > 0.5) {
      zoomKeyframes.unshift({ timeSec: 0, x: 0.5, y: 0.5, scale: 1.0 });
    }
    const last = zoomKeyframes[zoomKeyframes.length - 1];
    if (last.timeSec < totalDuration - 0.5) {
      zoomKeyframes.push({ timeSec: totalDuration, x: 0.5, y: 0.5, scale: 1.0 });
    }

    // Insert zoom-out resets between clusters that are far apart in time (>5s gap)
    const withResets: ZoomKeyframe[] = [zoomKeyframes[0]];
    for (let i = 1; i < zoomKeyframes.length; i++) {
      const gap = zoomKeyframes[i].timeSec - zoomKeyframes[i - 1].timeSec;
      if (gap > 5.0 && zoomKeyframes[i - 1].scale > 1.01 && zoomKeyframes[i].scale > 1.01) {
        // Zoom out halfway through the gap, then zoom in for the next cluster
        const midTime = zoomKeyframes[i - 1].timeSec + gap * 0.3;
        const reZoomTime = zoomKeyframes[i].timeSec - gap * 0.3;
        withResets.push({ timeSec: midTime, x: 0.5, y: 0.5, scale: 1.0 });
        withResets.push({ timeSec: reZoomTime, x: 0.5, y: 0.5, scale: 1.0 });
      }
      withResets.push(zoomKeyframes[i]);
    }

    return {
      segments,
      zoomKeyframes: withResets,
      totalDuration,
      frameCount: frameIndex,
    };
  }

  return {
    segments,
    zoomKeyframes,
    totalDuration,
    frameCount: frameIndex,
  };
}
