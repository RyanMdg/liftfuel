import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { fetchAllPages } from '@/lib/paginate'
import type { WeightEntry } from '@/types/database'

export async function fetchWeights(): Promise<WeightEntry[]> {
  return fetchAllPages((from, to) =>
    supabase().from('weight_entries').select('*').order('entry_date').range(from, to),
  )
}

export interface WeightInput {
  entry_date: string
  weight_kg: number
  note: string | null
}

/** One weigh-in per day: logging again on the same date replaces that day's value. */
export async function saveWeight(userId: string, input: WeightInput): Promise<WeightEntry> {
  return unwrap(
    await supabase().from('weight_entries').upsert({ user_id: userId, ...input }, { onConflict: 'user_id,entry_date' }).select('*').single(),
  )
}

export async function updateWeight(id: string, input: WeightInput): Promise<WeightEntry> {
  return unwrap(await supabase().from('weight_entries').update(input).eq('id', id).select('*').single())
}

export async function deleteWeight(id: string): Promise<void> {
  unwrap(await supabase().from('weight_entries').delete().eq('id', id))
}
