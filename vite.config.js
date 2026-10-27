import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { brand } from './src/brand/brand.js'
import { productionBoundary } from './build/environment.js'

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

export default defineConfig(({ mode, command }) => {
  const demoEnabled = ['staging', 'development', 'test'].includes(mode)
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build' && !['staging', 'production'].includes(mode)) {
    throw new Error('Gunakan mode staging atau production untuk build deployment.')
  }
  if (!demoEnabled && env.VITE_DATA_SOURCE && env.VITE_DATA_SOURCE !== 'supabase') {
    throw new Error('Production wajib memakai VITE_DATA_SOURCE=supabase.')
  }
  return {
    plugins: [react(), tailwindcss(), brandHtml, ...(!demoEnabled ? [productionBoundary()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '#data-runtime': path.resolve(import.meta.dirname, `./src/data/api.${demoEnabled ? 'demo' : 'production'}.js`),
        '#demo-panel': path.resolve(import.meta.dirname, `./src/app/${demoEnabled ? 'DevPanel' : 'NoDevPanel'}.jsx`),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      setupFiles: ['./src/test/setup.js'],
      // src/brand/theme.js reads tokens.css as text (`?raw`); Vitest skips CSS unless asked.
      css: { include: [/tokens\.css/] },
    },
  }
})
