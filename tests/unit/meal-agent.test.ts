import { describe, expect, it } from 'vitest'
import {
  buildEstimate, extractPer100g, runMealAgent, searchUsda, toCandidate,
  type ChatMessage, type FetchFn, type UsdaCandidate,
} from '../../supabase/functions/_shared/meal-agent'

// Shapes captured from the live FoodData Central API (2026-10-14).
const srLegacyEgg = {
  fdcId: 171287, description: 'Egg, whole, raw, fresh', dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientId: 1008, value: 143, unitName: 'KCAL' }, { nutrientId: 1003, value: 12.6, unitName: 'G' },
    { nutrientId: 1004, value: 9.51, unitName: 'G' }, { nutrientId: 1005, value: 0.72, unitName: 'G' }, { nutrientId: 1079, value: 0, unitName: 'G' },
  ],
  foodMeasures: [{ disseminationText: '1 large', gramWeight: 50 }, { disseminationText: 'Quantity not specified', gramWeight: 50 }],
}
const foundationChicken = {
  fdcId: 2646170, description: 'Chicken, breast, boneless, skinless, raw', dataType: 'Foundation',
  foodNutrients: [
    { nutrientId: 1004, value: 1.93, unitName: 'G' }, { nutrientId: 1003, value: 22.5, unitName: 'G' }, { nutrientId: 1005, value: 0, unitName: 'G' },
    { nutrientId: 2047, value: 106, unitName: 'KCAL' }, { nutrientId: 2048, value: 112, unitName: 'KCAL' },
  ],
}
const fnddsRice = {
  fdcId: 2710788, description: 'Rice, white, cooked, as ingredient', dataType: 'Survey (FNDDS)',
  foodNutrients: [
    { nutrientId: 1003, value: 2.54, unitName: 'G' }, { nutrientId: 1004, value: 0.37, unitName: 'G' },
    { nutrientId: 1005, value: 28.98, unitName: 'G' }, { nutrientId: 1008, value: 130, unitName: 'KCAL' }, { nutrientId: 1079, value: 0, unitName: 'G' },
  ],
  foodMeasures: [{ disseminationText: '1 cup, cooked', gramWeight: 174 }],
}

describe('USDA parsing', () => {
  it('reads reported kcal and macros per 100 g', () => {
    expect(extractPer100g(srLegacyEgg.foodNutrients)).toEqual({
      calories: 143, protein_g: 12.6, carbs_g: 0.72, fat_g: 9.51, fiber_g: 0, energy_source: 'reported',
    })
  })
  it('uses Atwater specific energy for Foundation foods that do not report nutrient 1008', () => {
    expect(extractPer100g(foundationChicken.foodNutrients)).toMatchObject({ calories: 112, energy_source: 'atwater_specific', fiber_g: null })
  })
  it('falls back to 4/4/9 only when no energy value exists, and labels it', () => {
    const p = extractPer100g([{ nutrientId: 1003, value: 10 }, { nutrientId: 1004, value: 5 }, { nutrientId: 1005, value: 20 }])
    expect(p).toMatchObject({ calories: 165, energy_source: 'computed_from_macros' })
  })
  it('ignores kJ energy readings and rejects foods missing a macro', () => {
    expect(extractPer100g([{ nutrientId: 1008, value: 600, unitName: 'kJ' }, { nutrientId: 1003, value: 1 }, { nutrientId: 1004, value: 1 }, { nutrientId: 1005, value: 1 }])?.energy_source)
      .toBe('computed_from_macros')
    expect(extractPer100g([{ nutrientId: 1003, value: 1 }])).toBeNull()
  })
  it('drops unhelpful portions', () => {
    expect(toCandidate(srLegacyEgg)?.portions).toEqual([{ label: '1 large', grams: 50 }])
  })
})

