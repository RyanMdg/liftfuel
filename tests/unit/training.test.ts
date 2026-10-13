import { describe, expect, it } from 'vitest'
import {
  countedSets, e1rmForSet, e1rmSeries, epley, exerciseSeries, personalRecords, recentRecords,
  setsByCategory, trainingVolume, weeklyTraining,
} from '@/lib/training'
import type { CompletedSet } from '@/types/database'

let seq = 0
function cs(p: Partial<CompletedSet> & Pick<CompletedSet, 'exercise_id' | 'session_date' | 'load_kg' | 'reps'>): CompletedSet {
  seq++
  return {
    set_id: `s${seq}`, user_id: 'u', session_id: `sess-${p.session_date}`, session_completed_at: `${p.session_date}T12:00:00Z`,
    workout_exercise_id: 'we', exercise_name: p.exercise_id, category: 'legs', mechanic: 'compound', set_number: 1,
    set_type: 'working', load_unit: 'kg', rpe: null, completed_at: `${p.session_date}T10:${String(seq % 60).padStart(2, '0')}:00Z`,
    ...p,
  }
}

describe('epley', () => {
  it('computes the Epley estimate', () => {
    expect(epley(100, 5)).toBe(116.67)
    expect(epley(140, 3)).toBe(154)
  })
  it('returns the load itself for a single', () => {
    expect(epley(180, 1)).toBe(180)
  })
  it('is not reported outside 1-10 reps or without load', () => {
    expect(epley(60, 11)).toBeNull()
    expect(epley(60, 0)).toBeNull()
    expect(epley(0, 5)).toBeNull()
    expect(epley(null, 5)).toBeNull()
    expect(epley(100, 2.5)).toBeNull()
  })
})

describe('completed-set filtering and volume', () => {
  const sets = [
    { set_type: 'warmup' as const, load_kg: 60, reps: 5, completed_at: 'x' },
    { set_type: 'working' as const, load_kg: 100, reps: 5, completed_at: 'x' },
    { set_type: 'working' as const, load_kg: 100, reps: 5, completed_at: null },
    { set_type: 'drop' as const, load_kg: 80, reps: 8, completed_at: 'x' },
    { set_type: 'working' as const, load_kg: null, reps: 10, completed_at: 'x' },
  ]
  it('excludes warm-ups and uncompleted sets', () => {
    expect(countedSets(sets)).toHaveLength(3)
  })
  it('computes volume load over counted sets', () => {
    expect(trainingVolume(sets)).toBe(100 * 5 + 80 * 8)
  })
  it('only estimates 1RM from completed working sets', () => {
    expect(e1rmForSet(sets[0])).toBeNull()
    expect(e1rmForSet(sets[2])).toBeNull()
    expect(e1rmForSet(sets[3])).toBeNull()
    expect(e1rmForSet(sets[1])).toBe(116.67)
  })
})

describe('personal records', () => {
  const sets = [
    cs({ exercise_id: 'squat', session_date: '2026-09-01', load_kg: 140, reps: 5 }),
    cs({ exercise_id: 'squat', session_date: '2026-09-08', load_kg: 160, reps: 1 }),
    cs({ exercise_id: 'squat', session_date: '2026-09-15', load_kg: 145, reps: 5 }),
    cs({ exercise_id: 'squat', session_date: '2026-09-15', load_kg: 100, reps: 20 }),
    cs({ exercise_id: 'squat', session_date: '2026-09-20', load_kg: 200, reps: 3, set_type: 'warmup' }),
  ]
  it('selects best e1RM and heaviest load, ignoring warm-ups and high-rep estimates', () => {
    const pr = personalRecords(sets).get('squat')!
    expect(pr.bestE1rm).toMatchObject({ value: 169.17, loadKg: 145, reps: 5, date: '2026-09-15' })
    expect(pr.heaviest).toMatchObject({ loadKg: 160, reps: 1, date: '2026-09-08' })
  })
  it('reports records broken since a date, but not first-ever performances', () => {
    const events = recentRecords(sets, '2026-09-08')
    expect(events.map((e) => [e.kind, e.date, e.value])).toEqual([
      ['heaviest', '2026-09-08', 160],
      ['e1rm', '2026-09-15', 169.17],
    ])
    expect(recentRecords([sets[0]], '2026-01-01')).toEqual([])
  })
})

