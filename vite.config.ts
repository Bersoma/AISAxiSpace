import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' + hash routing (#/...) means refreshes and direct links work on GitHub Pages.
export default defineConfig({ base: './', plugins: [react()] })
