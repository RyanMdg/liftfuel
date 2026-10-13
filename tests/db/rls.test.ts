import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness'

let t: TestDb
let alice: string
let bob: string
const ids: Record<string, string> = {}

beforeAll(async () => {
  t = await createTestDb()
  alice = await t.createUser('alice@example.com')
  bob = await t.createUser('bob@example.com')

  // Alice creates one of everything.
  await t.asUser(alice)
  const one = async (sql: string, params: unknown[] = []) =>
    (await t.db.query<{ id: string }>(sql, params)).rows[0].id
  ids.food = await one(`insert into public.foods (name, calories, protein_g, carbs_g, fat_g)
    values ('Alice secret food', 100, 10, 5, 2) returning id`)
  ids.serving = await one(`insert into public.food_servings (food_id, label, amount) values ($1, '1 cup', 80) returning id`, [ids.food])
  ids.entry = await one(`insert into public.food_entries (entry_date, meal, food_id, quantity)
    values ('2026-10-01', 'lunch', $1, 100) returning id`, [ids.food])
  ids.goal = await one(`insert into public.nutrition_goals (effective_date, calories, protein_g, carbs_g, fat_g)
    values ('2026-10-01', 2000, 150, 200, 60) returning id`)
  ids.weight = await one(`insert into public.weight_entries (entry_date, weight_kg) values ('2026-10-01', 80) returning id`)
  ids.exercise = await one(`insert into public.exercises (name, equipment, category, movement_pattern, mechanic)
    values ('Alice press', 'barbell', 'chest', 'horizontal_push', 'compound') returning id`)
  ids.template = await one(`insert into public.workout_templates (name) values ('Alice A') returning id`)
  ids.templateExercise = await one('select public.add_template_exercise($1, $2) as id', [ids.template, ids.exercise])
  ids.session = await one(`select session_id as id from public.start_workout('2026-10-01')`)
  ids.workoutExercise = await one('select public.add_workout_exercise($1, $2) as id', [ids.session, ids.exercise])
  ids.set = await one('select id from public.workout_sets where workout_exercise_id = $1', [ids.workoutExercise])
  ids.recipe = await one(`select public.save_recipe(null, 'Alice recipe', null, null, null, $1::jsonb) as id`,
    [JSON.stringify([{ food_id: ids.food, quantity: 100 }])])
  await t.db.query('insert into public.favorite_foods (food_id) values ($1)', [ids.food])
})

const tables: Array<[string, string]> = [
  ['foods', 'food'], ['food_servings', 'serving'], ['food_entries', 'entry'], ['nutrition_goals', 'goal'],
  ['weight_entries', 'weight'], ['exercises', 'exercise'], ['workout_templates', 'template'],
  ['template_exercises', 'templateExercise'], ['workout_sessions', 'session'],
  ['workout_exercises', 'workoutExercise'], ['workout_sets', 'set'], ['recipes', 'recipe'],
]

