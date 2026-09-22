import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Accueil from './pages/Accueil'
import Sources from './pages/Sources'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Accueil />} />
        <Route path="/sources" element={<Sources />} />

        {/* The site was a consultancy showcase before becoming a data
            consultation platform; its former pages no longer exist, so old
            links land on the address search rather than a blank screen. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
