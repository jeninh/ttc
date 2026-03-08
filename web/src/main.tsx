import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerSW } from 'virtual:pwa-register'
import { AudioProvider } from './contexts/AudioContext'

// Register service worker for offline support
registerSW({
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AudioProvider>
      <App />
    </AudioProvider>
  </StrictMode>,
)
