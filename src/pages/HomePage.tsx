import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Turn rough walkthroughs into
          <br />
          <span className="text-brand-600">polished product demos</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
          Record any screen, window, or browser tab, then preview and
          download a polished video ready for your marketing site or docs.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/record"
            className="px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
          >
            Start Recording
          </Link>
          <a
            href="#how-it-works"
            className="px-6 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
          >
            See How It Works
          </a>
        </div>
      </div>

      {/* How it works */}
      <div id="how-it-works" className="mb-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
          Three steps to a perfect demo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Record',
              description:
                'Capture any screen, window, or browser tab. Walk through your product naturally — DemoReel records it all.',
              icon: (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" />
                </svg>
              ),
            },
            {
              step: '2',
              title: 'Preview',
              description:
                'Review your recording instantly in the browser. Adjust playback speed and add a device frame for a polished look.',
              icon: (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l1.9 5.8h6.1l-5 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8-5-3.6h6.1z" />
                </svg>
              ),
            },
            {
              step: '3',
              title: 'Export',
              description:
                'Download a polished video ready for your marketing site, landing page, or product documentation.',
              icon: (
                <svg
                  width="24"
                  height="24"
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
              ),
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
                {item.icon}
              </div>
              <div className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-2">
                Step {item.step}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What gets enhanced */}
      <div className="mb-20">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
          What gets enhanced
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              title: 'Cursor Smoothing',
              before: 'Jittery, erratic mouse movements',
              after: 'Smooth, intentional cursor paths with natural easing',
            },
            {
              title: 'Scroll Normalization',
              before: 'Jerky mouse-wheel scrolling with uneven speed',
              after: 'Buttery-smooth scrolling with consistent pace',
            },
            {
              title: 'Timing Cleanup',
              before: 'Awkward pauses while you think about what to do next',
              after: 'Professional pacing with strategic pauses for readability',
            },
            {
              title: 'Click Highlights',
              before: 'Clicks are invisible and easy to miss',
              after: 'Subtle ripple effects draw attention to interactions',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <h3 className="font-semibold text-gray-900 mb-3">
                {item.title}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </span>
                  <span className="text-gray-500">{item.before}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span className="text-gray-700">{item.after}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center bg-brand-600 rounded-2xl p-12 text-white">
        <h2 className="text-3xl font-bold mb-4">
          Ready to make your demos shine?
        </h2>
        <p className="text-brand-100 mb-8 max-w-lg mx-auto">
          Stop spending hours editing screen recordings. Record once, let
          DemoReel handle the polish.
        </p>
        <Link
          to="/record"
          className="inline-block px-8 py-3 bg-white text-brand-700 font-medium rounded-lg hover:bg-brand-50 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
