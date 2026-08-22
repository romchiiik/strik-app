import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // './' — относительные пути к ассетам, чтобы сборка одинаково работала
  // и на GitHub Pages (в подпапке /<репозиторий>/), и на любом другом хостинге.
  base: './',
})
