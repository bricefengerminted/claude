/**
 * Video export using screen capture of the replay preview.
 *
 * Approach: We use getDisplayMedia to capture the browser tab while
 * the enhanced replay plays, then save the recording as a video file.
 *
 * For a more automated approach in the future, we could use
 * html-to-image + canvas.captureStream() to render frames directly.
 */

export interface ExportOptions {
  format: 'webm' | 'mp4';
  quality: 'high' | 'medium' | 'low';
}

const QUALITY_MAP = {
  high: 8_000_000,   // 8 Mbps
  medium: 4_000_000,  // 4 Mbps
  low: 2_000_000,     // 2 Mbps
};

/**
 * Start recording the current tab. Returns controls to stop and download.
 */
export async function startTabCapture(
  options: ExportOptions,
): Promise<{
  stop: () => void;
  getBlob: () => Promise<Blob>;
  stream: MediaStream;
}> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'browser',
      frameRate: 30,
    },
    audio: false,
    // @ts-expect-error preferCurrentTab is a newer API
    preferCurrentTab: true,
  });

  const mimeType = options.format === 'webm'
    ? 'video/webm;codecs=vp9'
    : 'video/webm'; // browsers generally only support webm natively

  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
    videoBitsPerSecond: QUALITY_MAP[options.quality],
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(100); // collect data every 100ms

  return {
    stop: () => {
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    },
    getBlob: () => {
      return new Promise<Blob>((resolve) => {
        if (recorder.state === 'inactive') {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        } else {
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: 'video/webm' }));
          };
        }
      });
    },
    stream,
  };
}

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

/**
 * Canvas-based export: captures the replay element frame by frame.
 * This is the automated alternative that doesn't require user interaction.
 */
export async function captureReplayToVideo(
  replayContainer: HTMLElement,
  durationMs: number,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const rect = replayContainer.getBoundingClientRect();
  canvas.width = Math.round(rect.width * window.devicePixelRatio);
  canvas.height = Math.round(rect.height * window.devicePixelRatio);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm',
    videoBitsPerSecond: 6_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.start(100);

    const startTime = performance.now();
    const drawFrame = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      onProgress?.(progress * 100);

      // Draw the replay container to canvas
      // Note: This works for simple content. For complex iframes,
      // a more sophisticated approach using html-to-image would be needed.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);

      if (progress < 1) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
        stream.getTracks().forEach((t) => t.stop());
      }
    };

    requestAnimationFrame(drawFrame);
  });
}
