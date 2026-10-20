import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { App } from '@/app/App'
import { api } from '@/data/api'
import { setPublishedBrand } from '@/brand/live'

// The brand the admin published paints before the first render, so nobody sees the files' colours flash first. A
// read slower than 1.5 s renders with the files' look and repaints when it lands; a failed read keeps that look.
const published = api.brand.published().catch(() => null)
published.then(setPublishedBrand)
Promise.race([published, new Promise((resolve) => setTimeout(resolve, 1500))]).then(() =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
