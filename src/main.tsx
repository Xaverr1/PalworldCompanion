import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OwnedProvider } from './hooks/useOwned.tsx'
import { LoadoutProvider } from './hooks/useLoadouts.tsx'
import { runMigrations } from './lib/migrate.ts'

runMigrations()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OwnedProvider>
      <LoadoutProvider>
        <App />
      </LoadoutProvider>
    </OwnedProvider>
  </StrictMode>,
)
