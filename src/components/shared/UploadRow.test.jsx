import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { UploadRow } from './UploadRow'

it('does not send bytes until document processing is explicitly accepted', async () => {
  const onUpload = vi.fn(async () => {})
  const { container } = render(<MemoryRouter><UploadRow requireConsent doc={{ label: 'KTP', required: true }} onUpload={onUpload} /></MemoryRouter>)
  const file = new File(['%PDF-1.4 isi asli'], 'ktp.pdf', { type: 'application/pdf' })
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
  expect(onUpload).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Setuju & unggah' }))
  expect(onUpload.mock.calls[0][0]).toBe(file)
  expect(onUpload.mock.calls[0][2]).toEqual({ version: '2026-11-06', accepted: true })
})

it('keeps payment-proof selection free of application-consent prompts', () => {
  const onUpload = vi.fn(async () => {})
  const { container } = render(<MemoryRouter><UploadRow doc={{ label: 'Bukti pembayaran' }} onUpload={onUpload} /></MemoryRouter>)
  const file = new File(['%PDF-1.4'], 'bukti.pdf', { type: 'application/pdf' })
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
  expect(onUpload).toHaveBeenCalledWith(file, expect.any(Function), undefined)
})
