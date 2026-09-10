import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import About from './pages/About'
import Approach from './pages/Approach'
import Carte from './pages/Carte'
import Contact from './pages/Contact'
import Home from './pages/Home'
import Sectors from './pages/Sectors'
import ServiceDetail from './pages/ServiceDetail'
import Services from './pages/Services'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/presentation" element={<About />} />
        <Route path="/prestations" element={<Services />} />
        <Route path="/prestations/:slug" element={<ServiceDetail />} />
        <Route path="/carte" element={<Carte />} />
        <Route path="/secteurs" element={<Sectors />} />
        <Route path="/demarche" element={<Approach />} />
        <Route path="/contact" element={<Contact />} />
      </Route>
    </Routes>
  )
}
