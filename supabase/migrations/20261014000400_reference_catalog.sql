-- Shared reference catalog: exercise library and generic foods (owner_id is null).
-- This is reference data, not user data: nothing is written to any user's diary or log.
--
-- Food values are approximations typical of USDA FoodData Central generic entries,
-- entered from general reference knowledge and NOT verified line by line against FDC.
-- They are therefore labelled provenance = 'estimated'. Users should prefer their
-- package label (create a custom food with provenance 'nutrition_label').

-- ---------------------------------------------------------------------------
-- Exercises
-- ---------------------------------------------------------------------------

insert into public.exercises
  (owner_id, name, equipment, category, movement_pattern, mechanic, primary_muscles, powerlifting_lift)
values
  -- Squat pattern
  (null, 'Barbell Back Squat', 'barbell', 'legs', 'squat', 'compound', '{quadriceps,glutes,adductors}', 'squat'),
  (null, 'Barbell Front Squat', 'barbell', 'legs', 'squat', 'compound', '{quadriceps,glutes,upper back}', null),
  (null, 'Pause Squat', 'barbell', 'legs', 'squat', 'compound', '{quadriceps,glutes,adductors}', null),
  (null, 'Box Squat', 'barbell', 'legs', 'squat', 'compound', '{quadriceps,glutes,hamstrings}', null),
  (null, 'Safety Bar Squat', 'barbell', 'legs', 'squat', 'compound', '{quadriceps,glutes,upper back}', null),
  (null, 'Goblet Squat', 'dumbbell', 'legs', 'squat', 'compound', '{quadriceps,glutes}', null),
  (null, 'Hack Squat', 'machine', 'legs', 'squat', 'compound', '{quadriceps,glutes}', null),
  (null, 'Smith Machine Squat', 'smith_machine', 'legs', 'squat', 'compound', '{quadriceps,glutes}', null),
  (null, 'Belt Squat', 'machine', 'legs', 'squat', 'compound', '{quadriceps,glutes}', null),
  (null, 'Leg Press', 'machine', 'legs', 'squat', 'compound', '{quadriceps,glutes}', null),
  (null, 'Bulgarian Split Squat', 'dumbbell', 'legs', 'lunge', 'compound', '{quadriceps,glutes}', null),
  (null, 'Walking Lunge', 'dumbbell', 'legs', 'lunge', 'compound', '{quadriceps,glutes}', null),
  -- Bench and horizontal push
  (null, 'Barbell Bench Press', 'barbell', 'chest', 'horizontal_push', 'compound', '{chest,triceps,front delts}', 'bench'),
  (null, 'Close-Grip Bench Press', 'barbell', 'chest', 'horizontal_push', 'compound', '{triceps,chest}', null),
  (null, 'Pause Bench Press', 'barbell', 'chest', 'horizontal_push', 'compound', '{chest,triceps,front delts}', null),
  (null, 'Incline Barbell Bench Press', 'barbell', 'chest', 'horizontal_push', 'compound', '{upper chest,front delts,triceps}', null),
  (null, 'Dumbbell Bench Press', 'dumbbell', 'chest', 'horizontal_push', 'compound', '{chest,triceps,front delts}', null),
  (null, 'Incline Dumbbell Press', 'dumbbell', 'chest', 'horizontal_push', 'compound', '{upper chest,front delts}', null),
  (null, 'Machine Chest Press', 'machine', 'chest', 'horizontal_push', 'compound', '{chest,triceps}', null),
  (null, 'Push-Up', 'bodyweight', 'chest', 'horizontal_push', 'compound', '{chest,triceps}', null),
  (null, 'Dip', 'bodyweight', 'chest', 'vertical_push', 'compound', '{chest,triceps}', null),
  -- Deadlift and hinge
  (null, 'Conventional Deadlift', 'barbell', 'back', 'hinge', 'compound', '{glutes,hamstrings,spinal erectors}', 'deadlift'),
  (null, 'Sumo Deadlift', 'barbell', 'legs', 'hinge', 'compound', '{glutes,adductors,quadriceps}', 'deadlift'),
  (null, 'Romanian Deadlift', 'barbell', 'legs', 'hinge', 'compound', '{hamstrings,glutes}', null),
  (null, 'Deficit Deadlift', 'barbell', 'back', 'hinge', 'compound', '{glutes,hamstrings,spinal erectors}', null),
  (null, 'Trap Bar Deadlift', 'trap_bar', 'legs', 'hinge', 'compound', '{quadriceps,glutes,hamstrings}', null),
  (null, 'Barbell Hip Thrust', 'barbell', 'legs', 'hinge', 'compound', '{glutes}', null),
  (null, 'Good Morning', 'barbell', 'legs', 'hinge', 'compound', '{hamstrings,spinal erectors}', null),
  (null, 'Back Extension', 'bodyweight', 'back', 'hinge', 'compound', '{spinal erectors,glutes}', null),
  -- Overhead press
  (null, 'Overhead Press', 'barbell', 'shoulders', 'vertical_push', 'compound', '{front delts,triceps}', null),
  (null, 'Push Press', 'barbell', 'shoulders', 'vertical_push', 'compound', '{front delts,triceps}', null),
  (null, 'Seated Dumbbell Shoulder Press', 'dumbbell', 'shoulders', 'vertical_push', 'compound', '{front delts,triceps}', null),
  (null, 'Machine Shoulder Press', 'machine', 'shoulders', 'vertical_push', 'compound', '{front delts,triceps}', null),
  -- Rows
  (null, 'Barbell Row', 'barbell', 'back', 'horizontal_pull', 'compound', '{lats,upper back}', null),
  (null, 'Pendlay Row', 'barbell', 'back', 'horizontal_pull', 'compound', '{upper back,lats}', null),
  (null, 'One-Arm Dumbbell Row', 'dumbbell', 'back', 'horizontal_pull', 'compound', '{lats,upper back}', null),
  (null, 'Seated Cable Row', 'cable', 'back', 'horizontal_pull', 'compound', '{upper back,lats}', null),
  (null, 'Chest-Supported Machine Row', 'machine', 'back', 'horizontal_pull', 'compound', '{upper back,lats}', null),
  (null, 'T-Bar Row', 'barbell', 'back', 'horizontal_pull', 'compound', '{upper back,lats}', null),
  -- Vertical pull
  (null, 'Pull-Up', 'bodyweight', 'back', 'vertical_pull', 'compound', '{lats,biceps}', null),
  (null, 'Chin-Up', 'bodyweight', 'back', 'vertical_pull', 'compound', '{lats,biceps}', null),
  (null, 'Assisted Pull-Up', 'machine', 'back', 'vertical_pull', 'compound', '{lats,biceps}', null),
  (null, 'Lat Pulldown', 'cable', 'back', 'vertical_pull', 'compound', '{lats,biceps}', null),
  (null, 'Close-Grip Lat Pulldown', 'cable', 'back', 'vertical_pull', 'compound', '{lats,biceps}', null),
  -- Chest fly
  (null, 'Cable Fly', 'cable', 'chest', 'fly', 'isolation', '{chest}', null),
  (null, 'Dumbbell Fly', 'dumbbell', 'chest', 'fly', 'isolation', '{chest}', null),
  (null, 'Pec Deck', 'machine', 'chest', 'fly', 'isolation', '{chest}', null),
  -- Lateral raises
  (null, 'Dumbbell Lateral Raise', 'dumbbell', 'shoulders', 'raise', 'isolation', '{side delts}', null),
  (null, 'Cable Lateral Raise', 'cable', 'shoulders', 'raise', 'isolation', '{side delts}', null),
  (null, 'Machine Lateral Raise', 'machine', 'shoulders', 'raise', 'isolation', '{side delts}', null),
  -- Rear delts
  (null, 'Reverse Pec Deck', 'machine', 'shoulders', 'fly', 'isolation', '{rear delts}', null),
  (null, 'Face Pull', 'cable', 'shoulders', 'horizontal_pull', 'isolation', '{rear delts,upper back}', null),
  (null, 'Bent-Over Rear Delt Fly', 'dumbbell', 'shoulders', 'fly', 'isolation', '{rear delts}', null),
  -- Biceps
  (null, 'Barbell Curl', 'barbell', 'arms', 'curl', 'isolation', '{biceps}', null),
  (null, 'EZ-Bar Curl', 'ez_bar', 'arms', 'curl', 'isolation', '{biceps}', null),
  (null, 'Dumbbell Curl', 'dumbbell', 'arms', 'curl', 'isolation', '{biceps}', null),
  (null, 'Hammer Curl', 'dumbbell', 'arms', 'curl', 'isolation', '{brachialis,biceps}', null),
  (null, 'Incline Dumbbell Curl', 'dumbbell', 'arms', 'curl', 'isolation', '{biceps}', null),
  (null, 'Cable Curl', 'cable', 'arms', 'curl', 'isolation', '{biceps}', null),
  (null, 'Preacher Curl', 'ez_bar', 'arms', 'curl', 'isolation', '{biceps}', null),
  -- Triceps
  (null, 'Triceps Pushdown', 'cable', 'arms', 'extension', 'isolation', '{triceps}', null),
  (null, 'Overhead Cable Triceps Extension', 'cable', 'arms', 'extension', 'isolation', '{triceps}', null),
  (null, 'Skull Crusher', 'ez_bar', 'arms', 'extension', 'isolation', '{triceps}', null),
  (null, 'Dumbbell Overhead Triceps Extension', 'dumbbell', 'arms', 'extension', 'isolation', '{triceps}', null),
  -- Leg machines
  (null, 'Leg Extension', 'machine', 'legs', 'extension', 'isolation', '{quadriceps}', null),
  (null, 'Lying Leg Curl', 'machine', 'legs', 'curl', 'isolation', '{hamstrings}', null),
  (null, 'Seated Leg Curl', 'machine', 'legs', 'curl', 'isolation', '{hamstrings}', null),
  (null, 'Hip Adduction Machine', 'machine', 'legs', 'other', 'isolation', '{adductors}', null),
  (null, 'Hip Abduction Machine', 'machine', 'legs', 'other', 'isolation', '{glutes}', null),
  -- Calves
  (null, 'Standing Calf Raise', 'machine', 'legs', 'calf_raise', 'isolation', '{calves}', null),
  (null, 'Seated Calf Raise', 'machine', 'legs', 'calf_raise', 'isolation', '{calves}', null),
  (null, 'Leg Press Calf Raise', 'machine', 'legs', 'calf_raise', 'isolation', '{calves}', null),
  -- Core
  (null, 'Hanging Leg Raise', 'bodyweight', 'core', 'core', 'isolation', '{abdominals,hip flexors}', null),
  (null, 'Cable Crunch', 'cable', 'core', 'core', 'isolation', '{abdominals}', null),
  (null, 'Ab Wheel Rollout', 'other', 'core', 'core', 'compound', '{abdominals}', null),
  (null, 'Pallof Press', 'cable', 'core', 'core', 'isolation', '{obliques,abdominals}', null),
  -- Upper back
  (null, 'Dumbbell Shrug', 'dumbbell', 'back', 'other', 'isolation', '{upper traps}', null);

