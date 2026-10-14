import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { createSeed } from '@/data/seed'
import { deriveMortgage } from '@/domains/mortgages/derive'
import { FixedCountdownWidget } from './timeline'

it('Hitung Mundur Fixed for a KPR saved as floating, with no fixed end date, shows its rate instead of crashing', () => {
  const db = createSeed('mortgage_active_floating')
  const m = { ...db.mortgages[0], fixedUntil: null } // what the setup saves for "Sudah floating"
  render(
    <MemoryRouter>
      <FixedCountdownWidget m={m} d={deriveMortgage(m, db.clock)} />
    </MemoryRouter>,
  )
  expect(screen.getByText('Sudah floating')).toBeTruthy()
  expect(screen.getByText(/bunga 9,00%/)).toBeTruthy()
})
