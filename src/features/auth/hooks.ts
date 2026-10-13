import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { todayInZone } from '@/lib/dates'
import type { Profile, TablesUpdate } from '@/types/database'
import { useAuth, useUserId } from './AuthProvider'
import { fetchProfile, updateProfile } from './api'

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.profile(user?.id ?? 'anonymous'),
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

/** Profile for screens that only render after RequireOnboarded has loaded it. */
export function useLoadedProfile(): Profile {
  const { data } = useProfile()
  if (!data) throw new Error('Profile not loaded; render inside RequireOnboarded')
  return data
}

/** Today's date in the user's profile time zone. */
export function useToday(): string {
  const profile = useLoadedProfile()
  return todayInZone(profile.time_zone)
}

export function useUpdateProfile() {
  const userId = useUserId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: TablesUpdate<'profiles'>) => updateProfile(userId, patch),
    onSuccess: (profile) => qc.setQueryData(queryKeys.profile(userId), profile),
  })
}
