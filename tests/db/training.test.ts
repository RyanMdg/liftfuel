import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness'

let t: TestDb
let alice: string

async function exerciseId(name: string) {
  const r = await t.db.query<{ id: string }>('select id from public.exercises where name = $1', [name])
  return r.rows[0].id
}

async function start(date: string, templateId: string | null = null) {
  const r = await t.db.query<{ session_id: string; created: boolean }>(
    'select * from public.start_workout($1, $2)', [date, templateId])
  return r.rows[0]
}

async function setsOf(sessionId: string) {
  return (await t.db.query<{ id: string; set_number: number; workout_exercise_id: string; exercise_id: string }>(
    `select ws.id, ws.set_number, ws.workout_exercise_id, we.exercise_id
     from public.workout_sets ws join public.workout_exercises we on we.id = ws.workout_exercise_id
     where we.session_id = $1 order by we.position, ws.set_number`, [sessionId])).rows
}

beforeAll(async () => {
  t = await createTestDb()
  alice = await t.createUser('alice@example.com')
})

beforeEach(async () => {
  await t.asUser(alice)
})

describe('exercise library', () => {
  it('prevents duplicates caused by inconsistent naming', async () => {
    expect(await errorOf(t.db,
      `insert into public.exercises (name, equipment, category, movement_pattern, mechanic)
       values ('  barbell   bench PRESS ', 'barbell', 'chest', 'horizontal_push', 'compound')`))
      .toMatch(/already exists in the library/)
    await t.db.query(`insert into public.exercises (name, equipment, category, movement_pattern, mechanic)
       values ('Spoto  Press', 'barbell', 'chest', 'horizontal_push', 'compound')`)
    expect(await errorOf(t.db,
      `insert into public.exercises (name, equipment, category, movement_pattern, mechanic)
       values ('spoto press', 'barbell', 'chest', 'horizontal_push', 'compound')`)).toMatch(/duplicate key/)
  })

})

describe('templates', () => {
  let templateId: string

  it('adds and reorders template exercises atomically', async () => {
    templateId = (await t.db.query<{ id: string }>(
      `insert into public.workout_templates (name) values ('Lower A') returning id`)).rows[0].id
    const squat = await exerciseId('Barbell Back Squat')
    const rdl = await exerciseId('Romanian Deadlift')
    const curl = await exerciseId('Lying Leg Curl')
    const ids: string[] = []
    for (const ex of [squat, rdl, curl]) {
      ids.push((await t.db.query<{ add_template_exercise: string }>(
        'select public.add_template_exercise($1, $2)', [templateId, ex])).rows[0].add_template_exercise)
    }
    await t.db.query(`update public.template_exercises set planned_sets = 4, rep_min = 3, rep_max = 5, target_rpe = 8
      where id = $1`, [ids[0]])
    await t.db.query('select public.reorder_template_exercises($1, $2)', [templateId, [ids[2], ids[0], ids[1]]])
    const order = await t.db.query<{ id: string }>(
      'select id from public.template_exercises where template_id = $1 order by position', [templateId])
    expect(order.rows.map((r) => r.id)).toEqual([ids[2], ids[0], ids[1]])
    expect(await errorOf(t.db, 'select public.reorder_template_exercises($1, $2)', [templateId, [ids[0]]]))
      .toMatch(/exactly once/)
    // restore natural order for later tests
    await t.db.query('select public.reorder_template_exercises($1, $2)', [templateId, ids])
  })

  it('validates rep ranges and RPE', async () => {
    expect(await errorOf(t.db, `update public.template_exercises set rep_min = 8, rep_max = 5
      where template_id = $1`, [templateId])).toMatch(/rep_range/)
    expect(await errorOf(t.db, `update public.template_exercises set target_rpe = 8.3
      where template_id = $1`, [templateId])).toMatch(/check constraint/)
  })

  it('starts a workout from a template with planned sets', async () => {
    const s = await start('2026-10-01', templateId)
    expect(s.created).toBe(true)
    const sets = await setsOf(s.session_id)
    expect(sets).toHaveLength(4 + 3 + 3)
    const firstEx = await t.db.query<{ rep_min: number; rep_max: number; target_rpe: string }>(
      'select rep_min, rep_max, target_rpe from public.workout_exercises where session_id = $1 order by position limit 1',
      [s.session_id])
    expect(firstEx.rows[0]).toMatchObject({ rep_min: 3, rep_max: 5 })
  })
})

