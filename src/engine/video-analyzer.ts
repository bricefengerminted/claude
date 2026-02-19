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

/** Zoom scale for detected activity hotspots */
const ZOOM_SCALE = 1.6;

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

/** Find the grid cell with the most pixel change (activity hotspot). */
function findHotspot(
  a: ImageData,
  b: ImageData,
): { x: number; y: number; maxChange: number } {
  const cellW = Math.floor(a.width / GRID_COLS);
  const cellH = Math.floor(a.height / GRID_ROWS);
  let maxChange = 0;
  let hotX = 0.5;
  let hotY = 0.5;

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
      if (score > maxChange) {
        maxChange = score;
        hotX = (col + 0.5) / GRID_COLS;
        hotY = (row + 0.5) / GRID_ROWS;
      }
    }
  }

  return { x: hotX, y: hotY, maxChange };
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

/** Smooth zoom keyframes so the camera doesn't jump erratically. */
function smoothZoomKeyframes(raw: ZoomKeyframe[]): ZoomKeyframe[] {
  if (raw.length < 3) return raw;

  const smoothed: ZoomKeyframe[] = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    const prev = raw[i - 1];
    const curr = raw[i];
    const next = raw[i + 1];
    smoothed.push({
      timeSec: curr.timeSec,
      x: prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25,
      y: prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25,
      scale: curr.scale,
    });
  }
  smoothed.push(raw[raw.length - 1]);
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
  const rawZoomKeyframes: ZoomKeyframe[] = [];

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
        rawZoomKeyframes.push({
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
  const zoomKeyframes = smoothZoomKeyframes(rawZoomKeyframes);

  // Add a "reset" keyframe at start and end so zoom eases in/out
  if (zoomKeyframes.length > 0) {
    if (zoomKeyframes[0].timeSec > 0.5) {
      zoomKeyframes.unshift({ timeSec: 0, x: 0.5, y: 0.5, scale: 1.0 });
    }
    const last = zoomKeyframes[zoomKeyframes.length - 1];
    if (last.timeSec < totalDuration - 0.5) {
      zoomKeyframes.push({ timeSec: totalDuration, x: 0.5, y: 0.5, scale: 1.0 });
    }
  }

  return {
    segments,
    zoomKeyframes,
    totalDuration,
    frameCount: frameIndex,
  };
}
