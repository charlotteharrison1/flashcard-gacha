import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Served from a GitHub Pages subpath; use '/' if it moves to a custom domain.
export default defineConfig({
  base: '/flashcard-gacha/',
  plugins: [react()],
})