describe('searchUsda', () => {
  it('requests only per-100 g data types and parses candidates', async () => {
    let sent: { url: string; body: unknown } | null = null
    const fetchFn: FetchFn = async (url, init) => {
      sent = { url, body: JSON.parse(init?.body ?? '{}') }
      return { ok: true, status: 200, json: async () => ({ foods: [srLegacyEgg, { fdcId: 1, description: 'no nutrients', dataType: 'SR Legacy' }] }), text: async () => '' }
    }
    const result = await searchUsda('egg', 'KEY', fetchFn)
    expect(result.map((c) => c.fdc_id)).toEqual([171287])
    expect(sent!.url).toContain('api_key=KEY')
    expect(sent!.body).toMatchObject({ query: 'egg', dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] })
  })
  it('throws a readable error when USDA fails', async () => {
    const fetchFn: FetchFn = async () => ({ ok: false, status: 429, json: async () => ({}), text: async () => '' })
    await expect(searchUsda('egg', 'KEY', fetchFn)).rejects.toThrow('USDA FoodData Central request failed (429)')
  })
})

describe('buildEstimate', () => {
  const seen = new Map<number, UsdaCandidate>([[171287, toCandidate(srLegacyEgg)!]])
  it('computes nutrients from USDA values and ignores numbers written by the model', () => {
    const est = buildEstimate({ items: [{ label: '2 eggs', fdc_id: 171287, grams: 100, portion_basis: 'usda_portion', note: '2 x large', calories: 9999 }] }, seen)
    expect(est.items[0].nutrients).toEqual({ calories: 143, protein_g: 12.6, carbs_g: 0.72, fat_g: 9.51, fiber_g: 0 })
    expect(est.items[0]).not.toHaveProperty('calories')
  })
  it('rejects fdc_ids the tool never returned and impossible grams', () => {
    const est = buildEstimate({ items: [
      { label: 'invented', fdc_id: 424242, grams: 100 },
      { label: 'too much', fdc_id: 171287, grams: 50000 },
      { label: 'negative', fdc_id: 171287, grams: -1 },
    ], unmatched: ['mystery sauce'] }, seen)
    expect(est.items).toHaveLength(0)
    expect(est.unmatched).toEqual(['mystery sauce', 'invented', 'too much', 'negative'])
  })
  it('defaults unknown portion bases to estimate', () => {
    expect(buildEstimate({ items: [{ label: 'x', fdc_id: 171287, grams: 60, portion_basis: 'vibes' }] }, seen).items[0].portion_basis).toBe('estimate')
  })
})

describe('runMealAgent', () => {
  it('runs the tool loop and returns USDA-calculated items', async () => {
    const searches: string[] = []
    const search = async (q: string) => {
      searches.push(q)
      return [toCandidate(q.includes('egg') ? srLegacyEgg : fnddsRice)!]
    }
    const transcripts: ChatMessage[][] = []
    const replies = [
      { content: '', tool_calls: [
        { id: 'a', function: { name: 'search_usda_foods', arguments: '{"query":"egg whole raw"}' } },
        { id: 'b', function: { name: 'search_usda_foods', arguments: '{"query":"rice white cooked"}' } },
      ] },
      { content: '```json\n{"items":[{"label":"2 eggs","fdc_id":171287,"grams":100,"portion_basis":"usda_portion","note":"2 x large"},{"label":"a cup of rice","fdc_id":2710788,"grams":174,"portion_basis":"usda_portion","note":"1 cup, cooked"}],"unmatched":[]}\n```' },
    ]
    const chat = async (messages: ChatMessage[]) => {
      transcripts.push(structuredClone(messages))
      return replies.shift()!
    }
    const est = await runMealAgent('2 eggs and a cup of rice', chat, search)
    expect(searches).toEqual(['egg whole raw', 'rice white cooked'])
    expect(est.items.map((i) => [i.fdc_id, i.grams, i.nutrients.calories])).toEqual([[171287, 100, 143], [2710788, 174, 226.2]])
    // The model saw tool results with matching tool_call_ids, and our instructions came first.
    const second = transcripts[1]
    expect(second[0].role).toBe('system')
    expect(second.filter((m) => m.role === 'tool').map((m) => m.tool_call_id)).toEqual(['a', 'b'])
  })

  it('stops after too many steps instead of looping forever', async () => {
    const chat = async () => ({ content: '', tool_calls: [{ id: 'x', function: { name: 'search_usda_foods', arguments: '{"query":"egg"}' } }] })
    await expect(runMealAgent('egg', chat, async () => [], 3)).rejects.toThrow('did not finish')
  })

  it('reports unreadable output', async () => {
    await expect(runMealAgent('egg', async () => ({ content: 'Sure! Eggs are healthy.' }), async () => [])).rejects.toThrow('unreadable')
  })
})
