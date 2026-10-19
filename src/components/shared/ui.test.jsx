import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { BankMark } from './ui'

describe('BankMark', () => {
  it('shows the logo, and the bank code once the logo fails to load (a replaced file is gone)', () => {
    const { container } = render(<BankMark bank={{ mark: 'BCA', logoUrl: 'https://x.test/old.png' }} />)
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('BCA')
  })

  it('tries a new logo again after an old one failed', () => {
    const { container, rerender } = render(<BankMark bank={{ mark: 'BCA', logoUrl: 'https://x.test/old.png' }} />)
    fireEvent.error(container.querySelector('img'))
    rerender(<BankMark bank={{ mark: 'BCA', logoUrl: 'https://x.test/new.png' }} />)
    expect(container.querySelector('img').getAttribute('src')).toBe('https://x.test/new.png')
  })

  it('without a logo shows the code', () => {
    const { container } = render(<BankMark bank={{ mark: 'ABC', logoUrl: null }} />)
    expect(container.textContent).toBe('ABC')
  })
})
