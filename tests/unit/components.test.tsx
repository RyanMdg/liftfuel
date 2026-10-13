// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { NumberInput } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { NutritionSummary } from '@/features/nutrition/components/NutritionSummary'
import type { NutritionGoal } from '@/types/database'

const goal: NutritionGoal = {
  id: 'g', user_id: 'u', effective_date: '2026-10-01', calories: 2500, protein_g: 180, carbs_g: 250, fat_g: 70, created_at: '', updated_at: '',
}

function summary(calories: number, resolved: Parameters<typeof NutritionSummary>[0]['resolved']) {
  return render(
    <MemoryRouter>
      <NutritionSummary totals={{ calories, protein_g: 190, carbs_g: 100, fat_g: 40, fiber_g: null }} resolved={resolved} />
    </MemoryRouter>,
  )
}

describe('NutritionSummary', () => {
  it('states remaining calories and exposes progress to assistive technology', () => {
    summary(2100, { goal, isFallback: false })
    expect(screen.getByText('400 kcal remaining')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar', { name: 'Calories against target' })
    expect(bar).toHaveAttribute('aria-valuetext', '2,100 of 2,500 kcal')
    expect(screen.getByText('10 g over')).toBeInTheDocument() // protein 190 of 180
    expect(screen.getByText('Targets in effect since 1 Oct 2026.', { exact: false })).toBeInTheDocument()
  })

  it('reports exceeded calories in words, not only colour', () => {
    summary(2714, { goal, isFallback: false })
    expect(screen.getByText('214 kcal over target')).toBeInTheDocument()
  })

  it('explains when no target exists instead of inventing one', () => {
    summary(900, { goal: null, isFallback: false })
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set targets' })).toHaveAttribute('href', '/settings#targets')
  })

  it('flags days before the first target', () => {
    summary(900, { goal, isFallback: true })
    expect(screen.getByText(/before your first targets/)).toBeInTheDocument()
  })
})

describe('form fields', () => {
  it('associates a visible label and announces the unit', () => {
    render(<NumberInput label="Weight" unit="kg" error="Enter a realistic weight" />)
    const input = screen.getByLabelText('Weight in kg')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a realistic weight')
    expect(input).toHaveAttribute('inputmode', 'decimal')
  })
})

describe('SegmentedControl', () => {
  function Harness() {
    const [v, setV] = useState<'a' | 'b' | 'c'>('a')
    return <SegmentedControl label="Period" value={v} onChange={setV} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />
  }
  it('is a keyboard-operable radio group', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const a = screen.getByRole('radio', { name: 'A' })
    expect(a).toHaveAttribute('aria-checked', 'true')
    a.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'B' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true')
  })
})
