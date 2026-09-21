import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Accompagnement from './pages/Accompagnement'
import About from './pages/About'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Carte from './pages/Carte'
import Contact from './pages/Contact'
import EauQuantitative from './pages/EauQuantitative'
import Home from './pages/Home'
import RedirectToLyzaCartes from './pages/RedirectToLyzaCartes'
import ServiceDetail from './pages/ServiceDetail'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/presentation" element={<About />} />
        <Route path="/accompagnement" element={<Accompagnement />} />
        <Route path="/accompagnement/:slug" element={<ServiceDetail />} />
        <Route path="/carte" element={<Carte />} />
        <Route path="/eau-quantitative" element={<EauQuantitative />} />
        <Route path="/actualites" element={<Blog />} />
        <Route path="/actualites/:slug" element={<BlogPost />} />
        <Route path="/contact" element={<Contact />} />

        {/* Prestations, Secteurs d'intervention and Démarche were merged into
            one page — redirect old bookmarks/links instead of leaving them
            with a blank screen (there was no catch-all route before either,
            worth fixing while touching this). */}
        <Route path="/prestations" element={<Navigate to="/accompagnement" replace />} />
        <Route path="/prestations/:slug" element={<ServiceDetail />} />
        <Route path="/secteurs" element={<Navigate to="/accompagnement" replace />} />
        <Route path="/demarche" element={<Navigate to="/accompagnement" replace />} />

        {/* Restrictions d'eau (VigiEau) is now one section of the broader
            "Eau quantitative" page rather than its own route. ICPE &
            émissions moved into LYZa Cartes' ICPE popups — this route just
            forwards visitors to the tool. */}
        <Route path="/restrictions-eau" element={<Navigate to="/eau-quantitative" replace />} />
        <Route path="/icpe-emissions" element={<RedirectToLyzaCartes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