describe('active workout', () => {
  it('prevents a second in-progress session and returns the existing one', async () => {
    const existing = (await t.db.query<{ id: string }>(
      `select id from public.workout_sessions where status = 'in_progress'`)).rows[0].id
    const again = await start('2026-10-01')
    expect(again).toEqual({ session_id: existing, created: false })
    expect(await errorOf(t.db, `insert into public.workout_sessions (name, session_date) values ('x', '2026-10-01')`))
      .toMatch(/duplicate key/)
  })

  it('logs, edits and completes sets; completed sets need reps', async () => {
    const session = (await t.db.query<{ id: string }>(
      `select id from public.workout_sessions where status = 'in_progress'`)).rows[0].id
    const sets = await setsOf(session)
    expect(await errorOf(t.db, 'update public.workout_sets set completed_at = now() where id = $1', [sets[0].id]))
      .toMatch(/completed_has_reps/)
    await t.db.query(`update public.workout_sets set load_kg = 140, reps = 5, rpe = 8, completed_at = now()
      where id = $1`, [sets[0].id])
    await t.db.query(`update public.workout_sets set load_kg = 142.5, reps = 4, rpe = 9, completed_at = now()
      where id = $1`, [sets[1].id])
    const added = (await t.db.query<{ add_workout_set: string }>(
      'select public.add_workout_set($1)', [sets[0].workout_exercise_id])).rows[0].add_workout_set
    const copy = await t.db.query<{ set_number: number; load_kg: string; reps: number | null }>(
      'select set_number, load_kg, reps from public.workout_sets where id = $1', [added])
    expect(copy.rows[0].set_number).toBe(5)
    expect(copy.rows[0].reps).toBeNull()
    await t.db.query('delete from public.workout_sets where id = $1', [added])
  })

  it('refuses to finish a workout without completed sets', async () => {
    await t.asAdmin()
    const bob = await t.createUser('bob-finish@example.com')
    await t.asUser(bob)
    const s = await start('2026-10-01')
    expect(await errorOf(t.db, 'select public.finish_workout($1)', [s.session_id])).toMatch(/at least one set/)
    await t.db.query('delete from public.workout_sessions where id = $1', [s.session_id])
  })

  it('finishes, discarding incomplete sets and empty exercises, idempotently', async () => {
    const session = (await t.db.query<{ id: string }>(
      `select id from public.workout_sessions where status = 'in_progress'`)).rows[0].id
    await t.db.query('select public.finish_workout($1)', [session])
    await t.db.query('select public.finish_workout($1)', [session])
    const sets = await setsOf(session)
    expect(sets).toHaveLength(2)
    const ex = await t.db.query('select id from public.workout_exercises where session_id = $1', [session])
    expect(ex.rows).toHaveLength(1)
    const s = await t.db.query<{ status: string }>('select status from public.workout_sessions where id = $1', [session])
    expect(s.rows[0].status).toBe('completed')
  })

  it('returns previous performance from the most recent earlier completed session', async () => {
    const squat = await exerciseId('Barbell Back Squat')
    const s = await start('2026-10-08')
    await t.db.query('select public.add_workout_exercise($1, $2, 3)', [s.session_id, squat])
    const prev = await t.db.query<{ set_ordinal: number; load_kg: string; reps: number; session_date: string }>(
      'select set_ordinal, load_kg, reps, session_date::text from public.get_previous_performance($1)', [s.session_id])
    expect(prev.rows.map((r) => [r.set_ordinal, Number(r.load_kg), r.reps])).toEqual([[1, 140, 5], [2, 142.5, 4]])
    expect(prev.rows[0].session_date).toBe('2026-10-01')
  })

  it('exposes only completed sets of completed sessions in the analytics view', async () => {
    const r = await t.db.query<{ n: number }>('select count(*)::int as n from public.completed_sets')
    expect(r.rows[0].n).toBe(2)
  })

  it('computes all-time records in the database with the same rules as the client', async () => {
    const squat = await exerciseId('Barbell Back Squat')
    const r = await t.db.query<{
      best_e1rm: string; e1rm_reps: number; heaviest_kg: string; best_set_volume_kg: string; max_reps: number; category: string
    }>('select best_e1rm, e1rm_reps, heaviest_kg, best_set_volume_kg, max_reps, category from public.exercise_records where exercise_id = $1', [squat])
    // 140 x 5 -> e1RM 163.33, volume 700; 142.5 x 4 -> e1RM 161.5, volume 570
    expect(Number(r.rows[0].best_e1rm)).toBe(163.33)
    expect(r.rows[0].e1rm_reps).toBe(5)
    expect(Number(r.rows[0].heaviest_kg)).toBe(142.5)
    expect(Number(r.rows[0].best_set_volume_kg)).toBe(700)
    expect(r.rows[0].max_reps).toBe(5)
    expect(r.rows[0].category).toBe('legs')
  })

  it('no longer has powerlifting-specific columns', async () => {
    const cols = await t.db.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name in ('exercises', 'completed_sets', 'exercise_records')`)
    expect(cols.rows.map((c) => c.column_name)).not.toContain('powerlifting_lift')
  })
})
