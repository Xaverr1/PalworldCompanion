import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OwnedProvider } from './hooks/useOwned.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OwnedProvider>
      <App />
    </OwnedProvider>
  </StrictMode>,
)
