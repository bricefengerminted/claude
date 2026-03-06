import type { ZoomKeyframe } from '../types'

/**
 * AI-powered video analyzer using Claude Vision API.
 * Extracts frames from the video, sends them to Claude for scene understanding,
 * and returns intelligent zoom keyframes + optional captions.
 */

/** How many frames to extract (more = better analysis, higher cost) */
const MAX_FRAMES = 20;

/** Frame dimensions for API (smaller = cheaper, 512px is enough for UI understanding) */
const FRAME_WIDTH = 768;
const FRAME_HEIGHT = 432;

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
  // Use JPEG for smaller payload (each frame ~30-50KB vs 150KB+ PNG)
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
  const frameCount = Math.min(MAX_FRAMES, Math.ceil(duration / 2)); // ~1 frame per 2s, capped
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
    onProgress?.(Math.round(((i + 1) / frameCount) * 40)); // 0-40% for extraction
  }

  return { frames, duration };
}

// ---- Claude Vision API ----

const SYSTEM_PROMPT = `You are a professional video editor analyzing a screen recording. Your job is to identify the 1-3 MOST IMPORTANT moments that deserve a zoom close-up. Less is more — a video with zero zooms is better than one with too many.

CRITICAL RULES:
- BE EXTREMELY SELECTIVE. Most frames should NOT get a zoom.
- For videos under 30 seconds: maximum 1-2 zoom moments
- For videos 30-60 seconds: maximum 2-3 zoom moments
- For videos over 60 seconds: maximum 3-5 zoom moments
- Only zoom when there is a CLEAR focal point worth highlighting (a specific button being clicked, a specific form field being filled, a key result appearing)
- Do NOT zoom for: page loads, scrolling, mouse movement, typing in large text areas, or general navigation
- Do NOT zoom into the same general area twice in a row
- Use normalized coordinates (0-1 range): x=0 is left edge, x=1 is right edge, y=0 is top, y=1 is bottom
- Use scale 1.3-1.5 for subtle emphasis (preferred), 1.6-2.0 only for tiny UI elements
- If nothing particularly interesting happens, return an EMPTY scenes array — that's perfectly fine

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "scenes": [
    {
      "timeSec": 5.0,
      "x": 0.3,
      "y": 0.6,
      "scale": 1.4,
      "caption": "Clicking the submit button"
    }
  ],
  "summary": "Brief 1-sentence description of what the demo shows"
}`;

function buildUserPrompt(
  frames: { timeSec: number; dataUrl: string }[],
  duration: number,
): any[] {
  const maxZooms = duration < 30 ? 2 : duration < 60 ? 3 : 5;
  const content: any[] = [
    {
      type: 'text',
      text: `This is a ${Math.round(duration)}s screen recording with ${frames.length} frames. Identify AT MOST ${maxZooms} moments worth zooming into. If nothing stands out, return zero scenes — that's fine. Be very selective.\n\nFrames:`,
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
    text: `\nBased on these ${frames.length} frames spanning ${Math.round(duration)}s, generate AT MOST ${maxZooms} zoom scenes. Only zoom into truly important moments. Return ONLY valid JSON, no markdown formatting.`,
  });

  return content;
}

function getApiUrl(): string {
  // In dev, the Vite proxy rewrites /api/anthropic/* to api.anthropic.com/*
  // In production, Firebase Function handles /api/anthropic/* directly
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

// ---- Parse response into keyframes ----

function parseAIResponse(
  raw: string,
  duration: number,
): AIAnalysisResult {
  // Strip any markdown code fences if Claude included them despite instructions
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  const maxZooms = duration < 30 ? 2 : duration < 60 ? 3 : 5;

  // Hard cap: take only the top N scenes by scale (most confident zooms)
  let scenes: {
    timeSec: number;
    x: number;
    y: number;
    scale: number;
    caption?: string;
  }[] = parsed.scenes ?? [];

  if (scenes.length > maxZooms) {
    scenes = [...scenes]
      .sort((a, b) => (b.scale ?? 1) - (a.scale ?? 1))
      .slice(0, maxZooms)
      .sort((a, b) => a.timeSec - b.timeSec);
  }

  // Build zoom keyframes with smooth transitions
  const zoomKeyframes: ZoomKeyframe[] = [];
  const captions: AICaption[] = [];

  // Always start with a full view
  zoomKeyframes.push({ timeSec: 0, x: 0.5, y: 0.5, scale: 1.0 });

  for (const scene of scenes) {
    const t = Math.max(0, Math.min(duration, scene.timeSec));
    const x = Math.max(0, Math.min(1, scene.x));
    const y = Math.max(0, Math.min(1, scene.y));
    const scale = Math.max(1.0, Math.min(2.5, scene.scale));

    if (scale > 1.05) {
      // Ease in (0.4s before)
      const easeIn = Math.max(0, t - 0.4);
      zoomKeyframes.push({ timeSec: easeIn, x, y, scale: 1.0 });
      // Zoomed
      zoomKeyframes.push({ timeSec: t, x, y, scale });
      // Hold for ~3s
      const holdEnd = Math.min(duration, t + 3.0);
      zoomKeyframes.push({ timeSec: holdEnd, x, y, scale });
      // Ease out
      const easeOut = Math.min(duration, holdEnd + 0.4);
      zoomKeyframes.push({ timeSec: easeOut, x, y, scale: 1.0 });
    }

    if (scene.caption) {
      captions.push({ timeSec: t, text: scene.caption });
    }
  }

  // Ensure we end zoomed out
  const last = zoomKeyframes[zoomKeyframes.length - 1];
  if (last.timeSec < duration - 0.5) {
    zoomKeyframes.push({ timeSec: duration, x: 0.5, y: 0.5, scale: 1.0 });
  }

  // Sort by time
  zoomKeyframes.sort((a, b) => a.timeSec - b.timeSec);

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
  onStatus?.('Generating zoom keyframes...');
  const result = parseAIResponse(rawResponse, duration);
  onProgress?.(100);

  return result;
}
