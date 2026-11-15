import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import './styles/screens.css'
import { App } from './App'
import { useMission } from './store/useMission'

// While developing: the game store is reachable from the browser console, to jump to any screen.
if (import.meta.env.DEV) {
  Object.assign(window, { __mission: useMission })
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
