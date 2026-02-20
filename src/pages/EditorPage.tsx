import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import Player from '../components/Player'
import type { ZoomPoint } from '../components/Player'
import DeviceFrame from '../components/DeviceFrame'
import Timeline from '../components/Timeline'
import type { ZoomKeyframe } from '../types'
import { analyzeVideo } from '../engine/video-analyzer'
import { downloadBlob, exportWithEffects, convertToMp4 } from '../engine/exporter'

type DeviceType = 'none' | 'laptop' | 'phone';

const DEVICE_SIZES: Record<DeviceType, { width: number; height: number }> = {
  none: { width: 720, height: 450 },
  laptop: { width: 680, height: 425 },
  phone: { width: 280, height: 540 },
};

const ZOOM_SCALE = 1.5;
const ZOOM_EASE_SEC = 0.4;
const DEFAULT_ZOOM_HOLD_SEC = 3.0;

/** Convert manual zoom points into a sorted keyframe array for preview & export. */
function zoomPointsToKeyframes(points: ZoomPoint[], duration: number): ZoomKeyframe[] {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.timeSec - b.timeSec);
  const keyframes: ZoomKeyframe[] = [];

  for (const pt of sorted) {
    const easeIn = Math.max(0, pt.timeSec - ZOOM_EASE_SEC);
    const holdEnd = Math.min(duration, pt.timeSec + pt.holdSec);
    const easeOut = Math.min(duration, holdEnd + ZOOM_EASE_SEC);

    // Ease in from no-zoom
    keyframes.push({ timeSec: easeIn, x: pt.x, y: pt.y, scale: 1.0 });
    // Zoomed in
    keyframes.push({ timeSec: pt.timeSec, x: pt.x, y: pt.y, scale: ZOOM_SCALE });
    // Hold
    keyframes.push({ timeSec: holdEnd, x: pt.x, y: pt.y, scale: ZOOM_SCALE });
    // Ease out
    keyframes.push({ timeSec: easeOut, x: pt.x, y: pt.y, scale: 1.0 });
  }

  // Sort everything by time, dedup overlapping resets
  keyframes.sort((a, b) => a.timeSec - b.timeSec);
  return keyframes;
}

