import type { VideoSegment, ZoomKeyframe } from '../types'

/**
 * Download a blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Interpolate between two zoom keyframes at a given time. */
function interpolateZoom(
  keyframes: ZoomKeyframe[],
  timeSec: number,
): { x: number; y: number; scale: number } {
  if (keyframes.length === 0) return { x: 0.5, y: 0.5, scale: 1.0 };
  if (timeSec <= keyframes[0].timeSec) return keyframes[0];
  if (timeSec >= keyframes[keyframes.length - 1].timeSec) return keyframes[keyframes.length - 1];

  // Find bracketing keyframes
  let a = keyframes[0];
  let b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (timeSec >= keyframes[i].timeSec && timeSec <= keyframes[i + 1].timeSec) {
      a = keyframes[i];
      b = keyframes[i + 1];
      break;
    }
  }

  const range = b.timeSec - a.timeSec;
  if (range <= 0) return a;
  const t = (timeSec - a.timeSec) / range;

  // Ease in-out
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  return {
    x: a.x + (b.x - a.x) * ease,
    y: a.y + (b.y - a.y) * ease,
    scale: a.scale + (b.scale - a.scale) * ease,
  };
}

export interface ExportWithEffectsOptions {
  videoUrl: string;
  segments: VideoSegment[];
  cutSegments: Set<number>;
  zoomKeyframes: ZoomKeyframe[];
  enableZoom: boolean;
  playbackSpeed: number;
  onProgress?: (pct: number) => void;
}

/**
 * Export video with trims and zoom effects baked in.
 * Plays the video onto a canvas, skipping cut segments and applying zoom,
 * then captures the canvas stream into a new video file.
 */
export async function exportWithEffects(
  options: ExportWithEffectsOptions,
): Promise<Blob> {
  const {
    videoUrl,
    segments,
    cutSegments,
    zoomKeyframes,
    enableZoom,
    playbackSpeed,
    onProgress,
  } = options;

  // Build list of time ranges to keep
  const keepRanges: { start: number; end: number }[] = [];
  segments.forEach((seg, i) => {
    if (!cutSegments.has(i)) {
      keepRanges.push({ start: seg.startSec, end: seg.endSec });
    }
  });

  if (keepRanges.length === 0) {
    throw new Error('Nothing to export - all segments are cut');
  }

  // Create video element
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('Failed to load video')), { once: true });
  });

  // Fix webm infinite duration
  if (!isFinite(video.duration)) {
    video.currentTime = 1e10;
    await new Promise<void>((r) => {
      video.addEventListener('timeupdate', function fix() {
        video.removeEventListener('timeupdate', fix);
        video.currentTime = 0;
        r();
      });
    });
    await new Promise<void>((r) => video.addEventListener('seeked', () => r(), { once: true }));
  }

  // Set up canvas at video's native resolution
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d')!;

  // Set up recorder
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>(async (resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.start(100);

    // Calculate total output duration for progress
    let totalKeepDuration = 0;
    for (const range of keepRanges) {
      totalKeepDuration += range.end - range.start;
    }
    let processedDuration = 0;

    // Damped zoom state to match the preview player's smooth transitions
    const damped = { x: 0.5, y: 0.5, scale: 1.0 };
    const DAMPING = 0.08;

    // Process each keep range
    for (let ri = 0; ri < keepRanges.length; ri++) {
      const range = keepRanges[ri];

      // Seek to start of range
      video.currentTime = range.start;
      await new Promise<void>((r) => video.addEventListener('seeked', () => r(), { once: true }));

      video.playbackRate = playbackSpeed;

      // Reset damped values to the target at seek point
      if (enableZoom && zoomKeyframes.length > 0) {
        const initial = interpolateZoom(zoomKeyframes, video.currentTime);
        damped.x = initial.x;
        damped.y = initial.y;
        damped.scale = initial.scale;
      }

      // Play this range and draw frames
      await new Promise<void>((rangeResolve) => {
        const drawFrame = () => {
          if (video.currentTime >= range.end || video.ended || video.paused) {
            video.pause();
            rangeResolve();
            return;
          }

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (enableZoom && zoomKeyframes.length > 0) {
            const target = interpolateZoom(zoomKeyframes, video.currentTime);

            // Apply damping to match preview player
            damped.x += (target.x - damped.x) * DAMPING;
            damped.y += (target.y - damped.y) * DAMPING;
            damped.scale += (target.scale - damped.scale) * DAMPING;

            if (damped.scale > 1.02) {
              const s = damped.scale;

              // Clamp pan so we never show outside the video edges (matches preview)
              const halfVisible = 0.5 / s;
              const cx = Math.max(halfVisible, Math.min(1 - halfVisible, damped.x));
              const cy = Math.max(halfVisible, Math.min(1 - halfVisible, damped.y));

              // Center the zoom point on screen:
              // We want point (cx*W, cy*H) to map to (W/2, H/2) after transform
              // setTransform(s,0,0,s,tx,ty): x' = s*x + tx
              // W/2 = s*(cx*W) + tx  →  tx = W*(0.5 - s*cx)
              const tx = canvas.width * (0.5 - s * cx);
              const ty = canvas.height * (0.5 - s * cy);
              ctx.setTransform(s, 0, 0, s, tx, ty);
            }
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.restore();

          // Progress
          const currentProcessed = processedDuration + (video.currentTime - range.start);
          onProgress?.(Math.min(99, Math.round((currentProcessed / totalKeepDuration) * 100)));

          requestAnimationFrame(drawFrame);
        };

        video.play();
        requestAnimationFrame(drawFrame);

        // Safety: also listen for pause/ended in case the range ends
        const checkEnd = () => {
          if (video.currentTime >= range.end) {
            video.pause();
            rangeResolve();
          }
        };
        video.addEventListener('timeupdate', checkEnd);
        // Clean up listener when range is done
        const origResolve = rangeResolve;
        // eslint-disable-next-line no-param-reassign
        rangeResolve = () => {
          video.removeEventListener('timeupdate', checkEnd);
          origResolve();
        };
      });

      processedDuration += range.end - range.start;
    }

    onProgress?.(100);

    // Small delay to flush final frames
    await new Promise((r) => setTimeout(r, 300));

    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  });
}
