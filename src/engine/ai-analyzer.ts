import type { ZoomKeyframe } from '../types'

/**
 * AI-powered video analyzer using Claude Vision API.
 * Acts as a virtual camera operator: analyzes the video to understand WHERE
 * the action is happening at each moment, then generates a smooth camera path
 * that follows the action — staying zoomed in while activity continues in one
 * area, and only moving when the action moves somewhere else.
 */

/** How many frames to extract (more = better analysis, higher cost) */
const MAX_FRAMES = 20;

/** Frame dimensions for API */
const FRAME_WIDTH = 768;
const FRAME_HEIGHT = 432;

/** Transition time (seconds) when camera moves between regions */
const CAMERA_MOVE_SEC = 0.8;

export interface AICaption {
  timeSec: number;
  text: string;
}

export interface AIAnalysisResult {
  zoomKeyframes: ZoomKeyframe[];
  captions: AICaption[];
  summary: string;
}

// ---- Frame extraction ----

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

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): string {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

async function extractFrames(
  videoUrl: string,
  onProgress?: (pct: number) => void,
): Promise<{ frames: { timeSec: number; dataUrl: string }[]; duration: number }> {
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.preload = 'auto';

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
    await new Promise<void>((resolve) => {
      video.addEventListener('seeked', () => resolve(), { once: true });
    });
  }

  const duration = video.duration;
  const frameCount = Math.min(MAX_FRAMES, Math.ceil(duration / 2));
  const interval = duration / frameCount;

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const frames: { timeSec: number; dataUrl: string }[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = i * interval;
    await seekTo(video, t);
    const dataUrl = captureFrame(video, canvas, ctx);
    frames.push({ timeSec: t, dataUrl });
    onProgress?.(Math.round(((i + 1) / frameCount) * 40));
  }

  return { frames, duration };
}

// ---- Claude Vision API ----

const SYSTEM_PROMPT = `You are a virtual camera operator for a screen recording. You are directing a smooth, cinematic camera that follows the action.

Your job: for each frame, decide where the camera should be pointed. Think of it like a documentary cameraman — you follow the subject, hold steady while they work in one area, and smoothly pan when the action moves.

KEY PRINCIPLES:
1. FOLLOW THE ACTION: If the user is working in the left sidebar, keep the camera there. Don't zoom out just because a few seconds passed.
2. STAY STEADY: If consecutive frames show activity in the same region, output the SAME camera position. Don't jitter.
3. SMOOTH TRANSITIONS: When activity moves to a different area (e.g., from sidebar to main content), smoothly transition. Don't snap.
4. CONTEXT FIRST: Start with a brief wide shot (1-2 seconds, scale 1.0) so viewers see the full UI, THEN zoom into where the action begins.
5. ZOOM OUT FOR RESULTS: When something visually changes on the main screen (a preview updates, a page loads, a result appears), zoom out to show the full result.

CAMERA POSITIONS:
- scale 1.0 = full view (use for establishing shots and showing results)
- scale 1.3-1.5 = following action in a region (sidebar, form, toolbar)
- scale 1.6-2.0 = close-up on a specific small element (only if truly needed)
- x, y = normalized center of camera focus (0-1 range)

OUTPUT FORMAT — return ONLY valid JSON (no markdown, no backticks):
{
  "camera": [
    { "timeSec": 0.0, "x": 0.5, "y": 0.5, "scale": 1.0, "reason": "establishing shot" },
    { "timeSec": 2.0, "x": 0.25, "y": 0.4, "scale": 1.4, "reason": "user working in left sidebar" },
    { "timeSec": 14.0, "x": 0.25, "y": 0.5, "scale": 1.4, "reason": "still editing in sidebar" },
    { "timeSec": 16.0, "x": 0.6, "y": 0.5, "scale": 1.0, "reason": "zooming out to show result on main page" }
  ],
  "summary": "Brief description of the demo"
}

IMPORTANT:
- You MUST output a camera position for the FIRST and LAST frame timestamps.
- If the action stays in the same area across multiple frames, still output entries for those frames — just keep x, y, scale the SAME. This tells the camera to hold steady.
- Only change x/y/scale when the action genuinely moves to a different area.
- Prefer FEWER camera moves. A good camera operator doesn't fidget.`;

function buildUserPrompt(
  frames: { timeSec: number; dataUrl: string }[],
  duration: number,
): any[] {
  const content: any[] = [
    {
      type: 'text',
      text: `This is a ${Math.round(duration)}s screen recording with ${frames.length} frames sampled at regular intervals. For each frame, decide where the camera should be focused. Keep the camera steady when action stays in one area.\n\nFrames:`,
    },
  ];

  for (const frame of frames) {
    content.push({
      type: 'text',
      text: `\n--- Frame at ${frame.timeSec.toFixed(1)}s ---`,
    });
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: frame.dataUrl.replace(/^data:image\/jpeg;base64,/, ''),
      },
    });
  }

  content.push({
    type: 'text',
    text: `\nNow output the camera path as JSON. Remember: hold steady when the action stays in one place, only move when it genuinely shifts. Return ONLY valid JSON.`,
  });

  return content;
}

function getApiUrl(): string {
  const isDev = import.meta.env.DEV;
  return isDev ? '/api/anthropic/v1/messages' : '/api/anthropic';
}

