import { useEffect, useRef, useState } from 'react'
import { map as createMap, tileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixedIcon, MapPinIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/shared/fields'
import { Notice, Spinner } from '@/components/shared/ui'
import { INDONESIA_BOUNDS, MAP_ATTRIBUTION, cityUrl, parseLatLng, roundPoint, searchUrl, tileUrl } from '@/lib/geo'

const getJson = async (url, signal) => {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(res.statusText)
  return (await res.json()).results ?? []
}

// Pin fixed at the centre, like ride-hailing apps: the user moves the map under it, which works better on a phone than
// dragging a small marker. Loaded lazily, so Leaflet only downloads once someone opens it.
export default function LocationPicker({ value, city, onPick, onCancel }) {
  const box = useRef(null)
  const map = useRef(null)
  const pending = useRef({})
  const [text, setText] = useState('')
  const [results, setResults] = useState(null) // null: nothing searched
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    const m = createMap(box.current, { maxBounds: INDONESIA_BOUNDS, maxBoundsViscosity: 1, minZoom: 4, scrollWheelZoom: 'center', touchZoom: 'center', doubleClickZoom: 'center' })
    m.setView(value ? [value.lat, value.lng] : [-2.5, 118], value ? 17 : 5)
    tileLayer(tileUrl(), { maxZoom: 20, attribution: MAP_ATTRIBUTION }).addTo(m)
    map.current = m
    const jobs = pending.current
    const start = new AbortController()
    // No saved point: start from the chosen kota/kabupaten.
    if (!value && city) getJson(cityUrl(city), start.signal).then(([r]) => r && m.setView([r.lat, r.lon], 13), () => {})
    return () => {
      start.abort()
      clearTimeout(jobs.timer)
      jobs.ctrl?.abort()
      m.remove()
    }
    // Mount only: the map is the source of truth while the picker is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // No animation: "Pakai titik ini" right after a jump must read the new centre, not one mid-animation.
  const goTo = ({ lat, lng }, zoom = 18) => map.current.setView([lat, lng], zoom, { animate: false })

  const search = (q) => {
    setText(q)
    clearTimeout(pending.current.timer)
    pending.current.ctrl?.abort()
    const point = parseLatLng(q)
    if (point || q.trim().length < 3) {
      if (point) goTo(point)
      setResults(null)
      return setStatus('idle')
    }
    pending.current.timer = setTimeout(async () => {
      const ctrl = (pending.current.ctrl = new AbortController())
      setStatus('loading')
      try {
        const c = map.current.getCenter()
        setResults(await getJson(searchUrl(q.trim(), { lat: c.lat, lng: c.lng }), ctrl.signal))
        setStatus('idle')
      } catch {
        if (!ctrl.signal.aborted) setStatus('error')
      }
    }, 300)
  }

  const locate = () => {
    setLocating(true)
    setNote('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        if (parseLatLng(`${coords.latitude}, ${coords.longitude}`)) goTo({ lat: coords.latitude, lng: coords.longitude })
        else setNote('Lokasimu saat ini di luar Indonesia. Cari alamat properti atau geser peta.')
      },
      () => {
        setLocating(false)
        setNote('Lokasi tidak bisa diambil. Izinkan akses lokasi di browser, atau cari alamatnya.')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-3 sm:p-4">
      <TextField
        label="Cari lokasi"
        placeholder="Perumahan, jalan, atau koordinat"
        hint="Koordinat bisa disalin dari Google Maps (contoh: -6.2383, 106.9756)."
        value={text}
        onChange={search}
        trailing={status === 'loading' && <Spinner className="text-muted-foreground" />}
      />
      {status === 'error' && <Notice tone="bad" role="alert">Pencarian gagal. Geser peta secara manual atau coba lagi.</Notice>}
      {results && status !== 'error' && (
        <ul aria-label="Hasil pencarian lokasi" className="flex flex-col overflow-hidden rounded-lg border border-border">
          {results.length ? (
            results.map((r) => (
              <li key={r.place_id ?? `${r.lat},${r.lon}`} className="border-b border-border last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    goTo({ lat: r.lat, lng: r.lon })
                    setText(r.formatted)
                    setResults(null)
                  }}
                  className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <MapPinIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {r.formatted}
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-muted-foreground">Lokasi tidak ditemukan. Coba nama jalan atau perumahan, atau geser peta.</li>
          )}
        </ul>
      )}
      <div className="relative isolate h-64 overflow-hidden rounded-xl bg-muted sm:h-72">
        <div ref={box} className="size-full" role="application" aria-label="Peta. Geser sampai pin tepat di lokasi properti." />
        {/* The pin's tip marks the map centre. */}
        <MapPinIcon className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] size-10 -translate-x-1/2 -translate-y-full fill-primary text-white drop-shadow-md" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-xs leading-[18px] text-muted-foreground">Geser dan perbesar peta sampai ujung pin tepat di rumahmu.</p>
      {note && <Notice tone="warn" role="alert">{note}</Notice>}
      <div className="flex flex-wrap gap-3">
        {'geolocation' in navigator && (
          <Button variant="neutral" size="sm" onClick={locate} disabled={locating} aria-busy={locating}>
            {locating ? <Spinner /> : <LocateFixedIcon aria-hidden />}
            Lokasi saya
          </Button>
        )}
        <div className="ml-auto flex gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Batal
          </Button>
          <Button size="sm" onClick={() => onPick(roundPoint(map.current.getCenter()))}>
            Pakai titik ini
          </Button>
        </div>
      </div>
    </div>
  )
}
