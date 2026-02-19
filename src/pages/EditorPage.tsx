import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import Player from '../components/Player'
import EnhancementControls from '../components/EnhancementControls'
import DeviceFrame from '../components/DeviceFrame'
import { enhanceRecording, getEnhancementStats } from '../engine/enhancer'
import { startTabCapture, downloadBlob } from '../engine/exporter'

type ViewMode = 'original' | 'enhanced';
type DeviceType = 'none' | 'laptop' | 'phone';

export default function EditorPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useDemo();
  const project = state.currentProject;

  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const [isProcessing, setIsProcessing] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<DeviceType>('laptop');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const exportRef = useRef<{ stop: () => void; getBlob: () => Promise<Blob> } | null>(null);

  const handleApplyEnhancements = useCallback(() => {
    if (!project) return;

    setIsProcessing(true);

    // Run enhancement in a setTimeout to let the UI update
    setTimeout(() => {
      const enhanced = enhanceRecording(project.rawEvents, project.settings);
      dispatch({ type: 'SET_ENHANCED_EVENTS', events: enhanced });
      setIsProcessing(false);
      setViewMode('enhanced');
    }, 100);
  }, [project, dispatch]);

  const handleSettingsChange = useCallback(
    (settings: any) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings });
    },
    [dispatch],
  );

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true);
      setExportProgress('Starting screen capture...');

      const capture = await startTabCapture({
        format: 'webm',
        quality: 'high',
      });
      exportRef.current = capture;

      setExportProgress(
        'Recording in progress. The enhanced replay will play. Click "Stop Export" when done.',
      );
    } catch (err) {
      console.error('Export failed:', err);
      setExportProgress('');
      setIsExporting(false);
    }
  }, []);

  const handleStopExport = useCallback(async () => {
    if (!exportRef.current) return;

    setExportProgress('Saving video...');
    exportRef.current.stop();
    const blob = await exportRef.current.getBlob();
    downloadBlob(blob, `demoreel-${Date.now()}.webm`);
    exportRef.current = null;
    setIsExporting(false);
    setExportProgress('');
  }, []);

  const handleDownloadJson = useCallback(() => {
    if (!project) return;
    const events = project.enhancedEvents || project.rawEvents;
    const blob = new Blob([JSON.stringify(events, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, `${project.name}-enhanced.json`);
  }, [project]);

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No recording loaded
        </h2>
        <p className="text-gray-500 mb-6">
          Record or upload a demo first to start enhancing.
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

  const stats =
    project.enhancedEvents
      ? getEnhancementStats(project.rawEvents, project.enhancedEvents)
      : null;

  const currentEvents =
    viewMode === 'enhanced' && project.enhancedEvents
      ? project.enhancedEvents
      : project.rawEvents;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Enhance & Export
        </h1>
        <p className="text-gray-500 mt-1">
          Fine-tune your recording and export a polished demo video.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="space-y-6">
          <EnhancementControls
            settings={project.settings}
            onChange={handleSettingsChange}
            onApply={handleApplyEnhancements}
            isProcessing={isProcessing}
          />

          {/* Enhancement stats */}
          {stats && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Enhancement Results
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Original duration</dt>
                  <dd className="font-mono text-gray-900">
                    {(stats.originalDuration / 1000).toFixed(1)}s
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Enhanced duration</dt>
                  <dd className="font-mono text-gray-900">
                    {(stats.enhancedDuration / 1000).toFixed(1)}s
                  </dd>
                </div>
                {stats.timeSaved > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Time saved</dt>
                    <dd className="font-mono text-green-600">
                      -{(stats.timeSaved / 1000).toFixed(1)}s
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Export options */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Export</h3>

            {/* Device frame selector */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">
                Device Frame
              </label>
              <div className="flex gap-2">
                {(['none', 'laptop', 'phone'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDeviceFrame(type)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      deviceFrame === type
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'none' ? 'No frame' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Export buttons */}
            <div className="space-y-2">
              {!isExporting ? (
                <button
                  onClick={handleExport}
                  className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export as Video
                </button>
              ) : (
                <button
                  onClick={handleStopExport}
                  className="w-full py-2.5 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Stop Export & Download
                </button>
              )}

              {exportProgress && (
                <p className="text-xs text-gray-500">{exportProgress}</p>
              )}

              <button
                onClick={handleDownloadJson}
                className="w-full py-2 px-4 text-sm text-gray-600 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Download as JSON
              </button>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2">
          {/* View toggle */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setViewMode('original')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'original'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setViewMode('enhanced')}
              disabled={!project.enhancedEvents}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'enhanced'
                  ? 'bg-brand-600 text-white'
                  : project.enhancedEvents
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              Enhanced
            </button>
            {!project.enhancedEvents && (
              <span className="text-xs text-gray-400 ml-2">
                Apply enhancements to preview
              </span>
            )}
          </div>

          {/* Player with optional device frame */}
          <div className="flex justify-center">
            <DeviceFrame type={deviceFrame}>
              <Player
                key={`${viewMode}-${project.enhancedEvents ? 'has' : 'no'}`}
                events={currentEvents}
                width={deviceFrame === 'phone' ? 280 : 720}
                height={deviceFrame === 'phone' ? 560 : 450}
              />
            </DeviceFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
