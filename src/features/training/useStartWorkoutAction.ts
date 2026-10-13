import { useNavigate } from 'react-router'
import { useToast } from '@/components/ui/Toast'
import { useToday } from '@/features/auth/hooks'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { useStartWorkout } from './hooks'

/**
 * Starts a workout and opens it. If one is already in progress, the database returns
 * that session instead of creating a duplicate, and the user is taken to it.
 */
export function useStartWorkoutAction() {
  const today = useToday()
  const navigate = useNavigate()
  const toast = useToast()
  const start = useStartWorkout()
  const run = useSingleFlight(async (templateId: string | null, name?: string) => {
    try {
      const result = await start.mutateAsync({ date: today, templateId, name })
      if (!result.created) toast.info('You already have a workout in progress. Opening it.')
      navigate(`/training/workouts/${result.session_id}`)
    } catch (error) {
      toast.error(error, 'Could not start the workout.')
    }
  })
  return { run, pending: start.isPending, pendingTemplateId: start.isPending ? (start.variables?.templateId ?? 'empty') : null }
}
