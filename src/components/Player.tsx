import { useRef, useState, useEffect, useCallback } from 'react'
import type { ZoomKeyframe } from '../types'

interface Props {
  videoUrl: string;
  playbackSpeed?: number;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  zoomKeyframes?: ZoomKeyframe[];
  onTimeUpdate?: (currentTime: number) => void;
  onDurationLoaded?: (duration: number) => void;
}

/** Interpolate between zoom keyframes at a given time with eased transitions. */
function interpolateZoom(
  keyframes: ZoomKeyframe[],
  timeSec: number,
): { x: number; y: number; scale: number } {
  if (keyframes.length === 0) return { x: 0.5, y: 0.5, scale: 1.0 };
  if (timeSec <= keyframes[0].timeSec) return keyframes[0];
  if (timeSec >= keyframes[keyframes.length - 1].timeSec) return keyframes[keyframes.length - 1];

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
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  return {
    x: a.x + (b.x - a.x) * ease,
    y: a.y + (b.y - a.y) * ease,
    scale: a.scale + (b.scale - a.scale) * ease,
  };
}

export default function Player({
  videoUrl,
  playbackSpeed = 1.0,
  width = 720,
  height = 450,
  autoPlay = false,
  zoomKeyframes,
  onTimeUpdate,
  onDurationLoaded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const zoomFrameRef = useRef<number>();
  // Damped zoom state for smooth motion
  const dampedRef = useRef({ x: 0.5, y: 0.5, scale: 1.0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Zoom animation loop with damping for smooth camera motion
  const updateZoom = useCallback(() => {
    const video = videoRef.current;
    if (!video || !zoomKeyframes || zoomKeyframes.length === 0) {
      setZoomStyle({});
      dampedRef.current = { x: 0.5, y: 0.5, scale: 1.0 };
      return;
    }

    const target = interpolateZoom(zoomKeyframes, video.currentTime);
    const d = dampedRef.current;

    // Exponential damping: lerp toward target each frame
    const damping = 0.08; // Lower = smoother/slower camera
    d.x += (target.x - d.x) * damping;
    d.y += (target.y - d.y) * damping;
    d.scale += (target.scale - d.scale) * damping;

    if (d.scale > 1.02) {
      const tx = -(d.x * 100 - 50) * (d.scale - 1);
      const ty = -(d.y * 100 - 50) * (d.scale - 1);
      setZoomStyle({
        transform: `scale(${d.scale.toFixed(3)}) translate(${(tx / d.scale).toFixed(2)}%, ${(ty / d.scale).toFixed(2)}%)`,
        transformOrigin: 'center center',
      });
    } else {
      setZoomStyle({
        transform: 'scale(1)',
        transition: 'transform 0.5s ease-out',
      });
    }

    if (!video.paused && !video.ended) {
      zoomFrameRef.current = requestAnimationFrame(updateZoom);
    }
  }, [zoomKeyframes]);

  // Start/stop zoom loop when playing state changes
  useEffect(() => {
    if (isPlaying && zoomKeyframes && zoomKeyframes.length > 0) {
      zoomFrameRef.current = requestAnimationFrame(updateZoom);
    }
    return () => {
      if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
    };
  }, [isPlaying, updateZoom, zoomKeyframes]);

  // Clear zoom when keyframes are removed
  useEffect(() => {
    if (!zoomKeyframes || zoomKeyframes.length === 0) {
      setZoomStyle({});
      dampedRef.current = { x: 0.5, y: 0.5, scale: 1.0 };
    }
  }, [zoomKeyframes]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isFinite(video.duration)) {
      video.currentTime = 1e10;
      video.addEventListener('timeupdate', function fix() {
        video.removeEventListener('timeupdate', fix);
        video.currentTime = 0;
        setDuration(video.duration);
        onDurationLoaded?.(video.duration);
      });
    } else {
      setDuration(video.duration);
      onDurationLoaded?.(video.duration);
    }
  }, [onDurationLoaded]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isFinite(video.duration)) return;
    const time = video.currentTime;
    setCurrentTime(time);
    setProgress((time / video.duration) * 100);
    onTimeUpdate?.(time);
  }, [onTimeUpdate]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(100);
    setZoomStyle({});
    dampedRef.current = { x: 0.5, y: 0.5, scale: 1.0 };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (progress >= 99) {
        video.currentTime = 0;
        setProgress(0);
        dampedRef.current = { x: 0.5, y: 0.5, scale: 1.0 };
      }
      video.play();
      setIsPlaying(true);
    }
  }, [isPlaying, progress]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      if (!video || !isFinite(video.duration)) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      video.currentTime = pct * video.duration;
      // Snap damped state to target on seek
      if (zoomKeyframes && zoomKeyframes.length > 0) {
        const target = interpolateZoom(zoomKeyframes, video.currentTime);
        dampedRef.current = { ...target };
        updateZoom();
      }
    },
    [zoomKeyframes, updateZoom],
  );

  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasZoom = zoomKeyframes && zoomKeyframes.length > 0;

  if (!videoUrl) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200"
        style={{ width, height }}
      >
        <p className="text-gray-400 text-sm">No video to play</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" style={{ width }}>
      {/* Video container - overflow hidden clips the zoomed video */}
      <div
        className="bg-black rounded-lg border border-gray-200 overflow-hidden relative"
        style={{ width, height }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          style={zoomStyle}
          autoPlay={autoPlay}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Zoom indicator */}
        {hasZoom && isPlaying && zoomStyle.transform && zoomStyle.transform !== 'scale(1)' && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            ZOOM
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors shrink-0"
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div
          className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs text-gray-500 font-mono min-w-[5rem] text-right shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