-- ---------------------------------------------------------------------------
-- Foods (per reference_amount of base_unit; most are per 100 g)
-- ---------------------------------------------------------------------------

with catalog (name, base_unit, reference_amount, calories, protein_g, carbs_g, fat_g, fiber_g, preparation) as (
  values
    ('Chicken breast, skinless', 'g', 100, 120, 22.5, 0, 2.6, 0, 'raw'),
    ('Chicken breast, skinless, roasted', 'g', 100, 165, 31.0, 0, 3.6, 0, 'cooked'),
    ('Chicken thigh, skinless', 'g', 100, 121, 19.7, 0, 4.1, 0, 'raw'),
    ('Beef, ground, 90% lean', 'g', 100, 176, 20.0, 0, 10.0, 0, 'raw'),
    ('Salmon, Atlantic, farmed', 'g', 100, 208, 20.4, 0, 13.4, 0, 'raw'),
    ('Tuna, canned in water, drained', 'g', 100, 116, 25.5, 0, 0.8, 0, 'not_applicable'),
    ('Egg, whole', 'g', 100, 143, 12.6, 0.7, 9.5, 0, 'raw'),
    ('Egg white', 'g', 100, 52, 10.9, 0.7, 0.2, 0, 'raw'),
    ('Greek yogurt, plain, nonfat', 'g', 100, 59, 10.2, 3.6, 0.4, 0, 'not_applicable'),
    ('Cottage cheese, 2% fat', 'g', 100, 81, 10.5, 4.8, 2.3, 0, 'not_applicable'),
    ('Milk, whole', 'ml', 100, 62, 3.3, 4.9, 3.3, 0, 'not_applicable'),
    ('Milk, skim', 'ml', 100, 35, 3.4, 5.0, 0.1, 0, 'not_applicable'),
    ('Cheddar cheese', 'g', 100, 403, 24.9, 1.3, 33.1, 0, 'not_applicable'),
    ('Whey protein powder, generic', 'g', 100, 400, 80.0, 8.0, 6.0, null, 'not_applicable'),
    ('Tofu, firm', 'g', 100, 144, 17.3, 2.8, 8.7, 2.3, 'raw'),
    ('Oats, rolled', 'g', 100, 379, 13.2, 67.7, 6.5, 10.1, 'raw'),
    ('White rice', 'g', 100, 365, 7.1, 80.0, 0.7, 1.3, 'raw'),
    ('White rice, cooked', 'g', 100, 130, 2.7, 28.2, 0.3, 0.4, 'cooked'),
    ('Brown rice, cooked', 'g', 100, 123, 2.7, 25.6, 1.0, 1.6, 'cooked'),
    ('Pasta, dry', 'g', 100, 371, 13.0, 74.7, 1.5, 3.2, 'raw'),
    ('Pasta, cooked', 'g', 100, 158, 5.8, 30.9, 0.9, 1.8, 'cooked'),
    ('Potato, with skin', 'g', 100, 77, 2.0, 17.5, 0.1, 2.1, 'raw'),
    ('Sweet potato', 'g', 100, 86, 1.6, 20.1, 0.1, 3.0, 'raw'),
    ('Whole wheat bread', 'g', 100, 252, 12.4, 42.7, 3.5, 6.0, 'not_applicable'),
    ('Lentils, cooked', 'g', 100, 116, 9.0, 20.1, 0.4, 7.9, 'cooked'),
    ('Black beans, cooked', 'g', 100, 132, 8.9, 23.7, 0.5, 8.7, 'cooked'),
    ('Banana', 'g', 100, 89, 1.1, 22.8, 0.3, 2.6, 'raw'),
    ('Apple, with skin', 'g', 100, 52, 0.3, 13.8, 0.2, 2.4, 'raw'),
    ('Blueberries', 'g', 100, 57, 0.7, 14.5, 0.3, 2.4, 'raw'),
    ('Orange juice', 'ml', 100, 45, 0.7, 10.4, 0.2, 0.2, 'not_applicable'),
    ('Broccoli', 'g', 100, 34, 2.8, 6.6, 0.4, 2.6, 'raw'),
    ('Spinach', 'g', 100, 23, 2.9, 3.6, 0.4, 2.2, 'raw'),
    ('Avocado', 'g', 100, 160, 2.0, 8.5, 14.7, 6.7, 'raw'),
    ('Olive oil', 'g', 100, 884, 0, 0, 100, 0, 'not_applicable'),
    ('Butter, salted', 'g', 100, 717, 0.9, 0.1, 81.1, 0, 'not_applicable'),
    ('Peanut butter, smooth', 'g', 100, 588, 25.1, 20.0, 50.4, 6.0, 'not_applicable'),
    ('Almonds', 'g', 100, 579, 21.2, 21.6, 49.9, 12.5, 'raw'),
    ('Honey', 'g', 100, 304, 0.3, 82.4, 0, 0.2, 'not_applicable')
)
insert into public.foods
  (owner_id, name, base_unit, reference_amount, calories, protein_g, carbs_g, fat_g, fiber_g,
   preparation, provenance, provenance_note)
