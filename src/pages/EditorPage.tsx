import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import Player from '../components/Player'
import Timeline from '../components/Timeline'
import { analyzeVideo } from '../engine/video-analyzer'
import { downloadBlob, exportWithEffects } from '../engine/exporter'

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
  const [enableZoom, setEnableZoom] = useState(false);
  const [autoCutDead, setAutoCutDead] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const analysis = project?.analysis ?? null;

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

      // Auto-enable dead time cutting if there are dead segments
      const hasDead = result.segments.some((s) => s.type === 'dead');
      if (hasDead) setAutoCutDead(true);

      // Auto-enable zoom if keyframes were found
      if (result.zoomKeyframes.length > 0) setEnableZoom(true);
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

  const handleExport = useCallback(async () => {
    if (!project || !analysis) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const blob = await exportWithEffects({
        videoUrl: project.videoUrl,
        segments: analysis.segments,
        cutSegments: effectiveCutSegments,
        zoomKeyframes: enableZoom ? analysis.zoomKeyframes : [],
        enableZoom,
        playbackSpeed: project.settings.playbackSpeed,
        onProgress: setExportProgress,
      });
      downloadBlob(blob, `${project.name}-edited.webm`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [project, analysis, effectiveCutSegments, enableZoom]);

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

  const deadCount = analysis?.segments.filter((s) => s.type === 'dead').length ?? 0;
  const zoomCount = analysis?.zoomKeyframes.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit & Export</h1>
        <p className="text-gray-500 mt-1">
          Analyze your recording to auto-trim dead time and add zoom effects.
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
                Scan your video to detect dead time and activity hotspots for
                auto-trim and zoom effects.
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
                <div className="flex justify-between">
                  <dt className="text-gray-500">Zoom keyframes</dt>
                  <dd className="font-mono text-brand-600">{zoomCount}</dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-gray-100 space-y-3">
                {/* Zoom toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Auto Zoom</div>
                    <div className="text-xs text-gray-500">{zoomCount} keyframes detected</div>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={enableZoom}
                      onChange={(e) => setEnableZoom(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors ${enableZoom ? 'bg-brand-600' : 'bg-gray-200'}`}>
                      <div className={`w-4 h-4 mt-1 rounded-full bg-white shadow transition-transform ${enableZoom ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                  </div>
                </label>

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
                    Exporting... {exportProgress}%
                  </span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export with Effects
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
        <div className="lg:col-span-2">
          <Player
            videoUrl={project.videoUrl}
            playbackSpeed={project.settings.playbackSpeed}
            zoomKeyframes={enableZoom && analysis ? analysis.zoomKeyframes : undefined}
            width={720}
            height={450}
            onDurationLoaded={setVideoDuration}
            onTimeUpdate={setCurrentTime}
          />
        </div>
      </div>
    </div>
  );
}
