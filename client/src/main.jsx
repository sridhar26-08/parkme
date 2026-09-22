import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { setupMockBackendIfNeeded } from './api/mockBackend'

// Enable in-browser parking simulation engine on GitHub Pages or if backend is offline
setupMockBackendIfNeeded();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
