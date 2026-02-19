import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'
import AISettings from './AISettings'

export default function Navbar() {
  const location = useLocation();
  const { state } = useDemo();
  const hasProject = !!state.currentProject;
  const [showAI, setShowAI] = useState(false);

  const links = [
    { to: '/', label: 'Home' },
    { to: '/record', label: 'Record' },
    { to: '/edit', label: 'Edit & Export', disabled: !hasProject },
  ];

  return (
    <>
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                DemoReel
              </span>
            </Link>

            <div className="flex items-center gap-1">
              {links.map((link) => {
                const active = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.disabled ? '#' : link.to}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : link.disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    onClick={(e) => link.disabled && e.preventDefault()}
                  >
                    {link.label}
                  </Link>
                );
              })}

              <button
                onClick={() => setShowAI(true)}
                className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                title="AI Settings"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {showAI && <AISettings onClose={() => setShowAI(false)} />}
    </>
  );
}
