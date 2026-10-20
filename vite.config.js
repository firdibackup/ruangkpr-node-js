import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { brand } from './src/brand/brand.js'

// index.html takes its title, theme colour and font link from src/brand/brand.js. Runs before Vite's own %ENV%
// replacement so these placeholders never reach it.
const brandHtml = {
  name: 'brand-html',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      html.replaceAll('%BRAND_NAME%', brand.name).replaceAll('%BRAND_THEME_COLOR%', brand.themeColor).replaceAll('%BRAND_FONTS_URL%', brand.fontsUrl),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), brandHtml],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    // src/brand/theme.js reads tokens.css as text (`?raw`); Vitest skips CSS unless asked.
    css: { include: [/tokens\.css/] },
  },
})
