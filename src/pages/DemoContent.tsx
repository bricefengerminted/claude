/**
 * Sample product page that serves as a demo target.
 * This is loaded inside an iframe on the recorder page
 * so users can test the recording workflow.
 *
 * It simulates a SaaS product landing page.
 */
export default function DemoContent() {
  return (
    <div className="font-sans text-gray-900 bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-md" />
            <span className="font-bold text-lg">Flowboard</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#pricing" className="hover:text-gray-900">Pricing</a>
            <a href="#testimonials" className="hover:text-gray-900">Testimonials</a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Log in
            </button>
            <button className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Get Started Free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full mb-6">
            Now with AI-powered automation
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Project management
            <br />
            <span className="text-indigo-600">that actually works</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
            Flowboard helps teams plan, track, and ship projects faster with
            intuitive boards, smart automations, and real-time collaboration.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-600/25">
              Start Free Trial
            </button>
            <button className="px-8 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-950 rounded-xl p-4 shadow-2xl">
            <div className="bg-white rounded-lg p-6">
              {/* Fake dashboard */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-lg">Project Dashboard</h2>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full" />
                  <div className="w-8 h-8 bg-blue-100 rounded-full -ml-2" />
                  <div className="w-8 h-8 bg-purple-100 rounded-full -ml-2" />
                  <span className="text-sm text-gray-400 ml-1">+5</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'In Progress', count: 12, color: 'bg-blue-500' },
                  { label: 'In Review', count: 5, color: 'bg-yellow-500' },
                  { label: 'Completed', count: 34, color: 'bg-green-500' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                      <span className="text-sm text-gray-500">{stat.label}</span>
                    </div>
                    <span className="text-2xl font-bold">{stat.count}</span>
                  </div>
                ))}
              </div>
              {/* Fake task list */}
              <div className="space-y-2">
                {[
                  { title: 'Design new onboarding flow', tag: 'Design', tagColor: 'bg-purple-100 text-purple-700', priority: 'High' },
                  { title: 'Implement payment gateway', tag: 'Engineering', tagColor: 'bg-blue-100 text-blue-700', priority: 'High' },
                  { title: 'Write Q4 marketing plan', tag: 'Marketing', tagColor: 'bg-green-100 text-green-700', priority: 'Medium' },
                  { title: 'Update API documentation', tag: 'Docs', tagColor: 'bg-yellow-100 text-yellow-700', priority: 'Low' },
                  { title: 'Fix mobile nav regression', tag: 'Bug', tagColor: 'bg-red-100 text-red-700', priority: 'High' },
                ].map((task) => (
                  <div
                    key={task.title}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="rounded" readOnly />
                      <span className="text-sm">{task.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${task.tagColor}`}>
                        {task.tag}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        task.priority === 'High'
                          ? 'text-red-600'
                          : task.priority === 'Medium'
                            ? 'text-yellow-600'
                            : 'text-gray-400'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Everything you need to ship faster
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Powerful features designed for modern teams
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Smart Boards', desc: 'Kanban, timeline, and calendar views that adapt to how your team works.' },
              { title: 'Automations', desc: 'Set up rules to automate repetitive tasks. Move cards, assign work, send notifications.' },
              { title: 'Real-time Sync', desc: 'See changes instantly. No refresh needed. Collaborate like you\'re in the same room.' },
              { title: 'Analytics', desc: 'Track velocity, burndown, and team performance with built-in dashboards.' },
              { title: 'Integrations', desc: 'Connect with GitHub, Slack, Figma, and 100+ other tools your team already uses.' },
              { title: 'Templates', desc: 'Start fast with pre-built templates for sprints, launches, hiring, and more.' },
            ].map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg mb-4" />
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">Start free. Upgrade when you need to.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Free', price: '$0', desc: 'For individuals', features: ['5 projects', '1 team member', 'Basic boards'] },
              { name: 'Pro', price: '$12', desc: 'For growing teams', features: ['Unlimited projects', '10 team members', 'Automations', 'Analytics'], popular: true },
              { name: 'Enterprise', price: '$39', desc: 'For large orgs', features: ['Everything in Pro', 'Unlimited members', 'SSO & SAML', 'Priority support'] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 border ${
                  plan.popular
                    ? 'border-indigo-600 ring-2 ring-indigo-600 bg-white'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-semibold text-indigo-600 mb-2">Most popular</div>
                )}
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500 text-sm">/mo per user</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2 rounded-lg text-sm font-medium ${
                    plan.popular
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Get started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Loved by teams everywhere
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'Sarah Chen', role: 'Engineering Lead at Vercel', quote: 'Flowboard replaced three tools for us. Our sprint velocity is up 40% since switching.' },
              { name: 'Marcus Johnson', role: 'PM at Stripe', quote: 'The automations alone save our team 10+ hours per week. Game changer.' },
              { name: 'Ana Rodriguez', role: 'CTO at Notion', quote: 'Clean, fast, and actually enjoyable to use. That\'s rare for PM tools.' },
              { name: 'David Kim', role: 'Design Lead at Figma', quote: 'Finally a tool that doesn\'t get in the way. We just ship faster now.' },
            ].map((t) => (
              <div key={t.name} className="bg-white rounded-xl p-6 border border-gray-200">
                <p className="text-gray-600 text-sm mb-4">"{t.quote}"</p>
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-200">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded" />
            <span className="font-semibold">Flowboard</span>
          </div>
          <p className="text-sm text-gray-400">
            This is a sample product page for DemoReel testing.
          </p>
        </div>
      </footer>
    </div>
  );
}
