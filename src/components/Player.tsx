import { useEffect, useRef, useState, useCallback } from 'react'
import type { RRWebEvent } from '../types'

interface Props {
  events: RRWebEvent[];
  width?: number;
  height?: number;
  autoPlay?: boolean;
  onFinish?: () => void;
}

/**
 * rrweb Replay Player component.
 *
 * Dynamically imports rrweb's Replayer class to avoid SSR issues
 * and renders the replay into a container div.
 */
export default function Player({
  events,
  width = 800,
  height = 500,
  autoPlay = false,
  onFinish,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressInterval = useRef<number>();

  const initReplayer = useCallback(async () => {
    if (!containerRef.current || events.length < 2) return;

    try {
      // Clear previous
      if (replayerRef.current) {
        try { replayerRef.current.pause(); } catch {}
        containerRef.current.innerHTML = '';
      }

      const { Replayer } = await import('rrweb');

      const replayer = new Replayer(events as any, {
        root: containerRef.current,
        skipInactive: true,
        showWarning: false,
        showDebug: false,
        liveMode: false,
        insertStyleRules: [
          // Hide any scrollbars for cleaner look
          '*::-webkit-scrollbar { display: none !important; }',
          '* { scrollbar-width: none !important; }',
        ],
      });

      replayerRef.current = replayer;

      const totalDuration =
        events[events.length - 1].timestamp - events[0].timestamp;
      setDuration(totalDuration);
      setReady(true);
      setError(null);

      // Auto-play if requested
      if (autoPlay) {
        setTimeout(() => {
          replayer.play();
          setIsPlaying(true);
        }, 500);
      }
    } catch (err) {
      console.error('Failed to initialize replayer:', err);
      setError('Failed to load replay engine. Events may be invalid.');
    }
  }, [events, autoPlay]);

  useEffect(() => {
    initReplayer();
    return () => {
      if (replayerRef.current) {
        try { replayerRef.current.pause(); } catch {}
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [initReplayer]);

  // Track progress
  useEffect(() => {
    if (isPlaying && replayerRef.current) {
      progressInterval.current = window.setInterval(() => {
        try {
          const meta = replayerRef.current.getMetaData();
          const currentTime = replayerRef.current.getCurrentTime();
          const totalTime = meta.totalTime;
          setProgress((currentTime / totalTime) * 100);

          if (currentTime >= totalTime) {
            setIsPlaying(false);
            setProgress(100);
            clearInterval(progressInterval.current);
            onFinish?.();
          }
        } catch {
          // replayer may not be ready yet
        }
      }, 100);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isPlaying, onFinish]);

  const togglePlay = () => {
    if (!replayerRef.current || !ready) return;

    if (isPlaying) {
      replayerRef.current.pause();
      setIsPlaying(false);
    } else {
      if (progress >= 99) {
        // Restart from beginning
        replayerRef.current.play(0);
        setProgress(0);
      } else {
        replayerRef.current.resume();
      }
      setIsPlaying(true);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remaining = s % 60;
    return `${m}:${remaining.toString().padStart(2, '0')}`;
  };

  if (events.length < 2) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200"
        style={{ width, height }}
      >
        <p className="text-gray-400 text-sm">No recording to play</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Replay container */}
      <div
        className="bg-white rounded-lg border border-gray-200 overflow-hidden relative"
        style={{ width, height }}
      >
        <div ref={containerRef} className="w-full h-full" />

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
            <p className="text-red-600 text-sm text-center px-4">{error}</p>
          </div>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="animate-spin h-6 w-6 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!ready}
          className="w-10 h-10 flex items-center justify-center bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-50 transition-colors"
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
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-600 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <span className="text-xs text-gray-500 font-mono min-w-[4rem] text-right">
          {formatTime((progress / 100) * duration)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
