import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { StoreProvider } from './store'
import { AiProvider } from './ai/AiContext'
import AiSettings from './pages/AiSettings'
import { Navigate, useParams } from 'react-router-dom'

function ProgramRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/catalog/${id}` : '/catalog'} replace />
}
import Shell from './components/Shell'
import Today from './pages/Today'
import Catalog from './pages/Catalog'
import TrackDetail from './pages/TrackDetail'
import NewTopic from './pages/NewTopic'
import Track from './pages/Track'
import LessonPage from './pages/Lesson'
import Labs from './pages/Labs'
import TcpLab from './pages/TcpLab'
import SubnetLab from './pages/SubnetLab'
import EncapLab from './pages/EncapLab'
import NegotiationLab from './pages/NegotiationLab'
import Review from './pages/Review'
import Cards from './pages/Cards'
import FsrsSettings from './pages/FsrsSettings'
import Analytics from './pages/Analytics'
import History from './pages/History'
import Notes from './pages/Notes'
import DeepStudy from './pages/DeepStudy'
import PlanBoard from './pages/PlanBoard'
import TaskDetail from './pages/TaskDetail'
import FocusSession from './pages/FocusSession'
import Profile from './pages/Profile'
import CsLab from './pages/CsLab'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AiProvider>
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Today />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="program" element={<ProgramRedirect />} />
            <Route path="program/:id" element={<ProgramRedirect />} />
            <Route path="catalog/:id" element={<TrackDetail />} />
            <Route path="new" element={<NewTopic />} />
            <Route path="track" element={<Track />} />
            <Route path="track/:trackId" element={<Track />} />
            <Route path="lesson/:id" element={<LessonPage />} />
            <Route path="labs" element={<Labs />} />
            <Route path="lab/tcp" element={<TcpLab />} />
            <Route path="lab/subnet" element={<SubnetLab />} />
            <Route path="lab/encap" element={<EncapLab />} />
            <Route path="lab/negotiation" element={<NegotiationLab />} />
            <Route path="lab/:id" element={<CsLab />} />
            <Route path="review" element={<Review />} />
            <Route path="cards" element={<Cards />} />
            <Route path="settings/fsrs" element={<FsrsSettings />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="history" element={<History />} />
            <Route path="notes" element={<Notes />} />
            <Route path="deep" element={<DeepStudy />} />
            <Route path="plan" element={<PlanBoard />} />
            <Route path="plan/task/:id" element={<TaskDetail />} />
            <Route path="focus" element={<FocusSession />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings/ai" element={<AiSettings />} />
            <Route path="*" element={<Today />} />
          </Route>
        </Routes>
      </HashRouter>
      </AiProvider>
    </StoreProvider>
  </StrictMode>,
)
