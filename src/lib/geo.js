// Peta properti via Geoapify (OpenStreetMap data). The key ships to the browser by design: restrict it per HTTP
// referrer in the Geoapify dashboard. Without one the map parts stay hidden and only the Google Maps link shows.
export const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY ?? ''
export const MAP_ATTRIBUTION = '<a href="https://www.geoapify.com/" target="_blank" rel="noopener">Powered by Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

const API = 'https://api.geoapify.com/v1'
const MAPS = 'https://maps.geoapify.com/v1'
const fixed = (n) => Number(n).toFixed(6)

export const INDONESIA_BOUNDS = [
  [-11.5, 94],
  [6.5, 141.5],
]
const inIndonesia = ({ lat, lng }) => lat >= INDONESIA_BOUNDS[0][0] && lat <= INDONESIA_BOUNDS[1][0] && lng >= INDONESIA_BOUNDS[0][1] && lng <= INDONESIA_BOUNDS[1][1]

// "-6.2383, 106.9756" or a Google Maps link (…/@-6.2383,106.9756,17z): the point, or null if none or outside Indonesia.
export function parseLatLng(text) {
  const m = /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(String(text ?? ''))
  if (!m) return null
  const point = { lat: Number(m[1]), lng: Number(m[2]) }
  return inIndonesia(point) ? point : null
}

export const roundPoint = ({ lat, lng }) => ({ lat: Number(fixed(lat)), lng: Number(fixed(lng)) })
export const pointLabel = ({ lat, lng }) => `${fixed(lat)}, ${fixed(lng)}`
export const googleMapsUrl = ({ lat, lng }) => `https://www.google.com/maps/search/?api=1&query=${fixed(lat)},${fixed(lng)}`

// Geoapify takes lon,lat. {r} is Leaflet's retina suffix (@2x).
export const tileUrl = () => `${MAPS}/tile/osm-bright/{z}/{x}/{y}{r}.png?apiKey=${GEOAPIFY_KEY}`
export const staticMapUrl = ({ lat, lng }) => {
  const at = `lonlat:${fixed(lng)},${fixed(lat)}`
  return `${MAPS}/staticmap?style=osm-bright&width=600&height=300&scaleFactor=2&zoom=16&center=${at}&marker=${at};color:%23003da5;size:large&apiKey=${GEOAPIFY_KEY}`
}
const geocode = (path, params) => `${API}/geocode/${path}?${new URLSearchParams({ ...params, filter: 'countrycode:id', lang: 'id', format: 'json', apiKey: GEOAPIFY_KEY })}`
export const searchUrl = (text, near) => geocode('autocomplete', { text, limit: '5', ...(near && { bias: `proximity:${fixed(near.lng)},${fixed(near.lat)}` }) })
export const cityUrl = (city) => geocode('search', { text: `${city}, Indonesia`, limit: '1' })