export default function EditorPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useDemo();
  const project = state.currentProject;

  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);

  // Edit state
  const [cutSegments, setCutSegments] = useState<Set<number>>(new Set());
  const [autoCutDead, setAutoCutDead] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<DeviceType>('none');

  // Manual zoom points
  const [zoomPoints, setZoomPoints] = useState<ZoomPoint[]>([]);
  const [zoomEditMode, setZoomEditMode] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const analysis = project?.analysis ?? null;

  // Convert manual zoom points to keyframes for preview & export
  const zoomKeyframes = useMemo(
    () => zoomPointsToKeyframes(zoomPoints, videoDuration),
    [zoomPoints, videoDuration],
  );

  // Auto-cut: mark all dead segments as cut
  const effectiveCutSegments = useMemo(() => {
    if (!autoCutDead || !analysis) return cutSegments;
    const combined = new Set(cutSegments);
    analysis.segments.forEach((seg, i) => {
      if (seg.type === 'dead') combined.add(i);
    });
    return combined;
  }, [cutSegments, autoCutDead, analysis]);

  const handleAnalyze = useCallback(async () => {
    if (!project) return;
    setAnalyzing(true);
    setAnalyzeProgress(0);
    try {
      const result = await analyzeVideo(project.videoUrl, {
        onProgress: setAnalyzeProgress,
      });
      dispatch({ type: 'SET_ANALYSIS', analysis: result });

      const hasDead = result.segments.some((s) => s.type === 'dead');
      if (hasDead) setAutoCutDead(true);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [project, dispatch]);

  const handleToggleCut = useCallback((index: number) => {
    setCutSegments((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleAddZoomPoint = useCallback((timeSec: number, x: number, y: number) => {
    const id = `zp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setZoomPoints((prev) => [...prev, { id, timeSec, x, y, holdSec: DEFAULT_ZOOM_HOLD_SEC }]);
  }, []);

  const handleUpdateZoomHold = useCallback((id: string, holdSec: number) => {
    setZoomPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, holdSec } : p)),
    );
  }, []);

  const handleRemoveZoomPoint = useCallback((id: string) => {
    setZoomPoints((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleClearZoomPoints = useCallback(() => {
    setZoomPoints([]);
  }, []);

  // Export status message for multi-step process
  const [exportStatus, setExportStatus] = useState('');

  const handleExport = useCallback(async () => {
    if (!project || !analysis) return;
    setExporting(true);
    setExportProgress(0);
    setExportStatus('Rendering video...');
    try {
      const webmBlob = await exportWithEffects({
        videoUrl: project.videoUrl,
        segments: analysis.segments,
        cutSegments: effectiveCutSegments,
        zoomKeyframes: zoomKeyframes,
        enableZoom: zoomPoints.length > 0,
        playbackSpeed: project.settings.playbackSpeed,
        onProgress: (pct) => setExportProgress(Math.round(pct * 0.6)),
      });

      setExportStatus('Converting to MP4...');
      const mp4Blob = await convertToMp4(webmBlob, (pct) => {
        setExportProgress(60 + Math.round(pct * 0.4));
      });

      downloadBlob(mp4Blob, `${project.name}-edited.mp4`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
      setExportStatus('');
    }
  }, [project, analysis, effectiveCutSegments, zoomKeyframes, zoomPoints.length]);

  const handleDownloadRaw = useCallback(() => {
    if (!project) return;
    downloadBlob(project.videoBlob, `${project.name}.webm`);
  }, [project]);

  const handleSettingsChange = useCallback(
    (settings: any) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings });
    },
    [dispatch],
  );

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No recording loaded
        </h2>
        <p className="text-gray-500 mb-6">
          Record a screen capture first to start editing.
        </p>
        <button
          onClick={() => navigate('/record')}
          className="px-6 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          Go to Recorder
        </button>
      </div>
    );
  }

  const formatDuration = (sec: number) => {
    if (!isFinite(sec) || sec === 0) return '--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimePrecise = (sec: number) => {
    if (!isFinite(sec)) return '0:00.0';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const deadCount = analysis?.segments.filter((s) => s.type === 'dead').length ?? 0;
  const playerSize = DEVICE_SIZES[deviceFrame];
  const sortedZoomPoints = [...zoomPoints].sort((a, b) => a.timeSec - b.timeSec);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit & Export</h1>
        <p className="text-gray-500 mt-1">
          Analyze your recording, add zoom effects, and export.
        </p>
      </div>

      {/* Timeline section - full width above the grid */}
      {analysis && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Timeline</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCutDead}
                  onChange={(e) => setAutoCutDead(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-600"
                />
                <span className="text-gray-600">Auto-cut dead time ({deadCount} segments)</span>
              </label>
            </div>
          </div>
          <Timeline
            segments={analysis.segments}
            totalDuration={analysis.totalDuration}
            currentTime={currentTime}
            cutSegments={effectiveCutSegments}
            onToggleCut={handleToggleCut}
            onSeek={() => {}}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Analyze button */}
          {!analysis && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Smart Analysis
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Scan your video to detect dead time for auto-trim.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full py-2.5 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing... {analyzeProgress}%
                  </span>
                ) : (
                  'Analyze Video'
                )}
              </button>
              {analyzing && (
                <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-300"
                    style={{ width: `${analyzeProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Analysis results */}
          {analysis && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Analysis Results
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Frames analyzed</dt>
                  <dd className="font-mono text-gray-900">{analysis.frameCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Active segments</dt>
                  <dd className="font-mono text-green-600">
                    {analysis.segments.filter((s) => s.type === 'active').length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Dead segments</dt>
                  <dd className="font-mono text-amber-600">{deadCount}</dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full py-2 px-4 text-xs text-gray-500 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Re-analyze
                </button>
              </div>
            </div>
          )}

          {/* Zoom Points */}
          <div className={`bg-white rounded-xl border p-6 space-y-4 transition-colors ${
            zoomEditMode ? 'border-brand-400 ring-2 ring-brand-100' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Zoom Points</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {zoomEditMode
                    ? 'Double-click on the video to add zoom'
                    : 'Click Edit to place zoom points on the video'}
                </p>
              </div>
              <button
                onClick={() => setZoomEditMode(!zoomEditMode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  zoomEditMode
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {zoomEditMode ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Editing
                  </span>
                ) : 'Edit'}
              </button>
            </div>

            {/* Zoom points list */}
            {sortedZoomPoints.length > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {sortedZoomPoints.map((pt, idx) => (
                  <div
                    key={pt.id}
                    className="bg-gray-50 rounded-lg group"
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5">
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-mono text-gray-700 flex-1">
                        {formatTimePrecise(pt.timeSec)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        ({Math.round(pt.x * 100)}%, {Math.round(pt.y * 100)}%)
                      </span>
                      <button
                        onClick={() => handleRemoveZoomPoint(pt.id)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all shrink-0"
                        title="Remove zoom point"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    {/* Per-point hold duration input */}
                    <div className="flex items-center gap-2 px-2.5 pb-2">
                      <span className="text-[10px] text-gray-400 shrink-0 w-10">Hold</span>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={pt.holdSec}
                        onChange={(e) => handleUpdateZoomHold(pt.id, Math.max(0.5, Number(e.target.value)))}
                        className="flex-1 h-6 px-2 text-xs font-mono text-gray-700 bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-[10px] text-gray-400 shrink-0">sec</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <div className="text-gray-300 mb-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mx-auto">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400">
                  No zoom points yet
                </p>
              </div>
            )}

            {sortedZoomPoints.length > 0 && (
              <button
                onClick={handleClearZoomPoints}
                className="w-full py-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear all zoom points
              </button>
            )}
          </div>

          {/* Device Frame selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Device Frame</h3>
            <div className="flex gap-2">
              {([
                { value: 'none', label: 'None', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )},
                { value: 'laptop', label: 'Laptop', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 01-.9 1.45H3.62a1 1 0 01-.9-1.45L4 16" />
                  </svg>
                )},
                { value: 'phone', label: 'Phone', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                )},
              ] as const).map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => setDeviceFrame(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    deviceFrame === value
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Playback speed */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Playback Speed</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">{project.settings.playbackSpeed}x</span>
              </div>
              <input
                type="range"
                min={0.25}
                max={2.0}
                step={0.25}
                value={project.settings.playbackSpeed}
                onChange={(e) => handleSettingsChange({ playbackSpeed: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0.25x</span>
                <span>1x</span>
                <span>2x</span>
              </div>
            </div>
          </div>

          {/* Recording info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Recording</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Duration</dt>
                <dd className="font-mono text-gray-900">
                  {formatDuration(videoDuration || project.duration)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Size</dt>
                <dd className="font-mono text-gray-900">
                  {(project.videoBlob.size / (1024 * 1024)).toFixed(1)} MB
                </dd>
              </div>
            </dl>
          </div>

          {/* Export */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Export</h3>

            {analysis && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full py-2.5 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {exportStatus || 'Exporting...'} {exportProgress}%
                  </span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export as MP4
                  </>
                )}
              </button>
            )}

            {exporting && (
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}

            <button
              onClick={handleDownloadRaw}
              className="w-full py-2 px-4 text-sm text-gray-600 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Download Original
            </button>
          </div>

          <button
            onClick={() => navigate('/record')}
            className="w-full py-2 px-4 text-sm text-gray-600 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Record New Video
          </button>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2 flex items-start justify-center">
          <DeviceFrame type={deviceFrame}>
            <Player
              videoUrl={project.videoUrl}
              playbackSpeed={project.settings.playbackSpeed}
              zoomKeyframes={zoomPoints.length > 0 ? zoomKeyframes : undefined}
              zoomEditMode={zoomEditMode}
              zoomPoints={zoomPoints}
              onZoomPointAdd={handleAddZoomPoint}
              width={playerSize.width}
              height={playerSize.height}
              onDurationLoaded={setVideoDuration}
              onTimeUpdate={setCurrentTime}
            />
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}
