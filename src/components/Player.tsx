import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  videoUrl: string;
  playbackSpeed?: number;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationLoaded?: (duration: number) => void;
}

export default function Player({
  videoUrl,
  playbackSpeed = 1.0,
  width = 720,
  height = 450,
  autoPlay = false,
  onTimeUpdate,
  onDurationLoaded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // webm files sometimes report Infinity duration; seek to fix it
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
    },
    [],
  );

  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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
    <div className="space-y-3">
      {/* Video container */}
      <div
        className="bg-black rounded-lg border border-gray-200 overflow-hidden relative"
        style={{ width, height }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          autoPlay={autoPlay}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors"
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

        <span className="text-xs text-gray-500 font-mono min-w-[5rem] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
