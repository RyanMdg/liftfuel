// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TargetCalculator } from '@/features/nutrition/components/TargetCalculator'

afterEach(cleanup)

describe('TargetCalculator', () => {
  it('validates, then fills targets and returns the inputs to store', async () => {
    const onApply = vi.fn()
    render(<TargetCalculator unit="kg" goal="lose" today="2026-10-14" initial={{}} weightKg={83.5} onApply={onApply} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Calculate targets' }))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Age', { exact: false })).toHaveAccessibleDescription(/whole number/)

    await user.selectOptions(screen.getByLabelText('Sex', { exact: false }), 'male')
    await user.type(screen.getByLabelText('Age', { exact: false }), '30')
    await user.type(screen.getByLabelText('Height', { exact: false }), '180')
    await user.selectOptions(screen.getByLabelText('Activity level', { exact: false }), 'moderate')
    await user.click(screen.getByRole('button', { name: 'Calculate targets' }))

    expect(onApply).toHaveBeenCalledTimes(1)
    const [estimate, inputs] = onApply.mock.calls[0]
    expect(estimate).toMatchObject({ bmr: 1815, tdee: 2813, calories: 2250, protein_g: 167, fat_g: 63, carbs_g: 254 })
    expect(inputs).toEqual({ sex: 'male', birth_year: 1996, height_cm: 180, activity_level: 'moderate' })
    expect(screen.getByText('Maintenance (TDEE)')).toBeInTheDocument()
  })

  it('asks for body weight elsewhere on the page when it is missing', async () => {
    const onApply = vi.fn()
    render(<TargetCalculator unit="lb" goal="gain" today="2026-10-14" weightHint="Enter your current body weight in step 1 first"
      initial={{ sex: 'female', birth_year: 1990, height_cm: 165.1, activity_level: 'light' }} onApply={onApply} />)
    // Height is shown in feet and inches for pound users.
    expect(screen.getByLabelText(/Feet/)).toHaveValue(5)
    expect(screen.getByLabelText(/Inches/)).toHaveValue(5)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Calculate targets' }))
    expect(onApply).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your current body weight in step 1 first')
  })
})
