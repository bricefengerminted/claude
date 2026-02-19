import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import type { RRWebEvent } from '../types'

type RecordingState = 'idle' | 'recording' | 'done';

export default function RecorderPage() {
  const navigate = useNavigate();
  const { dispatch } = useDemo();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const eventsRef = useRef<RRWebEvent[]>([]);

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number>();

  // Tab state: 'demo' (built-in demo page) or 'upload' (JSON file)
  const [activeTab, setActiveTab] = useState<'demo' | 'upload'>('demo');

  const startRecording = useCallback(async () => {
    try {
      const { record } = await import('rrweb');

      eventsRef.current = [];
      setEventCount(0);
      setElapsed(0);
      setError(null);

      const stopFn = record({
        emit: (event: any) => {
          eventsRef.current.push(event);
          setEventCount((c) => c + 1);
        },
        sampling: {
          mousemove: true,
          mouseInteraction: true,
          scroll: 150,
          input: 'last',
        },
      });

      if (stopFn) {
        stopRecordingRef.current = stopFn;
      }

      setRecordingState('recording');

      // Start timer
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - start);
      }, 100);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to initialize recording. Please try again.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
      stopRecordingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setRecordingState('done');
  }, []);

  const saveAndContinue = useCallback(() => {
    if (eventsRef.current.length < 5) {
      setError('Recording too short. Please record for at least a few seconds.');
      return;
    }
    dispatch({
      type: 'CREATE_PROJECT',
      name: `Demo ${new Date().toLocaleString()}`,
      events: eventsRef.current,
    });
    navigate('/edit');
  }, [dispatch, navigate]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const events = JSON.parse(evt.target?.result as string);
          if (!Array.isArray(events) || events.length < 2) {
            setError('Invalid recording file. Expected an array of rrweb events.');
            return;
          }
          dispatch({
            type: 'CREATE_PROJECT',
            name: file.name.replace('.json', ''),
            events,
          });
          navigate('/edit');
        } catch {
          setError('Failed to parse file. Ensure it\'s valid JSON.');
        }
      };
      reader.readAsText(file);
    },
    [dispatch, navigate],
  );

  const reset = useCallback(() => {
    eventsRef.current = [];
    setRecordingState('idle');
    setElapsed(0);
    setEventCount(0);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopRecordingRef.current) stopRecordingRef.current();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remaining = s % 60;
    return `${m}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record a Demo</h1>
        <p className="text-gray-500 mt-1">
          Interact with the demo page below, then we'll enhance the recording.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'demo'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('demo')}
        >
          Record Demo Page
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'upload'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Recording
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === 'demo' ? (
        <>
          {/* Recording controls */}
          <div className="flex items-center gap-4 mb-4">
            {recordingState === 'idle' && (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <span className="w-3 h-3 bg-white rounded-full" />
                Start Recording
              </button>
            )}

            {recordingState === 'recording' && (
              <>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <span className="w-3 h-3 bg-red-500 rounded recording-indicator" />
                  Stop Recording
                </button>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="font-mono">{formatTime(elapsed)}</span>
                  <span>{eventCount} events captured</span>
                </div>
              </>
            )}

            {recordingState === 'done' && (
              <>
                <button
                  onClick={saveAndContinue}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Enhance This Recording
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Record Again
                </button>
                <div className="text-sm text-gray-500">
                  {formatTime(elapsed)} recorded, {eventCount} events
                </div>
              </>
            )}
          </div>

          {/* Recording status bar */}
          {recordingState === 'recording' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full recording-indicator" />
              Recording in progress. Interact with the page below, then click "Stop
              Recording" when done.
            </div>
          )}

          {/* Demo page iframe */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400">
                  flowboard.app
                </div>
              </div>
            </div>
            <iframe
              ref={iframeRef}
              src="/demo-content"
              title="Demo content"
              className="w-full border-0"
              style={{ height: '600px' }}
            />
          </div>
        </>
      ) : (
        /* Upload tab */
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Upload rrweb Recording
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Upload a JSON file containing rrweb events from your own page.
            </p>
            <label className="inline-block px-6 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 cursor-pointer transition-colors">
              Choose File
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>

            {/* Recording snippet */}
            <div className="mt-8 text-left">
              <h4 className="font-medium text-sm text-gray-900 mb-2">
                How to record your own page
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                Add this snippet to your page, do the demo, then run{' '}
                <code className="bg-gray-100 px-1 rounded">stopAndDownload()</code>{' '}
                in the console:
              </p>
              <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto">
{`<script src="https://cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js"></script>
<script>
  let events = [];
  rrwebRecord({ emit(e) { events.push(e); } });
  window.stopAndDownload = () => {
    const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'recording.json';
    a.click();
  };
</script>`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
