import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness'

let t: TestDb
let alice: string
let bob: string

async function catalogFood(name: string) {
  const r = await t.db.query<{ id: string }>(
    'select id from public.foods where owner_id is null and name = $1', [name])
  return r.rows[0].id
}

async function createFood(values: Record<string, unknown>) {
  const cols = Object.keys(values)
  const r = await t.db.query<{ id: string }>(
    `insert into public.foods (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning id`,
    Object.values(values))
  return r.rows[0].id
}

beforeAll(async () => {
  t = await createTestDb()
  alice = await t.createUser('alice@example.com')
  bob = await t.createUser('bob@example.com')
})

beforeEach(async () => {
  await t.asAdmin()
})

describe('profiles', () => {
  it('creates a profile for each new auth user', async () => {
    const r = await t.db.query('select id from public.profiles where id in ($1, $2)', [alice, bob])
    expect(r.rows).toHaveLength(2)
  })

  it('rejects an unknown time zone', async () => {
    await t.asUser(alice)
    expect(await errorOf(t.db, `update public.profiles set time_zone = 'Mars/Olympus' where id = $1`, [alice]))
      .toMatch(/Unknown time zone/)
    await t.db.query(`update public.profiles set time_zone = 'Asia/Manila' where id = $1`, [alice])
  })

  it('completes onboarding atomically', async () => {
    await t.asUser(alice)
    await t.db.query(`select public.complete_onboarding('Alice', 'lb', 'America/New_York', 'gain',
      '2026-10-01', 2800, 180, 320, 80, 82.5)`)
    const p = await t.db.query<{ weight_unit: string; onboarding_completed_at: string | null }>(
      'select weight_unit, onboarding_completed_at from public.profiles where id = $1', [alice])
    expect(p.rows[0].weight_unit).toBe('lb')
    expect(p.rows[0].onboarding_completed_at).not.toBeNull()
    const g = await t.db.query('select * from public.nutrition_goals')
    expect(g.rows).toHaveLength(1)
    const w = await t.db.query<{ weight_kg: string }>('select weight_kg from public.weight_entries')
    expect(Number(w.rows[0].weight_kg)).toBe(82.5)
  })
})

