import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import Player from '../components/Player'
import DeviceFrame from '../components/DeviceFrame'
import { downloadBlob } from '../engine/exporter'

type DeviceType = 'none' | 'laptop' | 'phone';

export default function EditorPage() {
  const navigate = useNavigate();
  const { state, dispatch } = useDemo();
  const project = state.currentProject;

  const [deviceFrame, setDeviceFrame] = useState<DeviceType>('none');
  const [videoDuration, setVideoDuration] = useState(0);

  const handleSettingsChange = useCallback(
    (settings: any) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings });
    },
    [dispatch],
  );

  const handleDownload = useCallback(() => {
    if (!project) return;
    downloadBlob(project.videoBlob, `${project.name}.webm`);
  }, [project]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Preview & Export
        </h1>
        <p className="text-gray-500 mt-1">
          Review your recording and download the video.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Playback settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Playback Settings
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Adjust playback speed for preview
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">Playback Speed</span>
                <span className="text-gray-500">{project.settings.playbackSpeed}x</span>
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
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Recording Info
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900 truncate ml-4">
                  {project.name}
                </dd>
              </div>
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

          {/* Export options */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Export</h3>

            {/* Device frame selector */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">
                Device Frame (preview only)
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

            <button
              onClick={handleDownload}
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
              Download Video (.webm)
            </button>
          </div>

          {/* Back to recorder */}
          <button
            onClick={() => navigate('/record')}
            className="w-full py-2 px-4 text-sm text-gray-600 font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Record New Video
          </button>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2">
          <div className="flex justify-center">
            <DeviceFrame type={deviceFrame}>
              <Player
                videoUrl={project.videoUrl}
                playbackSpeed={project.settings.playbackSpeed}
                width={deviceFrame === 'phone' ? 280 : 720}
                height={deviceFrame === 'phone' ? 560 : 450}
                onDurationLoaded={setVideoDuration}
              />
            </DeviceFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
