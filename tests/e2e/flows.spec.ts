import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end flows against a real Supabase project. Requires .env.local with a
 * NON-production project that has all migrations applied, plus a dedicated test account:
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run e2e
 * These tests write data to that account.
 */
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
test.skip(!email || !password || !process.env.VITE_SUPABASE_URL, 'Needs a configured Supabase test project and E2E_EMAIL / E2E_PASSWORD')
test.describe.configure({ mode: 'serial' })

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/(dashboard|onboarding)$/)
  if (page.url().endsWith('/onboarding')) {
    await page.getByLabel('Build muscle').check()
    await page.getByLabel(/^Calories/).fill('2600')
    await page.getByLabel(/^Protein/).fill('170')
    await page.getByLabel(/^Carbohydrates/).fill('300')
    await page.getByLabel(/^Fat/).fill('80')
    await page.getByRole('button', { name: 'Start tracking' }).click()
    await page.waitForURL(/\/dashboard$/)
  }
}

test('1. sign in (completing onboarding if needed) reaches the dashboard', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Nutrition today' })).toBeVisible()
})

test('2. logging a meal updates the daily totals', async ({ page }) => {
  await signIn(page)
  await page.goto('/nutrition')
  const before = await page.getByText(/kcal (remaining|over target)/).first().textContent()
  await page.getByRole('button', { name: 'Log food' }).first().click()
  await page.getByLabel('Search foods').fill('egg whole')
  await page.getByRole('button', { name: /^Egg, whole/ }).first().click()
  await page.getByLabel('Measure').selectOption({ label: 'Grams (g)' })
  await page.getByLabel(/^Amount/).fill('100')
  await page.getByRole('button', { name: 'Log and close' }).click()
  await expect(page.getByRole('cell', { name: /Egg, whole/ }).first()).toBeVisible()
  await expect(page.getByText(/kcal (remaining|over target)/).first()).not.toHaveText(before ?? '')
})

test('3 and 4. start a workout, record a set, finish, and see it in history', async ({ page }) => {
  await signIn(page)
  await page.goto('/training')
  const resume = page.getByRole('link', { name: 'Resume workout' })
  if (await resume.isVisible()) await resume.click()
  else await page.getByRole('button', { name: 'Start empty workout' }).click()
  await page.waitForURL(/\/training\/workouts\//)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.getByLabel('Search exercises').fill('barbell back squat')
  await page.getByRole('button', { name: /Barbell Back Squat/ }).first().click()
  await page.getByLabel(/Barbell Back Squat set 1 load/).fill('100')
  await page.getByLabel('Barbell Back Squat set 1 reps').fill('5')
  await page.getByRole('button', { name: 'Mark Barbell Back Squat set 1 done' }).click()
  await expect(page.getByRole('button', { name: /Barbell Back Squat set 1 done/ })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByLabel('Barbell Back Squat set 1 reps')).toHaveValue('5') // persisted
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: 'Finish and save' }).click()
  await expect(page.getByText('Completed workout')).toBeVisible()
  await page.goto('/training')
  await expect(page.getByRole('table', { name: 'Completed workouts' })).toBeVisible()
})

test('5. logging body weight updates the progress chart data', async ({ page }) => {
  await signIn(page)
  await page.goto('/progress')
  await page.getByLabel(/^Weight/).fill('81.7')
  await page.getByRole('button', { name: 'Log weight' }).click()
  await page.getByText('Show data table').first().click()
  await expect(page.getByRole('cell', { name: /81\.7/ }).first()).toBeVisible()
})