describe('food entry calculation and snapshots', () => {
  it('scales per-100 g foods by grams', async () => {
    await t.asUser(alice)
    const chicken = await catalogFood('Chicken breast, skinless')
    const r = await t.db.query<{ calories: string; protein_g: string; food_name: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, quantity)
       values ('2026-10-05', 'lunch', $1, 150) returning calories, protein_g, food_name`, [chicken])
    expect(Number(r.rows[0].calories)).toBe(180) // 150/100 * 120
    expect(Number(r.rows[0].protein_g)).toBe(33.75) // 150/100 * 22.5
    expect(r.rows[0].food_name).toBe('Chicken breast, skinless')
  })

  it('uses the actual reference amount rather than assuming 100 g', async () => {
    await t.asUser(alice)
    const bar = await createFood({
      name: 'Protein bar', brand: 'Acme', reference_amount: 60, calories: 210, protein_g: 20,
      carbs_g: 22, fat_g: 7, provenance: 'nutrition_label',
    })
    const r = await t.db.query<{ calories: string; carbs_g: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, quantity)
       values ('2026-10-05', 'snacks', $1, 30) returning calories, carbs_g`, [bar])
    expect(Number(r.rows[0].calories)).toBe(105)
    expect(Number(r.rows[0].carbs_g)).toBe(11)
  })

  it('computes quantity from servings and ignores client-supplied nutrients', async () => {
    await t.asUser(alice)
    const egg = await catalogFood('Egg, whole')
    const serving = await t.db.query<{ id: string }>(
      'select id from public.food_servings where food_id = $1', [egg])
    const r = await t.db.query<{ quantity: string; calories: string; serving_label: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, serving_id, serving_count, calories, protein_g, carbs_g, fat_g)
       values ('2026-10-05', 'breakfast', $1, $2, 3, 1, 1, 1, 1) returning quantity, calories, serving_label`,
      [egg, serving.rows[0].id])
    expect(Number(r.rows[0].quantity)).toBe(150)
    expect(Number(r.rows[0].calories)).toBe(214.5) // 150/100 * 143
    expect(r.rows[0].serving_label).toBe('1 large egg')
  })

  it('rejects a serving that belongs to another food', async () => {
    await t.asUser(alice)
    const egg = await catalogFood('Egg, whole')
    const banana = await catalogFood('Banana')
    const bananaServing = await t.db.query<{ id: string }>(
      'select id from public.food_servings where food_id = $1', [banana])
    expect(await errorOf(t.db,
      `insert into public.food_entries (entry_date, meal, food_id, serving_id, serving_count)
       values ('2026-10-05', 'breakfast', $1, $2, 1)`, [egg, bananaServing.rows[0].id]))
      .toMatch(/Serving does not belong/)
  })

  it('keeps historical totals stable when the source food changes', async () => {
    await t.asUser(alice)
    const oats = await createFood({
      name: 'My oats', reference_amount: 100, calories: 380, protein_g: 13, carbs_g: 67, fat_g: 7,
    })
    const e = await t.db.query<{ id: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, quantity)
       values ('2026-10-01', 'breakfast', $1, 50) returning id`, [oats])
    await t.db.query('update public.foods set calories = 500 where id = $1', [oats])
    const before = await t.db.query<{ calories: string }>(
      'select calories from public.food_entries where id = $1', [e.rows[0].id])
    expect(Number(before.rows[0].calories)).toBe(190)

    // Editing quantity recalculates from the snapshot, not the changed food.
    const after = await t.db.query<{ calories: string }>(
      'update public.food_entries set quantity = 100 where id = $1 returning calories', [e.rows[0].id])
    expect(Number(after.rows[0].calories)).toBe(380)

    // Snapshot columns cannot be overwritten by the client.
    const forged = await t.db.query<{ snapshot_calories: string; calories: string }>(
      'update public.food_entries set snapshot_calories = 1, calories = 1 where id = $1 returning snapshot_calories, calories',
      [e.rows[0].id])
    expect(Number(forged.rows[0].snapshot_calories)).toBe(380)
    expect(Number(forged.rows[0].calories)).toBe(380)

    // Deleting the food keeps the entry and its numbers.
    await t.db.query('delete from public.foods where id = $1', [oats])
    const orphan = await t.db.query<{ food_id: string | null; calories: string; food_name: string }>(
      'select food_id, calories, food_name from public.food_entries where id = $1', [e.rows[0].id])
    expect(orphan.rows[0].food_id).toBeNull()
    expect(Number(orphan.rows[0].calories)).toBe(380)
    expect(orphan.rows[0].food_name).toBe('My oats')
  })

  it('switches an entry between serving mode and gram mode', async () => {
    await t.asUser(alice)
    const bread = await catalogFood('Whole wheat bread')
    const s = await t.db.query<{ id: string }>('select id from public.food_servings where food_id = $1', [bread])
    const e = await t.db.query<{ id: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, serving_id, serving_count)
       values ('2026-10-06', 'breakfast', $1, $2, 2) returning id`, [bread, s.rows[0].id])
    const grams = await t.db.query<{ quantity: string; serving_label: string | null }>(
      `update public.food_entries set serving_count = null, quantity = 50 where id = $1
       returning quantity, serving_label`, [e.rows[0].id])
    expect(Number(grams.rows[0].quantity)).toBe(50)
    expect(grams.rows[0].serving_label).toBeNull()
  })

  it('duplicates an entry from its snapshot, optionally to another date and meal', async () => {
    await t.asUser(alice)
    const rice = await catalogFood('White rice, cooked')
    const e = await t.db.query<{ id: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, quantity)
       values ('2026-10-06', 'dinner', $1, 200) returning id`, [rice])
    const d = await t.db.query<{ entry_date: string; meal: string; calories: string; quantity: string }>(
      `insert into public.food_entries (duplicated_from_id, entry_date, meal)
       values ($1, '2026-10-07', 'lunch') returning entry_date::text, meal, calories, quantity`, [e.rows[0].id])
    expect(d.rows[0]).toMatchObject({ entry_date: '2026-10-07', meal: 'lunch' })
    expect(Number(d.rows[0].calories)).toBe(260)
    expect(Number(d.rows[0].quantity)).toBe(200)
  })

  it('aggregates daily totals through the security-invoker view', async () => {
    await t.asUser(alice)
    const r = await t.db.query<{ calories: string; entry_count: number }>(
      `select calories, entry_count from public.daily_nutrition_totals where entry_date = '2026-10-05'`)
    // 180 (chicken) + 105 (bar) + 214.5 (eggs)
    expect(Number(r.rows[0].calories)).toBe(499.5)
    expect(r.rows[0].entry_count).toBe(3)
  })

  it('rejects impossible food definitions', async () => {
    await t.asUser(alice)
    expect(await errorOf(t.db,
      `insert into public.foods (name, reference_amount, calories, protein_g, carbs_g, fat_g)
       values ('Bad', 100, 100, 60, 60, 0)`)).toMatch(/foods_macro_mass/)
    expect(await errorOf(t.db,
      `insert into public.foods (name, reference_amount, calories, protein_g, carbs_g, fat_g)
       values ('Bad', 0, 100, 1, 1, 1)`)).toMatch(/check constraint/)
  })
})

