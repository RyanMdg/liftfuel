import type { Equipment, ExerciseCategory, Mechanic, MovementPattern } from '@/types/database'

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell', smith_machine: 'Smith machine', ez_bar: 'EZ bar', trap_bar: 'Trap bar', band: 'Band', other: 'Other',
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  legs: 'Legs', chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms', core: 'Core', full_body: 'Full body',
}

export const MOVEMENT_LABELS: Record<MovementPattern, string> = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge', horizontal_push: 'Horizontal push', vertical_push: 'Vertical push',
  horizontal_pull: 'Horizontal pull', vertical_pull: 'Vertical pull', fly: 'Fly', raise: 'Raise', curl: 'Curl',
  extension: 'Extension', calf_raise: 'Calf raise', core: 'Core', carry: 'Carry', other: 'Other',
}

export const MECHANIC_LABELS: Record<Mechanic, string> = { compound: 'Compound', isolation: 'Isolation' }
