import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './lib/api' // Polyfill window.api for Tauri
import { ErrorBoundary } from './components/ErrorBoundary'

// ============================================================
// Точка входу React застосунку
// ============================================================

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