describe('search', () => {
  it('matches every term in name or brand and ranks prefix matches first', async () => {
    await t.asUser(alice)
    const r = await t.db.query<{ name: string }>(`select name from public.search_foods('chicken breast')`)
    expect(r.rows.map((x) => x.name)).toEqual([
      'Chicken breast, skinless', 'Chicken breast, skinless, roasted'])
    const brand = await t.db.query<{ name: string }>(`select name from public.search_foods('acme bar')`)
    expect(brand.rows.map((x) => x.name)).toEqual(['Protein bar'])
    const special = await t.db.query(`select * from public.search_foods('%_\\')`)
    expect(special.rows).toHaveLength(0)
  })

  it('never returns another user\'s private foods', async () => {
    await t.asUser(bob)
    const r = await t.db.query(`select * from public.search_foods('protein bar')`)
    expect(r.rows).toHaveLength(0)
  })
})

describe('nutrition goals', () => {
  it('versions goals by effective date without rewriting history', async () => {
    await t.asUser(alice)
    await t.db.query(`insert into public.nutrition_goals (effective_date, calories, protein_g, carbs_g, fat_g)
      values ('2026-10-10', 2500, 180, 260, 75)`)
    const at = async (d: string) => (await t.db.query<{ calories: string }>(
      `select calories from public.nutrition_goals where effective_date <= $1
       order by effective_date desc limit 1`, [d])).rows[0]?.calories
    expect(Number(await at('2026-10-05'))).toBe(2800)
    expect(Number(await at('2026-10-10'))).toBe(2500)
    expect(Number(await at('2026-12-01'))).toBe(2500)
    expect(await errorOf(t.db, `insert into public.nutrition_goals (effective_date, calories, protein_g, carbs_g, fat_g)
      values ('2026-10-10', 1, 1, 1, 1)`)).toMatch(/duplicate key/)
  })
})

describe('recipes', () => {
  it('derives per-gram nutrition from explicit cooked yield', async () => {
    await t.asUser(alice)
    const rice = await catalogFood('White rice')
    const oil = await catalogFood('Olive oil')
    const id = (await t.db.query<{ save_recipe: string }>(
      `select public.save_recipe(null, 'Rice pot', null, 4, 750, $1::jsonb)`,
      [JSON.stringify([{ food_id: rice, quantity: 250 }, { food_id: oil, quantity: 10 }])])).rows[0].save_recipe
    const f = await t.db.query<{ reference_amount: string; calories: string; provenance: string }>(
      'select reference_amount, calories, provenance from public.foods where recipe_id = $1', [id])
    // 250 g rice (912.5 kcal) + 10 g oil (88.4 kcal) = 1000.9 kcal per 750 g cooked
    expect(Number(f.rows[0].reference_amount)).toBe(750)
    expect(Number(f.rows[0].calories)).toBe(1000.9)
    expect(f.rows[0].provenance).toBe('estimated') // catalog ingredients are estimates
    const s = await t.db.query<{ amount: string }>(
      `select fs.amount from public.food_servings fs join public.foods f on f.id = fs.food_id where f.recipe_id = $1`, [id])
    expect(Number(s.rows[0].amount)).toBe(187.5)
  })

  it('labels yield as estimated when cooked weight is unknown and recomputes on edit', async () => {
    await t.asUser(alice)
    const flour = await createFood({
      name: 'Flour (label)', reference_amount: 100, calories: 364, protein_g: 10, carbs_g: 76, fat_g: 1,
      provenance: 'nutrition_label',
    })
    const id = (await t.db.query<{ save_recipe: string }>(
      `select public.save_recipe(null, 'Flatbread', null, null, null, $1::jsonb)`,
      [JSON.stringify([{ food_id: flour, quantity: 200 }])])).rows[0].save_recipe
    let f = await t.db.query<{ provenance: string; provenance_note: string; reference_amount: string }>(
      'select provenance, provenance_note, reference_amount from public.foods where recipe_id = $1', [id])
    expect(f.rows[0].provenance).toBe('estimated')
    expect(f.rows[0].provenance_note).toMatch(/Cooked yield not recorded/)
    expect(Number(f.rows[0].reference_amount)).toBe(200)

    await t.db.query(`select public.save_recipe($1, 'Flatbread', null, null, 180, $2::jsonb)`,
      [id, JSON.stringify([{ food_id: flour, quantity: 200 }])])
    f = await t.db.query('select provenance, provenance_note, reference_amount from public.foods where recipe_id = $1', [id])
    expect(f.rows[0].provenance).toBe('recipe_calculated')
    expect(Number(f.rows[0].reference_amount)).toBe(180)

    // Editing an ingredient food propagates to the recipe.
    await t.db.query('update public.foods set calories = 400 where id = $1', [flour])
    const c = await t.db.query<{ calories: string }>('select calories from public.foods where recipe_id = $1', [id])
    expect(Number(c.rows[0].calories)).toBe(800)
  })

  it('rejects recipe foods and other users\' foods as ingredients', async () => {
    await t.asUser(alice)
    const recipeFood = await t.db.query<{ id: string }>(
      `select id from public.foods where recipe_id is not null limit 1`)
    expect(await errorOf(t.db, `select public.save_recipe(null, 'Nested', null, null, null, $1::jsonb)`,
      [JSON.stringify([{ food_id: recipeFood.rows[0].id, quantity: 100 }])])).toMatch(/not other recipes/)

    await t.asUser(bob)
    const bobsFood = await createFood({ name: 'Bob food', calories: 100, protein_g: 1, carbs_g: 1, fat_g: 1 })
    await t.asUser(alice)
    expect(await errorOf(t.db, `select public.save_recipe(null, 'Stolen', null, null, null, $1::jsonb)`,
      [JSON.stringify([{ food_id: bobsFood, quantity: 100 }])])).toMatch(/Ingredients must be/)
  })

  it('removes the derived food when a recipe is deleted but keeps logged entries', async () => {
    await t.asUser(alice)
    const r = await t.db.query<{ id: string; food_id: string }>(
      `select r.id, f.id as food_id from public.recipes r join public.foods f on f.recipe_id = r.id
       where r.name = 'Rice pot'`)
    const e = await t.db.query<{ id: string; calories: string }>(
      `insert into public.food_entries (entry_date, meal, food_id, quantity)
       values ('2026-10-08', 'dinner', $1, 375) returning id, calories`, [r.rows[0].food_id])
    expect(Number(e.rows[0].calories)).toBe(500.45)
    await t.db.query('delete from public.recipes where id = $1', [r.rows[0].id])
    const left = await t.db.query<{ food_id: string | null; calories: string }>(
      'select food_id, calories from public.food_entries where id = $1', [e.rows[0].id])
    expect(left.rows[0].food_id).toBeNull()
    expect(Number(left.rows[0].calories)).toBe(500.45)
  })
})

