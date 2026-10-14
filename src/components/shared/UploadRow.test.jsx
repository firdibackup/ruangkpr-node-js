import { fireEvent, render } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { UploadRow } from './UploadRow'

it('hands the picked File itself to onUpload, so the real backend uploads its bytes (not "[object Object]")', () => {
  const onUpload = vi.fn(async () => {})
  const { container } = render(<UploadRow doc={{ label: 'KTP', required: true }} onUpload={onUpload} />)
  const file = new File(['%PDF-1.4 isi asli'], 'ktp.pdf', { type: 'application/pdf' })
  fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
  expect(onUpload.mock.calls[0][0]).toBe(file)
})
