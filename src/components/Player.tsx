import { useRef, useState, useEffect, useCallback } from 'react'
import type { ZoomKeyframe } from '../types'

export interface ZoomPoint {
  id: string;
  timeSec: number;
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  holdSec: number; // how long to hold the zoom
}

interface Props {
  videoUrl: string;
  playbackSpeed?: number;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  zoomKeyframes?: ZoomKeyframe[];
  zoomEditMode?: boolean;
  zoomPoints?: ZoomPoint[];
  onZoomPointAdd?: (timeSec: number, x: number, y: number) => void;
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

interface ClickRipple {
  id: number;
  x: number; // px relative to container
  y: number;
}

export default function Player({
  videoUrl,
  playbackSpeed = 1.0,
  width = 720,
  height = 450,
  autoPlay = false,
  zoomKeyframes,
  zoomEditMode = false,
  zoomPoints,
  onZoomPointAdd,
  onTimeUpdate,
  onDurationLoaded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomFrameRef = useRef<number>();
  const dampedRef = useRef({ x: 0.5, y: 0.5, scale: 1.0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({});
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const rippleIdRef = useRef(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Zoom animation loop with damping
  const updateZoom = useCallback(() => {
    const video = videoRef.current;
    if (!video || !zoomKeyframes || zoomKeyframes.length === 0) {
      setZoomStyle({});
      dampedRef.current = { x: 0.5, y: 0.5, scale: 1.0 };
      return;
    }

    const target = interpolateZoom(zoomKeyframes, video.currentTime);
    const d = dampedRef.current;

    const damping = 0.08;
    d.x += (target.x - d.x) * damping;
    d.y += (target.y - d.y) * damping;
    d.scale += (target.scale - d.scale) * damping;

    if (d.scale > 1.02) {
      // Clamp so we never pan past the video edges
      const halfVisible = 0.5 / d.scale;
      const cx = Math.max(halfVisible, Math.min(1 - halfVisible, d.x));
      const cy = Math.max(halfVisible, Math.min(1 - halfVisible, d.y));

      // scale(S) translate(tx,ty) → translate is applied first, then scale
      // To center point (cx,cy) in the viewport: tx = (0.5 - cx) * 100%
      const tx = (0.5 - cx) * 100;
      const ty = (0.5 - cy) * 100;
      setZoomStyle({
        transform: `scale(${d.scale.toFixed(3)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`,
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

  useEffect(() => {
    if (isPlaying && zoomKeyframes && zoomKeyframes.length > 0) {
      zoomFrameRef.current = requestAnimationFrame(updateZoom);
    }
    return () => {
      if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
    };
  }, [isPlaying, updateZoom, zoomKeyframes]);

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
      if (zoomKeyframes && zoomKeyframes.length > 0) {
        const target = interpolateZoom(zoomKeyframes, video.currentTime);
        dampedRef.current = { ...target };
        updateZoom();
      }
    },
    [zoomKeyframes, updateZoom],
  );

  // Double-click on video to add a zoom point
  const handleVideoDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!zoomEditMode || !onZoomPointAdd) return;
      const video = videoRef.current;
      const container = containerRef.current;
      if (!video || !container) return;

      // Pause the video so the user can see what they clicked on
      if (!video.paused) {
        video.pause();
        setIsPlaying(false);
      }

      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Normalize to 0-1 relative to the container
      const normX = Math.max(0, Math.min(1, clickX / rect.width));
      const normY = Math.max(0, Math.min(1, clickY / rect.height));

      onZoomPointAdd(video.currentTime, normX, normY);

      // Show ripple animation
      const id = ++rippleIdRef.current;
      setRipples((prev) => [...prev, { id, x: clickX, y: clickY }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 800);
    },
    [zoomEditMode, onZoomPointAdd],
  );

  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hasZoom = zoomKeyframes && zoomKeyframes.length > 0;

  // Find zoom points near the current time to show as markers on the video
  const visiblePoints = zoomPoints?.filter(
    (p) => Math.abs(p.timeSec - currentTime) < 0.5,
  ) ?? [];

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
      {/* Video container */}
      <div
        ref={containerRef}
        className={`bg-black rounded-lg border overflow-hidden relative ${
          zoomEditMode
            ? 'border-brand-400 ring-2 ring-brand-200 cursor-crosshair'
            : 'border-gray-200'
        }`}
        style={{ width, height }}
        onDoubleClick={handleVideoDoubleClick}
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

        {/* Edit mode hint */}
        {zoomEditMode && !isPlaying && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs font-medium px-3 py-1.5 rounded-full pointer-events-none">
            Double-click to add zoom point
          </div>
        )}

        {/* Zoom indicator */}
        {hasZoom && isPlaying && zoomStyle.transform && zoomStyle.transform !== 'scale(1)' && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full pointer-events-none">
            ZOOM
          </div>
        )}

        {/* Click ripple animations */}
        {ripples.map((r) => (
          <div
            key={r.id}
            className="absolute pointer-events-none"
            style={{ left: r.x, top: r.y, transform: 'translate(-50%, -50%)' }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-brand-400 animate-ping" />
            <div className="absolute inset-0 w-8 h-8 rounded-full bg-brand-500/30" />
          </div>
        ))}

        {/* Visible zoom point markers (near current time) */}
        {zoomEditMode && visiblePoints.map((p) => (
          <div
            key={p.id}
            className="absolute pointer-events-none"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-6 h-6 rounded-full border-2 border-brand-500 bg-brand-500/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-brand-500" />
            </div>
          </div>
        ))}
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
          className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden cursor-pointer relative"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
          {/* Zoom point markers on progress bar */}
          {zoomPoints && duration > 0 && zoomPoints.map((p) => (
            <div
              key={p.id}
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-brand-500 border border-white shadow-sm pointer-events-none"
              style={{ left: `${(p.timeSec / duration) * 100}%`, transform: 'translate(-50%, -50%)' }}
            />
          ))}
        </div>

        <span className="text-xs text-gray-500 font-mono min-w-[5rem] text-right shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