describe('save_food', () => {
  it('creates a food with servings and edits them atomically', async () => {
    await t.asUser(alice)
    const food = {
      name: 'Skyr', brand: 'Siggi', base_unit: 'g', reference_amount: 150, calories: 90, protein_g: 16,
      carbs_g: 6, fat_g: 0, fiber_g: null, preparation: 'not_applicable', provenance: 'nutrition_label',
    }
    const id = (await t.db.query<{ save_food: string }>('select public.save_food(null, $1::jsonb, $2::jsonb)',
      [JSON.stringify(food), JSON.stringify([{ label: '1 pot', amount: 150 }, { label: '1 spoon', amount: 15 }])])).rows[0].save_food
    let servings = await t.db.query<{ id: string; label: string; amount: string }>(
      'select id, label, amount from public.food_servings where food_id = $1 order by position', [id])
    expect(servings.rows.map((s) => s.label)).toEqual(['1 pot', '1 spoon'])

    const potId = servings.rows[0].id
    await t.db.query('select public.save_food($1, $2::jsonb, $3::jsonb)', [id, JSON.stringify({ ...food, calories: 100 }),
      JSON.stringify([{ id: potId, label: '1 pot (150 g)', amount: 150 }, { label: '1 bowl', amount: 300 }])])
    servings = await t.db.query('select id, label, amount from public.food_servings where food_id = $1 order by position', [id])
    expect(servings.rows.map((s) => s.label)).toEqual(['1 pot (150 g)', '1 bowl'])
    expect(servings.rows[0].id).toBe(potId)
  })

  it('rolls back the food when a serving is invalid', async () => {
    await t.asUser(alice)
    const before = await t.db.query<{ n: number }>(`select count(*)::int as n from public.foods where name = 'Broken'`)
    expect(await errorOf(t.db, 'select public.save_food(null, $1::jsonb, $2::jsonb)', [
      JSON.stringify({ name: 'Broken', reference_amount: 100, calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0 }),
      JSON.stringify([{ label: 'bad', amount: -1 }]),
    ])).toMatch(/check constraint/)
    const after = await t.db.query<{ n: number }>(`select count(*)::int as n from public.foods where name = 'Broken'`)
    expect(after.rows[0].n).toBe(before.rows[0].n)
  })

  it('refuses recipe provenance and recipe-derived foods', async () => {
    await t.asUser(alice)
    expect(await errorOf(t.db, 'select public.save_food(null, $1::jsonb)', [JSON.stringify({
      name: 'Fake', reference_amount: 100, calories: 1, protein_g: 0, carbs_g: 0, fat_g: 0, provenance: 'recipe_calculated' })]))
      .toMatch(/set by recipes only/)
  })
})
