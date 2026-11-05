import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Only VITE_* variables are exposed to the browser bundle.
  // Server-only Supabase secrets must never use a VITE_ prefix.
  envPrefix: 'VITE_',
})
