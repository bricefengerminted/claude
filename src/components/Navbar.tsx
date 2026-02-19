import { Link, useLocation } from 'react-router-dom'
import { useDemo } from '../context/DemoContext'

export default function Navbar() {
  const location = useLocation();
  const { state } = useDemo();
  const hasProject = !!state.currentProject;

  const links = [
    { to: '/', label: 'Home' },
    { to: '/record', label: 'Record' },
    { to: '/edit', label: 'Preview & Export', disabled: !hasProject },
  ];

  return (
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
          </div>
        </div>
      </div>
    </nav>
  );
}
