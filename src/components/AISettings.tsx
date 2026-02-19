import { useState, useEffect } from 'react'

const API_KEY_STORAGE_KEY = 'demoreel_anthropic_api_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
}

export function hasApiKey(): boolean {
  return getStoredApiKey().length > 0;
}

interface Props {
  onClose: () => void;
}

export default function AISettings({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setApiKey(getStoredApiKey());
  }, []);

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">AI Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Add your Anthropic API key to enable AI-powered features like smart zoom
          targeting and auto-narration. Your key is stored locally in your browser
          and never sent to our servers.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Anthropic API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Get your key at console.anthropic.com. Starts with "sk-ant-".
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            {saved ? 'Saved!' : 'Save Key'}
          </button>
          {apiKey && (
            <button
              onClick={handleClear}
              className="py-2 px-4 text-sm text-red-600 font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        <div className="pt-3 border-t border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            AI Features (coming soon)
          </h3>
          <ul className="space-y-1.5 text-sm text-gray-500">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Smart zoom targeting via Claude Vision
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Auto-generated narration scripts
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Intelligent chapter detection
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
