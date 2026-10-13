import { expect, test } from '@playwright/test'

test.describe('signed-out smoke', () => {
  test('protected routes redirect to sign in', async ({ page }) => {
    await page.goto('/nutrition')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('sign-in form has labelled fields and validates input', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  test('sign-up enforces a minimum password length', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Use at least 8 characters')).toBeVisible()
  })

  test('uses Montserrat and has no horizontal overflow', async ({ page }) => {
    await page.goto('/login')
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(font).toContain('Montserrat')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('unknown routes redirect signed-out users to sign in', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(page).toHaveURL(/\/login$/)
  })
})
