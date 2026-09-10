import 'leaflet/dist/leaflet.css'
import './leaflet-icon-fix'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// HashRouter (not BrowserRouter): GitHub Pages has no server-side rewrite for
// deep links, so a refresh on e.g. /prestations would 404 with a path-based router.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