describe('exercise series (Hevy-style graphs)', () => {
  const sets = [
    cs({ exercise_id: 'row', session_date: '2026-10-01', load_kg: 40, reps: 10, set_type: 'warmup' }),
    cs({ exercise_id: 'row', session_date: '2026-10-01', load_kg: 60, reps: 10 }),
    cs({ exercise_id: 'row', session_date: '2026-10-01', load_kg: 65, reps: 8 }),
    cs({ exercise_id: 'row', session_date: '2026-10-08', load_kg: 70, reps: 12 }),
    cs({ exercise_id: 'pullup', session_date: '2026-10-08', load_kg: null, reps: 9, category: 'back' }),
    cs({ exercise_id: 'pullup', session_date: '2026-10-10', load_kg: null, reps: 7, category: 'back' }),
  ]
  it('computes best e1RM, heaviest weight, session volume and total reps per date, excluding warm-ups', () => {
    expect(exerciseSeries(sets, 'row', 'e1rm')).toEqual([{ date: '2026-10-01', value: 82.33 }]) // 12-rep set ineligible
    expect(exerciseSeries(sets, 'row', 'heaviest')).toEqual([{ date: '2026-10-01', value: 65 }, { date: '2026-10-08', value: 70 }])
    expect(exerciseSeries(sets, 'row', 'session_volume')).toEqual([{ date: '2026-10-01', value: 1120 }, { date: '2026-10-08', value: 840 }])
    expect(exerciseSeries(sets, 'row', 'session_reps')).toEqual([{ date: '2026-10-01', value: 18 }, { date: '2026-10-08', value: 12 }])
  })
  it('supports bodyweight exercises through reps, without inventing load', () => {
    expect(exerciseSeries(sets, 'pullup', 'session_reps')).toEqual([{ date: '2026-10-08', value: 9 }, { date: '2026-10-10', value: 7 }])
    expect(exerciseSeries(sets, 'pullup', 'heaviest')).toEqual([])
  })
  it('counts sets per body area, excluding warm-ups and dates outside the range', () => {
    expect(setsByCategory(sets, '2026-10-01', '2026-10-09')).toEqual([{ category: 'legs', sets: 3 }, { category: 'back', sets: 1 }])
  })
})

describe('series and weekly aggregation', () => {
  const sets = [
    cs({ exercise_id: 'bp', session_date: '2026-10-05', load_kg: 100, reps: 5 }),
    cs({ exercise_id: 'bp', session_date: '2026-10-05', load_kg: 105, reps: 3 }),
    cs({ exercise_id: 'bp', session_date: '2026-10-07', load_kg: 60, reps: 10, set_type: 'warmup' }),
    cs({ exercise_id: 'bp', session_date: '2026-10-21', load_kg: 102.5, reps: 5 }),
  ]
  it('takes the best e1RM per session date', () => {
    expect(e1rmSeries(sets, () => true)).toEqual([
      { date: '2026-10-05', e1rm: 116.67 },
      { date: '2026-10-21', e1rm: 119.58 },
    ])
  })
  it('includes empty weeks so gaps stay visible', () => {
    const weeks = weeklyTraining(sets, '2026-10-05', '2026-10-25')
    expect(weeks.map((w) => [w.week, w.volume, w.sessions])).toEqual([
      ['2026-10-05', 815, 2],
      ['2026-10-12', 0, 0],
      ['2026-10-19', 512.5, 1],
    ])
  })
})

describe('fetchAllPages', () => {
  it('keeps requesting pages until a short page arrives', async () => {
    const { fetchAllPages } = await import('@/lib/paginate')
    const source = Array.from({ length: 2500 }, (_, i) => i)
    const calls: Array<[number, number]> = []
    const rows = await fetchAllPages(async (from, to) => {
      calls.push([from, to])
      return { data: source.slice(from, to + 1), error: null }
    })
    expect(rows).toHaveLength(2500)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
  it('propagates errors', async () => {
    const { fetchAllPages } = await import('@/lib/paginate')
    await expect(fetchAllPages(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
