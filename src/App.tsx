import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import RecorderPage from './pages/RecorderPage'
import EditorPage from './pages/EditorPage'
import DemoContent from './pages/DemoContent'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Demo content renders standalone (loaded in iframe for recording) */}
        <Route path="/demo-content" element={<DemoContent />} />

        {/* Main app routes */}
        <Route
          path="*"
          element={
            <>
              <Navbar />
              <main>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/record" element={<RecorderPage />} />
                  <Route path="/edit" element={<EditorPage />} />
                </Routes>
              </main>
            </>
          }
        />
      </Routes>
    </div>
  )
}
