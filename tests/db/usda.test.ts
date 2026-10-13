import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness'

let t: TestDb
let alice: string
let bob: string

const egg = { fdc_id: 171287, description: 'Egg, whole, raw, fresh', data_type: 'SR Legacy', grams: 100, calories: 143, protein_g: 12.6, carbs_g: 0.72, fat_g: 9.51, fiber_g: 0 }
const rice = { fdc_id: 2710788, description: 'Rice, white, cooked, as ingredient', data_type: 'Survey (FNDDS)', grams: 174, calories: 130, protein_g: 2.54, carbs_g: 28.98, fat_g: 0.37, fiber_g: 0 }

beforeAll(async () => {
  t = await createTestDb()
  alice = await t.createUser('alice@example.com')
  bob = await t.createUser('bob@example.com')
})

describe('log_usda_foods', () => {
  it('stores each USDA food once per user with provenance and logs entries via the snapshot trigger', async () => {
    await t.asUser(alice)
    const n = await t.db.query<{ log_usda_foods: number }>(`select public.log_usda_foods('2026-10-14', 'breakfast', $1::jsonb)`, [JSON.stringify([egg, rice])])
    expect(n.rows[0].log_usda_foods).toBe(2)
    const entries = await t.db.query<{ food_name: string; quantity: string; calories: string; snapshot_provenance: string }>(
      `select food_name, quantity, calories, snapshot_provenance from public.food_entries order by food_name`)
    expect(entries.rows.map((e) => [e.food_name, Number(e.quantity), Number(e.calories), e.snapshot_provenance])).toEqual([
      ['Egg, whole, raw, fresh', 100, 143, 'reference_database'],
      ['Rice, white, cooked, as ingredient', 174, 226.2, 'reference_database'],
    ])
    const food = await t.db.query<{ provenance_note: string; reference_amount: string }>(`select provenance_note, reference_amount from public.foods where fdc_id = 171287`)
    expect(food.rows[0].provenance_note).toMatch(/FDC ID 171287 \(SR Legacy\)/)
    expect(Number(food.rows[0].reference_amount)).toBe(100)

    // Logging the same USDA food again reuses the stored food.
    await t.db.query(`select public.log_usda_foods('2026-10-15', 'lunch', $1::jsonb)`, [JSON.stringify([{ ...egg, grams: 50 }])])
    const foods = await t.db.query<{ n: number }>(`select count(*)::int as n from public.foods where fdc_id = 171287`)
    expect(foods.rows[0].n).toBe(1)
  })

  it('keeps users isolated: the same FDC food is a separate private row per user', async () => {
    await t.asUser(bob)
    expect((await t.db.query('select * from public.foods where fdc_id is not null')).rows).toHaveLength(0)
    await t.db.query(`select public.log_usda_foods('2026-10-14', 'dinner', $1::jsonb)`, [JSON.stringify([egg])])
    expect((await t.db.query('select * from public.foods where fdc_id = 171287')).rows).toHaveLength(1)
    expect((await t.db.query('select * from public.food_entries')).rows).toHaveLength(1)
  })

  it('is atomic: an invalid item logs nothing', async () => {
    await t.asUser(alice)
    const before = await t.db.query<{ n: number }>('select count(*)::int as n from public.food_entries')
    expect(await errorOf(t.db, `select public.log_usda_foods('2026-10-16', 'lunch', $1::jsonb)`,
      [JSON.stringify([{ ...egg, fdc_id: 999001, grams: 80 }, { ...rice, fdc_id: 999002, grams: -5 }])])).toMatch(/check constraint|Quantity/)
    const after = await t.db.query<{ n: number }>('select count(*)::int as n from public.food_entries')
    expect(after.rows[0].n).toBe(before.rows[0].n)
    expect((await t.db.query('select * from public.foods where fdc_id = 999001')).rows).toHaveLength(0)
  })

  it('rejects empty and oversized batches and bad meals', async () => {
    await t.asUser(alice)
    expect(await errorOf(t.db, `select public.log_usda_foods('2026-10-16', 'lunch', '[]'::jsonb)`)).toMatch(/Nothing to log/)
    expect(await errorOf(t.db, `select public.log_usda_foods('2026-10-16', 'lunch', $1::jsonb)`,
      [JSON.stringify(Array.from({ length: 21 }, () => egg))])).toMatch(/at most 20/)
    expect(await errorOf(t.db, `select public.log_usda_foods('2026-10-16', 'brunch', $1::jsonb)`, [JSON.stringify([egg])])).toMatch(/check constraint/)
  })
})

describe('consume_ai_request', () => {
  it('enforces an hourly limit per user and cannot be reset by the user', async () => {
    await t.asUser(alice)
    const call = async () => (await t.db.query<{ consume_ai_request: boolean }>(`select public.consume_ai_request('meal_estimate', 3)`)).rows[0].consume_ai_request
    expect([await call(), await call(), await call(), await call()]).toEqual([true, true, true, false])
    expect(await errorOf(t.db, 'delete from public.ai_requests')).toMatch(/permission denied/)
    expect(await call()).toBe(false)
  })

  it('counts each user separately and hides other users\' usage', async () => {
    await t.asUser(bob)
    expect((await t.db.query('select * from public.ai_requests')).rows).toHaveLength(0)
    const ok = await t.db.query<{ consume_ai_request: boolean }>(`select public.consume_ai_request('meal_estimate', 3)`)
    expect(ok.rows[0].consume_ai_request).toBe(true)
  })

  it('is not available to anonymous clients', async () => {
    await t.asAnon()
    expect(await errorOf(t.db, `select public.consume_ai_request('meal_estimate', 3)`)).toMatch(/permission denied/)
    expect(await errorOf(t.db, `select public.log_usda_foods('2026-10-16', 'lunch', '[]'::jsonb)`)).toMatch(/permission denied/)
  })
})
