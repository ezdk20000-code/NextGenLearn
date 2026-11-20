import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { StoreProvider } from './store'
import Shell from './components/Shell'
import Today from './pages/Today'
import NewTopic from './pages/NewTopic'
import Track from './pages/Track'
import LessonPage from './pages/Lesson'
import Labs from './pages/Labs'
import TcpLab from './pages/TcpLab'
import SubnetLab from './pages/SubnetLab'
import EncapLab from './pages/EncapLab'
import Review from './pages/Review'
import Plan from './pages/Plan'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Today />} />
            <Route path="new" element={<NewTopic />} />
            <Route path="track" element={<Track />} />
            <Route path="lesson/:id" element={<LessonPage />} />
            <Route path="labs" element={<Labs />} />
            <Route path="lab/tcp" element={<TcpLab />} />
            <Route path="lab/subnet" element={<SubnetLab />} />
            <Route path="lab/encap" element={<EncapLab />} />
            <Route path="review" element={<Review />} />
            <Route path="plan" element={<Plan />} />
            <Route path="*" element={<Today />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
)
