import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ComboboxField } from './fields'

const options = [
  { value: 'Kab. Bekasi', label: 'Kab. Bekasi', hint: 'Jawa Barat' },
  { value: 'Kota Bekasi', label: 'Kota Bekasi', hint: 'Jawa Barat' },
  { value: 'Kota Surabaya', label: 'Kota Surabaya', hint: 'Jawa Timur' },
]

it('filters by typed text (province too) and picks with the keyboard', () => {
  const onChange = vi.fn()
  render(<ComboboxField label="Kota / Kabupaten" options={options} value="" onChange={onChange} />)
  const input = screen.getByRole('combobox', { name: 'Kota / Kabupaten' })
  fireEvent.change(input, { target: { value: 'bekasi' } })
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Kab. BekasiJawa Barat', 'Kota BekasiJawa Barat'])
  fireEvent.change(input, { target: { value: 'jawa timur' } })
  expect(screen.getAllByRole('option')).toHaveLength(1)
  fireEvent.change(input, { target: { value: 'bekasi' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith('Kota Bekasi')
})

it('never keeps text that is not an option', () => {
  const onChange = vi.fn()
  render(<ComboboxField label="Kota / Kabupaten" options={options} value="Kota Surabaya" onChange={onChange} />)
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'kota entah' } })
  expect(screen.getByText('Tidak ditemukan. Coba kata lain.')).toBeTruthy()
  fireEvent.blur(input)
  expect(onChange).not.toHaveBeenCalled()
  expect(input.value).toBe('Kota Surabaya')
  expect(input.getAttribute('aria-expanded')).toBe('false')
})
