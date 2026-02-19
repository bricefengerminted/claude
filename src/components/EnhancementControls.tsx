import { EnhancementSettings } from '../types'

interface Props {
  settings: EnhancementSettings;
  onChange: (settings: Partial<EnhancementSettings>) => void;
  onApply: () => void;
  isProcessing: boolean;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-10 h-6 rounded-full transition-colors ${
            checked ? 'bg-brand-600' : 'bg-gray-200'
          }`}
        >
          <div
            className={`w-4 h-4 mt-1 rounded-full bg-white shadow transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
          {label}
        </div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </label>
  );
}

export default function EnhancementControls({
  settings,
  onChange,
  onApply,
  isProcessing,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Enhancement Settings
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Adjust how the recording is polished
        </p>
      </div>

      <div className="space-y-5">
        <Slider
          label="Cursor Smoothing"
          value={settings.cursorSmoothing}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => onChange({ cursorSmoothing: v })}
        />

        <Slider
          label="Scroll Smoothing"
          value={settings.scrollSmoothing}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => onChange({ scrollSmoothing: v })}
        />

        <Slider
          label="Playback Speed"
          value={settings.playbackSpeed}
          min={0.25}
          max={2.0}
          step={0.25}
          unit="x"
          onChange={(v) => onChange({ playbackSpeed: v })}
        />

        <Slider
          label="Max Pause Duration"
          value={settings.maxPauseMs}
          min={300}
          max={5000}
          step={100}
          unit="ms"
          onChange={(v) => onChange({ maxPauseMs: v })}
        />

        <div className="pt-2 border-t border-gray-100 space-y-4">
          <Toggle
            label="Click Highlights"
            description="Add subtle ripple effect on clicks"
            checked={settings.clickHighlight}
            onChange={(v) => onChange({ clickHighlight: v })}
          />

          <Toggle
            label="Auto Zoom"
            description="Zoom into active areas (coming soon)"
            checked={settings.autoZoom}
            onChange={(v) => onChange({ autoZoom: v })}
          />
        </div>
      </div>

      <button
        onClick={onApply}
        disabled={isProcessing}
        className="w-full py-2.5 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          'Apply Enhancements'
        )}
      </button>
    </div>
  );
}