select null, c.name, c.base_unit, c.reference_amount, c.calories, c.protein_g, c.carbs_g, c.fat_g,
  c.fiber_g, c.preparation, 'estimated',
  case when c.name = 'Whey protein powder, generic'
    then 'Generic approximation; protein powders vary widely by brand. Use your product label.'
    else 'Approximate generic values; verify against your package label where available.' end
from catalog c;

with servings (food_name, label, amount, position) as (
  values
    ('Egg, whole', '1 large egg', 50, 0),
    ('Egg white', '1 large egg white', 33, 0),
    ('Greek yogurt, plain, nonfat', '1 pot (170 g)', 170, 0),
    ('Cottage cheese, 2% fat', '1/2 cup', 113, 0),
    ('Milk, whole', '1 cup (240 ml)', 240, 0),
    ('Milk, skim', '1 cup (240 ml)', 240, 0),
    ('Cheddar cheese', '1 slice', 28, 0),
    ('Whey protein powder, generic', '1 scoop', 30, 0),
    ('Oats, rolled', '1/2 cup', 40, 0),
    ('White rice, cooked', '1 cup', 158, 0),
    ('Brown rice, cooked', '1 cup', 195, 0),
    ('Pasta, dry', '1 portion (75 g)', 75, 0),
    ('Whole wheat bread', '1 slice', 32, 0),
    ('Banana', '1 medium', 118, 0),
    ('Apple, with skin', '1 medium', 182, 0),
    ('Orange juice', '1 cup (240 ml)', 240, 0),
    ('Avocado', '1/2 avocado', 100, 0),
    ('Olive oil', '1 tbsp', 13.5, 0),
    ('Butter, salted', '1 tbsp', 14, 0),
    ('Peanut butter, smooth', '1 tbsp', 16, 0),
    ('Almonds', '1 oz', 28, 0),
    ('Honey', '1 tbsp', 21, 0)
)
insert into public.food_servings (food_id, label, amount, position)
select f.id, s.label, s.amount, s.position
from servings s
join public.foods f on f.name = s.food_name and f.owner_id is null;
