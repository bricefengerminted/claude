import { useMemo } from 'react'
import type { VideoSegment } from '../types'

interface Props {
  segments: VideoSegment[];
  totalDuration: number;
  currentTime: number;
  /** Set of segment indices the user has marked to cut */
  cutSegments: Set<number>;
  onToggleCut: (index: number) => void;
  onSeek: (timeSec: number) => void;
}

export default function Timeline({
  segments,
  totalDuration,
  currentTime,
  cutSegments,
  onToggleCut,
  onSeek,
}: Props) {
  const playheadPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  const stats = useMemo(() => {
    let deadTime = 0;
    let cutTime = 0;
    segments.forEach((seg, i) => {
      const dur = seg.endSec - seg.startSec;
      if (seg.type === 'dead') deadTime += dur;
      if (cutSegments.has(i)) cutTime += dur;
    });
    return { deadTime, cutTime };
  }, [segments, cutSegments]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * totalDuration);
  };

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-500">
          Total: <span className="font-mono font-medium text-gray-700">{formatTime(totalDuration)}</span>
        </span>
        {stats.deadTime > 0 && (
          <span className="text-gray-500">
            Dead time: <span className="font-mono font-medium text-amber-600">{formatTime(stats.deadTime)}</span>
          </span>
        )}
        {stats.cutTime > 0 && (
          <span className="text-gray-500">
            Cutting: <span className="font-mono font-medium text-red-600">{formatTime(stats.cutTime)}</span>
          </span>
        )}
        {stats.cutTime > 0 && (
          <span className="text-gray-500">
            Result: <span className="font-mono font-medium text-green-600">{formatTime(totalDuration - stats.cutTime)}</span>
          </span>
        )}
      </div>

      {/* Timeline bar */}
      <div
        className="relative h-10 rounded-lg overflow-hidden cursor-pointer border border-gray-200"
        onClick={handleBarClick}
      >
        {/* Segments */}
        <div className="absolute inset-0 flex">
          {segments.map((seg, i) => {
            const widthPct = ((seg.endSec - seg.startSec) / totalDuration) * 100;
            const isCut = cutSegments.has(i);
            const isDead = seg.type === 'dead';

            let bgClass: string;
            if (isCut) {
              bgClass = 'bg-red-200 hover:bg-red-300';
            } else if (isDead) {
              bgClass = 'bg-amber-100 hover:bg-amber-200';
            } else {
              bgClass = 'bg-green-100 hover:bg-green-200';
            }

            return (
              <div
                key={i}
                className={`relative h-full border-r border-white/50 transition-colors ${bgClass}`}
                style={{ width: `${widthPct}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCut(i);
                }}
                title={`${isDead ? 'Dead' : 'Active'} segment: ${formatTime(seg.startSec)} - ${formatTime(seg.endSec)}${isCut ? ' (will be cut)' : ''}`}
              >
                {/* Strikethrough pattern for cut segments */}
                {isCut && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-red-400" />
                  </div>
                )}

                {/* Label for segments wide enough */}
                {widthPct > 8 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[10px] font-medium ${isCut ? 'text-red-500 line-through' : isDead ? 'text-amber-600' : 'text-green-700'}`}>
                      {formatTime(seg.endSec - seg.startSec)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-brand-600 z-10 pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-brand-600 rounded-full" />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          Active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
          Dead time
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-300" />
          Will be cut
        </span>
        <span className="ml-auto text-gray-400">Click segments to toggle cut</span>
      </div>
    </div>
  );
}
