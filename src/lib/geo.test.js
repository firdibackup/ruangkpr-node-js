import { describe, expect, it } from 'vitest'
import { googleMapsUrl, parseLatLng, staticMapUrl } from './geo'
import { CITIES } from './regions'

describe('parseLatLng', () => {
  it('reads typed coordinates and Google Maps links', () => {
    expect(parseLatLng('-6.2383, 106.9756')).toEqual({ lat: -6.2383, lng: 106.9756 })
    expect(parseLatLng('https://www.google.com/maps/place/x/@-6.2383,106.9756,17z')).toEqual({ lat: -6.2383, lng: 106.9756 })
  })

  it('ignores text and points outside Indonesia', () => {
    expect(parseLatLng('Griya Asri Blok C2 No. 8')).toBeNull()
    expect(parseLatLng('40.7128, -74.0060')).toBeNull() // New York
    expect(parseLatLng('106.9756, -6.2383')).toBeNull() // lng,lat swapped
  })
})

it('sends Geoapify lon,lat and Google Maps lat,lng', () => {
  const point = { lat: -6.2383, lng: 106.9756 }
  expect(staticMapUrl(point)).toContain('center=lonlat:106.975600,-6.238300')
  expect(googleMapsUrl(point)).toBe('https://www.google.com/maps/search/?api=1&query=-6.238300,106.975600')
})

it('lists all 514 kota/kabupaten once, keeping the names already saved', () => {
  const values = CITIES.map((c) => c.value)
  expect(new Set(values).size).toBe(514)
  for (const saved of ['Kota Bekasi', 'Kab. Bekasi', 'Kota Depok', 'Kota Tangerang Selatan', 'Kab. Bogor', 'Jakarta Selatan', 'Kota Surabaya']) expect(values).toContain(saved)
  expect(CITIES.find((c) => c.value === 'Kota Bekasi').hint).toBe('Jawa Barat')
})