async function callClaude(
  apiKey: string,
  userContent: any[],
): Promise<string> {
  const response = await fetch(getApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) {
      throw new Error('Invalid API key. Check your key in AI Settings.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }
    throw new Error(`Claude API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === 'text');
  if (!textBlock) throw new Error('No text response from Claude');
  return textBlock.text;
}

// ---- Parse response into a smooth camera path ----

function parseAIResponse(
  raw: string,
  duration: number,
): AIAnalysisResult {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);

  // Support both old "scenes" format and new "camera" format
  const cameraPositions: {
    timeSec: number;
    x: number;
    y: number;
    scale: number;
    reason?: string;
  }[] = parsed.camera ?? parsed.scenes ?? [];

  const captions: AICaption[] = [];
  const zoomKeyframes: ZoomKeyframe[] = [];

  if (cameraPositions.length === 0) {
    // No camera positions — just show full view
    zoomKeyframes.push({ timeSec: 0, x: 0.5, y: 0.5, scale: 1.0 });
    return { zoomKeyframes, captions, summary: parsed.summary ?? '' };
  }

  // Sort by time
  cameraPositions.sort((a, b) => a.timeSec - b.timeSec);

  // Deduplicate: merge consecutive positions with same x/y/scale (within tolerance)
  // but keep the first and last of each "hold" region so the camera stays put
  const merged: typeof cameraPositions = [cameraPositions[0]];
  for (let i = 1; i < cameraPositions.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = cameraPositions[i];
    const samePos =
      Math.abs(prev.x - curr.x) < 0.05 &&
      Math.abs(prev.y - curr.y) < 0.05 &&
      Math.abs(prev.scale - curr.scale) < 0.1;

    if (samePos) {
      // Update the "hold end" time — replace prev with a span
      // We keep the first occurrence's position but extend to this time
      // Only add a new keyframe if this is the last in a run, or if next is different
      const next = cameraPositions[i + 1];
      const nextIsDifferent = !next || (
        Math.abs(curr.x - next.x) >= 0.05 ||
        Math.abs(curr.y - next.y) >= 0.05 ||
        Math.abs(curr.scale - next.scale) >= 0.1
      );
      if (nextIsDifferent) {
        // Add the end-of-hold keyframe with same position
        merged.push({
          timeSec: curr.timeSec,
          x: prev.x,
          y: prev.y,
          scale: prev.scale,
          reason: curr.reason,
        });
      }
    } else {
      merged.push(curr);
    }
  }

  // Build keyframes with smooth transitions between different camera positions
  for (let i = 0; i < merged.length; i++) {
    const pos = merged[i];
    const t = Math.max(0, Math.min(duration, pos.timeSec));
    const x = Math.max(0, Math.min(1, pos.x));
    const y = Math.max(0, Math.min(1, pos.y));
    const scale = Math.max(1.0, Math.min(2.5, pos.scale));

    // Check if this is a camera move (position changed from previous keyframe)
    if (i > 0) {
      const prevKf = zoomKeyframes[zoomKeyframes.length - 1];
      const isMove =
        Math.abs(prevKf.x - x) >= 0.03 ||
        Math.abs(prevKf.y - y) >= 0.03 ||
        Math.abs(prevKf.scale - scale) >= 0.08;

      if (isMove) {
        // Insert a transition: hold previous position until transition starts,
        // then ease to new position over CAMERA_MOVE_SEC
        const transitionStart = Math.max(prevKf.timeSec, t - CAMERA_MOVE_SEC);
        if (transitionStart > prevKf.timeSec + 0.1) {
          // Hold previous position until transition begins
          zoomKeyframes.push({
            timeSec: transitionStart,
            x: prevKf.x,
            y: prevKf.y,
            scale: prevKf.scale,
          });
        }
      }
    }

    zoomKeyframes.push({ timeSec: t, x, y, scale });

    // Collect captions from reasons (skip boring ones)
    if (pos.reason && !pos.reason.match(/^(same|still|hold|continu)/i)) {
      captions.push({ timeSec: t, text: pos.reason });
    }
  }

  // Ensure we end with a wide shot in the last second
  const lastKf = zoomKeyframes[zoomKeyframes.length - 1];
  if (lastKf.scale > 1.05 && lastKf.timeSec < duration - 1.0) {
    zoomKeyframes.push({
      timeSec: duration - 0.8,
      x: lastKf.x,
      y: lastKf.y,
      scale: lastKf.scale,
    });
    zoomKeyframes.push({
      timeSec: duration,
      x: 0.5,
      y: 0.5,
      scale: 1.0,
    });
  }

  return {
    zoomKeyframes,
    captions,
    summary: parsed.summary ?? '',
  };
}

// ---- Main export ----

export interface AIAnalysisOptions {
  onProgress?: (pct: number) => void;
  onStatus?: (status: string) => void;
}

export async function aiAnalyzeVideo(
  videoUrl: string,
  apiKey: string,
  options: AIAnalysisOptions = {},
): Promise<AIAnalysisResult> {
  const { onProgress, onStatus } = options;

  // Step 1: Extract frames (0-40%)
  onStatus?.('Extracting frames...');
  const { frames, duration } = await extractFrames(videoUrl, onProgress);

  // Step 2: Build prompt and call Claude (40-90%)
  onStatus?.('AI analyzing scenes...');
  onProgress?.(45);
  const userContent = buildUserPrompt(frames, duration);

  onProgress?.(50);
  const rawResponse = await callClaude(apiKey, userContent);
  onProgress?.(90);

  // Step 3: Parse response (90-100%)
  onStatus?.('Building camera path...');
  const result = parseAIResponse(rawResponse, duration);
  onProgress?.(100);

  return result;
}
