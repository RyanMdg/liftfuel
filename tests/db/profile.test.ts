import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, errorOf, type TestDb } from './harness'

let t: TestDb
let alice: string
let bob: string

beforeAll(async () => {
  t = await createTestDb()
  alice = await t.createUser('alice@example.com')
  bob = await t.createUser('bob@example.com')
})

describe('profile calculator inputs', () => {
  it('lets a user save their own sex, birth year, height and activity level', async () => {
    await t.asUser(alice)
    await t.db.query(`update public.profiles set sex = 'female', birth_year = 1994, height_cm = 165.5, activity_level = 'moderate' where id = $1`, [alice])
    const r = await t.db.query<{ sex: string; birth_year: number; height_cm: string; activity_level: string }>(
      'select sex, birth_year, height_cm, activity_level from public.profiles where id = $1', [alice])
    expect(r.rows[0]).toMatchObject({ sex: 'female', birth_year: 1994, activity_level: 'moderate' })
    expect(Number(r.rows[0].height_cm)).toBe(165.5)
  })

  it('rejects values outside the allowed sets and ranges', async () => {
    await t.asUser(alice)
    expect(await errorOf(t.db, `update public.profiles set sex = 'other' where id = $1`, [alice])).toMatch(/check constraint/)
    expect(await errorOf(t.db, `update public.profiles set height_cm = 40 where id = $1`, [alice])).toMatch(/check constraint/)
    expect(await errorOf(t.db, `update public.profiles set birth_year = 1800 where id = $1`, [alice])).toMatch(/check constraint/)
    expect(await errorOf(t.db, `update public.profiles set activity_level = 'couch' where id = $1`, [alice])).toMatch(/check constraint/)
  })

  it('another user cannot read or change them', async () => {
    await t.asUser(bob)
    expect((await t.db.query('select height_cm from public.profiles where id = $1', [alice])).rows).toHaveLength(0)
    await t.db.query(`update public.profiles set height_cm = 200 where id = $1`, [alice])
    await t.asUser(alice)
    const r = await t.db.query<{ height_cm: string }>('select height_cm from public.profiles where id = $1', [alice])
    expect(Number(r.rows[0].height_cm)).toBe(165.5)
  })

  it('anonymous clients cannot read them', async () => {
    await t.asAnon()
    expect(await errorOf(t.db, 'select sex from public.profiles')).toMatch(/permission denied/)
  })
})
