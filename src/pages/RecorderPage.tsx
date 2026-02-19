import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'

type RecordingState = 'idle' | 'recording' | 'preview';

export default function RecorderPage() {
  const navigate = useNavigate();
  const { dispatch } = useDemo();

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>();
  const videoBlobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      // Prompt user to pick a screen/window/tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
        },
        audio: true, // capture tab/system audio if available
      });

      streamRef.current = stream;

      // Detect if user stops sharing via the browser's built-in "Stop sharing" button
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        finishRecording();
      });

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        videoBlobRef.current = blob;

        // Clean up old preview URL
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = URL.createObjectURL(blob);

        setRecordingState('preview');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // collect chunks every 100ms
      setRecordingState('recording');

      // Start elapsed timer
      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - start);
      }, 100);
    } catch (err: any) {
      // User cancelled the screen picker or browser denied permission
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        setError('Screen sharing was cancelled. Click "Start Recording" to try again.');
      } else {
        console.error('Failed to start recording:', err);
        setError('Failed to start screen capture. Make sure your browser supports screen sharing.');
      }
    }
  }, []);

  const finishRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    finishRecording();
  }, [finishRecording]);

  const saveAndContinue = useCallback(() => {
    const blob = videoBlobRef.current;
    if (!blob || blob.size === 0) {
      setError('Recording is empty. Please try again.');
      return;
    }

    // Get duration from the preview video element
    const videoEl = videoPreviewRef.current;
    const duration = videoEl && isFinite(videoEl.duration) ? videoEl.duration : elapsed / 1000;

    dispatch({
      type: 'CREATE_PROJECT',
      name: `Recording ${new Date().toLocaleString()}`,
      videoBlob: blob,
      duration,
    });
    navigate('/edit');
  }, [dispatch, navigate, elapsed]);

  const reset = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    videoBlobRef.current = null;
    chunksRef.current = [];
    setRecordingState('idle');
    setElapsed(0);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      finishRecording();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [finishRecording]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remaining = s % 60;
    return `${m}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Your Screen</h1>
        <p className="text-gray-500 mt-1">
          Capture any screen, window, or browser tab. Pick what to share when prompted.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6">
        {recordingState === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <span className="w-3 h-3 bg-white rounded-full" />
            Start Recording
          </button>
        )}

        {recordingState === 'recording' && (
          <>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              <span className="w-3 h-3 bg-red-500 rounded-sm" />
              Stop Recording
            </button>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full recording-indicator" />
                Recording
              </span>
              <span className="font-mono">{formatTime(elapsed)}</span>
            </div>
          </>
        )}

        {recordingState === 'preview' && (
          <>
            <button
              onClick={saveAndContinue}
              className="px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Continue to Editor
            </button>
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Record Again
            </button>
            <div className="text-sm text-gray-500">
              {formatTime(elapsed)} recorded
            </div>
          </>
        )}
      </div>

      {/* Recording status */}
      {recordingState === 'recording' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full recording-indicator" />
          Recording your screen. Interact with your content, then click "Stop Recording" when finished.
          You can also click the browser's "Stop sharing" button.
        </div>
      )}

      {/* Preview area */}
      {recordingState === 'idle' && (
        <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">No recording yet</p>
          <p className="text-gray-400 text-xs">Click "Start Recording" and pick a screen, window, or tab</p>
        </div>
      )}

      {recordingState === 'recording' && (
        <div className="border border-gray-200 rounded-xl bg-gray-900 flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="w-6 h-6 bg-red-500 rounded-full recording-indicator" />
            </div>
            <p className="text-white text-sm font-medium">Recording in progress...</p>
            <p className="text-gray-400 text-xs mt-1 font-mono">{formatTime(elapsed)}</p>
          </div>
        </div>
      )}

      {recordingState === 'preview' && previewUrlRef.current && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-black">
          <video
            ref={videoPreviewRef}
            src={previewUrlRef.current}
            controls
            className="w-full"
            style={{ maxHeight: '600px' }}
          />
        </div>
      )}
    </div>
  );
}
