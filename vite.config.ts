import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Приложение развёрнуто на корне хостинга Beget (z99392ok.beget.tech), поэтому base = '/'
export default defineConfig({
  base: '/',
  plugins: [react()],
})