describe('row level security between users', () => {
  it.each(tables)('bob cannot read, update or delete alice\'s %s', async (table, key) => {
    await t.asUser(bob)
    const read = await t.db.query(`select * from public.${table} where id = $1`, [ids[key]])
    expect(read.rows).toHaveLength(0)
    const upd = await t.db.query(`update public.${table} set created_at = created_at where id = $1 returning id`, [ids[key]])
    expect(upd.rows).toHaveLength(0)
    const del = await t.db.query(`delete from public.${table} where id = $1 returning id`, [ids[key]])
    expect(del.rows).toHaveLength(0)
    await t.asUser(alice)
    const still = await t.db.query(`select id from public.${table} where id = $1`, [ids[key]])
    expect(still.rows).toHaveLength(1)
  })

  it('bob cannot read alice\'s profile, favourites, recipe ingredients or analytics', async () => {
    await t.asUser(bob)
    expect((await t.db.query('select * from public.profiles where id = $1', [alice])).rows).toHaveLength(0)
    expect((await t.db.query('select * from public.favorite_foods')).rows).toHaveLength(0)
    expect((await t.db.query('select * from public.recipe_ingredients')).rows).toHaveLength(0)
    expect((await t.db.query('select * from public.daily_nutrition_totals')).rows).toHaveLength(0)
    expect((await t.db.query('select * from public.completed_sets')).rows).toHaveLength(0)
    expect((await t.db.query('select * from public.exercise_records')).rows).toHaveLength(0)
  })

  it('bob cannot insert rows that claim alice as owner', async () => {
    await t.asUser(bob)
    expect(await errorOf(t.db, `insert into public.weight_entries (user_id, entry_date, weight_kg)
      values ($1, '2026-10-02', 90)`, [alice])).toMatch(/row-level security/)
    expect(await errorOf(t.db, `insert into public.foods (owner_id, name, calories, protein_g, carbs_g, fat_g)
      values (null, 'Fake catalog food', 1, 0, 0, 0)`)).toMatch(/row-level security/)
  })

  it('bob cannot attach children to alice\'s parents or reference her private rows', async () => {
    await t.asUser(bob)
    expect(await errorOf(t.db, `insert into public.workout_sets (workout_exercise_id, set_number) values ($1, 9)`,
      [ids.workoutExercise])).toMatch(/row-level security/)
    expect(await errorOf(t.db, `insert into public.food_servings (food_id, label, amount) values ($1, 'x', 1)`,
      [ids.food])).toMatch(/row-level security/)
    expect(await errorOf(t.db, `insert into public.food_entries (entry_date, meal, food_id, quantity)
      values ('2026-10-01', 'lunch', $1, 100)`, [ids.food])).toMatch(/Food not found/)
    expect(await errorOf(t.db, `insert into public.food_entries (duplicated_from_id, entry_date, meal)
      values ($1, '2026-10-01', 'lunch')`, [ids.entry])).toMatch(/not found/)
    expect(await errorOf(t.db, 'insert into public.favorite_foods (food_id) values ($1)', [ids.food]))
      .toMatch(/row-level security/)
    const bobTemplate = (await t.db.query<{ id: string }>(
      `insert into public.workout_templates (name) values ('Bob A') returning id`)).rows[0].id
    expect(await errorOf(t.db, 'select public.add_template_exercise($1, $2)', [bobTemplate, ids.exercise]))
      .toMatch(/row-level security/)
    expect(await errorOf(t.db, `select * from public.start_workout('2026-10-01', $1)`, [ids.template]))
      .toMatch(/Template not found/)
  })

  it('bob\'s RPCs cannot act on alice\'s rows', async () => {
    await t.asUser(bob)
    expect(await errorOf(t.db, 'select public.finish_workout($1)', [ids.session])).toMatch(/not found/)
    expect(await errorOf(t.db, 'select public.add_workout_set($1)', [ids.workoutExercise])).toMatch(/not found/)
    expect(await errorOf(t.db, `select public.save_recipe($1, 'Hijack', null, null, null, $2::jsonb)`,
      [ids.recipe, JSON.stringify([{ food_id: ids.food, quantity: 1 }])])).toMatch(/not found|Ingredients/)
    const prev = await t.db.query('select * from public.get_previous_performance($1)', [ids.session])
    expect(prev.rows).toHaveLength(0)
  })

  it('the shared catalog stays readable to every signed-in user', async () => {
    await t.asUser(bob)
    const foods = await t.db.query<{ n: number }>('select count(*)::int as n from public.foods where owner_id is null')
    const exercises = await t.db.query<{ n: number }>('select count(*)::int as n from public.exercises where owner_id is null')
    const servings = await t.db.query<{ n: number }>('select count(*)::int as n from public.food_servings')
    expect(foods.rows[0].n).toBeGreaterThan(30)
    expect(exercises.rows[0].n).toBeGreaterThan(60)
    expect(servings.rows[0].n).toBeGreaterThan(20)
    expect(await errorOf(t.db, `update public.foods set calories = 1 where owner_id is null`)).toBeNull()
    const unchanged = await t.db.query<{ n: number }>(
      'select count(*)::int as n from public.foods where owner_id is null and calories = 1')
    expect(unchanged.rows[0].n).toBe(0)
  })

  it('anonymous clients cannot read anything', async () => {
    await t.asAnon()
    expect(await errorOf(t.db, 'select * from public.foods')).toMatch(/permission denied/)
    expect(await errorOf(t.db, 'select * from public.exercises')).toMatch(/permission denied/)
    expect(await errorOf(t.db, `select public.search_foods('egg')`)).toMatch(/permission denied/)
  })
})
