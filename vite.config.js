import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Importante: base = nombre del repo entre slashes
  base: '/flujo-imports/',
})
