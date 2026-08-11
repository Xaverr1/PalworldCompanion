import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Served from https://<user>.github.io/PalworldCompanion/ in production,
// so the build needs that base path; dev stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/PalworldCompanion/' : '/',
  plugins: [react()],
}))
