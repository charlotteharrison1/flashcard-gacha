import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jersey-15/400.css'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
// Flashcard content fonts (see src/lib/fonts.ts) — the pixel font above stays for UI chrome only.
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/lora/400.css'
import '@fontsource/lora/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import App from './App.tsx'
import { applyScheme, loadScheme } from './lib/scheme'
import { applyLights, loadLights } from './lib/lights'
import { applyCardAnim, loadCardAnim } from './lib/cardAnim'
import { applyUiFont, loadUiFont } from './lib/uiFont'
import { applyAnim, loadAnim } from './lib/anim'

applyScheme(loadScheme())
applyLights(loadLights())
applyCardAnim(loadCardAnim())
applyUiFont(loadUiFont())
applyAnim(loadAnim())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
