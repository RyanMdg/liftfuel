import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'
import { fetchAllPages } from '@/lib/paginate'
import type {
  CompletedSet, Exercise, ExerciseRecord, PreviousSet, TablesInsert, TablesUpdate, TemplateExercise, WorkoutExercise,
  WorkoutSession, WorkoutSet, WorkoutTemplate,
} from '@/types/database'

export type TemplateWithExercises = WorkoutTemplate & {
  template_exercises: Array<TemplateExercise & { exercise: Exercise }>
}
export type SessionExercise = WorkoutExercise & { exercise: Exercise; workout_sets: WorkoutSet[] }
export type SessionDetail = WorkoutSession & { workout_exercises: SessionExercise[] }
export type SessionSummary = WorkoutSession & {
  workout_exercises: Array<{ id: string; workout_sets: Array<Pick<WorkoutSet, 'load_kg' | 'reps' | 'set_type' | 'completed_at'>> }>
}

// ---------------------------------------------------------------- exercises

export async function fetchExercises(): Promise<Exercise[]> {
  return unwrap(await supabase().from('exercises').select('*').order('name'))
}

export async function createExercise(input: TablesInsert<'exercises'>): Promise<Exercise> {
  return unwrap(await supabase().from('exercises').insert(input).select('*').single())
}

// ---------------------------------------------------------------- templates

function sortTemplate(t: TemplateWithExercises): TemplateWithExercises {
  return { ...t, template_exercises: [...t.template_exercises].sort((a, b) => a.position - b.position) }
}

export async function fetchTemplates(): Promise<TemplateWithExercises[]> {
  const rows = unwrap(
    await supabase()
      .from('workout_templates')
      .select('*, template_exercises(*, exercise:exercises(*))')
      .order('name')
      .overrideTypes<TemplateWithExercises[], { merge: false }>(),
  )
  return rows.map(sortTemplate)
}

export async function createTemplate(name: string): Promise<WorkoutTemplate> {
  return unwrap(await supabase().from('workout_templates').insert({ name }).select('*').single())
}

export async function updateTemplate(id: string, patch: TablesUpdate<'workout_templates'>): Promise<void> {
  unwrap(await supabase().from('workout_templates').update(patch).eq('id', id))
}

export async function deleteTemplate(id: string): Promise<void> {
  unwrap(await supabase().from('workout_templates').delete().eq('id', id))
}

export async function addTemplateExercise(templateId: string, exerciseId: string): Promise<string> {
  return unwrap(await supabase().rpc('add_template_exercise', { p_template_id: templateId, p_exercise_id: exerciseId }))
}

export async function updateTemplateExercise(id: string, patch: TablesUpdate<'template_exercises'>): Promise<void> {
  unwrap(await supabase().from('template_exercises').update(patch).eq('id', id))
}

export async function removeTemplateExercise(id: string): Promise<void> {
  unwrap(await supabase().from('template_exercises').delete().eq('id', id))
}

export async function reorderTemplateExercises(templateId: string, orderedIds: string[]): Promise<void> {
  unwrap(await supabase().rpc('reorder_template_exercises', { p_template_id: templateId, p_ordered_ids: orderedIds }))
}

// ---------------------------------------------------------------- sessions

export async function startWorkout(date: string, templateId: string | null, name?: string): Promise<{ session_id: string; created: boolean }> {
  const rows = unwrap(await supabase().rpc('start_workout', { p_session_date: date, p_template_id: templateId, p_name: name ?? null }))
  return rows[0]
}

export async function fetchActiveSession(): Promise<WorkoutSession | null> {
  return unwrap(await supabase().from('workout_sessions').select('*').eq('status', 'in_progress').maybeSingle()) ?? null
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const s = unwrap(
    await supabase()
      .from('workout_sessions')
      .select('*, workout_exercises(*, exercise:exercises(*), workout_sets(*))')
      .eq('id', id)
      .single()
      .overrideTypes<SessionDetail, { merge: false }>(),
  )
  return {
    ...s,
    workout_exercises: [...s.workout_exercises]
      .sort((a, b) => a.position - b.position)
      .map((we) => ({ ...we, workout_sets: [...we.workout_sets].sort((a, b) => a.set_number - b.set_number) })),
  }
}

const SUMMARY_SELECT = '*, workout_exercises(id, workout_sets(load_kg, reps, set_type, completed_at))'

export async function fetchHistory(limit: number): Promise<SessionSummary[]> {
  return unwrap(
    await supabase()
      .from('workout_sessions')
      .select(SUMMARY_SELECT)
      .eq('status', 'completed')
      .order('session_date', { ascending: false })
      .order('started_at', { ascending: false })
      .limit(limit)
      .overrideTypes<SessionSummary[], { merge: false }>(),
  )
}

export async function fetchSessionsOnDate(date: string): Promise<SessionSummary[]> {
  return unwrap(
    await supabase()
      .from('workout_sessions')
      .select(SUMMARY_SELECT)
      .eq('session_date', date)
      .order('started_at')
      .overrideTypes<SessionSummary[], { merge: false }>(),
  )
}

export async function updateSession(id: string, patch: TablesUpdate<'workout_sessions'>): Promise<void> {
  unwrap(await supabase().from('workout_sessions').update(patch).eq('id', id))
}

export async function deleteSession(id: string): Promise<void> {
  unwrap(await supabase().from('workout_sessions').delete().eq('id', id))
}

export async function finishWorkout(id: string): Promise<void> {
  unwrap(await supabase().rpc('finish_workout', { p_session_id: id, p_discard_incomplete: true }))
}

export async function addWorkoutExercise(sessionId: string, exerciseId: string, sets = 3): Promise<string> {
  return unwrap(await supabase().rpc('add_workout_exercise', { p_session_id: sessionId, p_exercise_id: exerciseId, p_sets: sets }))
}

export async function removeWorkoutExercise(id: string): Promise<void> {
  unwrap(await supabase().from('workout_exercises').delete().eq('id', id))
}

export async function updateWorkoutExercise(id: string, patch: TablesUpdate<'workout_exercises'>): Promise<void> {
  unwrap(await supabase().from('workout_exercises').update(patch).eq('id', id))
}

export async function addSet(workoutExerciseId: string): Promise<string> {
  return unwrap(await supabase().rpc('add_workout_set', { p_workout_exercise_id: workoutExerciseId }))
}

export async function updateSet(id: string, patch: TablesUpdate<'workout_sets'>): Promise<WorkoutSet> {
  return unwrap(await supabase().from('workout_sets').update(patch).eq('id', id).select('*').single())
}

export async function deleteSet(id: string): Promise<void> {
  unwrap(await supabase().from('workout_sets').delete().eq('id', id))
}

export async function fetchPrevious(sessionId: string): Promise<PreviousSet[]> {
  return unwrap(await supabase().rpc('get_previous_performance', { p_session_id: sessionId }))
}

// ---------------------------------------------------------------- analytics

export async function fetchCompletedSets(fromDate: string): Promise<CompletedSet[]> {
  return fetchAllPages((from, to) =>
    supabase().from('completed_sets').select('*').gte('session_date', fromDate).order('completed_at').order('set_id').range(from, to),
  )
}

export async function fetchExerciseRecords(): Promise<ExerciseRecord[]> {
  return fetchAllPages((from, to) =>
    supabase().from('exercise_records').select('*').order('exercise_name').order('exercise_id').range(from, to),
  )
}
