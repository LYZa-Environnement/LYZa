import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project from /LYZa/, not the domain root.
  base: process.env.GITHUB_PAGES ? '/LYZa/' : '/',
  plugins: [react()],
})
