import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base must match the GitHub Pages project path: https://asm679.github.io/Anketa-26/
export default defineConfig({
  base: '/Anketa-26/',
  plugins: [react()],
})
