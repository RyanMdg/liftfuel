-- LiftFuel core schema
-- Canonical units: body weight and training load in kilograms; food quantities in the
-- food's base unit (g or ml). Nutrition values use numeric, never float.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Trims and collapses internal whitespace so "Bench  press " and "Bench press" match.
create or replace function public.normalize_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64),
  goal text check (goal in ('lose', 'maintain', 'gain')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  begin
    perform now() at time zone new.time_zone;
  exception when others then
    raise exception 'Unknown time zone: %', new.time_zone using errcode = '22023';
  end;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function public.validate_profile();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile row. Runs as definer because the auth schema
-- insert happens outside the user's own permissions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Nutrition goals (versioned by effective date; history is never rewritten)
-- ---------------------------------------------------------------------------

create table public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_date date not null,
  calories numeric(7, 1) not null check (calories between 0 and 20000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 2000),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 3000),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, effective_date)
);

create trigger nutrition_goals_updated_at before update on public.nutrition_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recipes (declared before foods because a recipe owns a derived food row)
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  notes text check (char_length(notes) <= 2000),
  servings numeric(6, 2) check (servings > 0 and servings <= 1000),
  cooked_yield_g numeric(8, 1) check (cooked_yield_g > 0 and cooked_yield_g <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner_idx on public.recipes (owner_id);
create trigger recipes_normalize before insert or update of name on public.recipes
  for each row execute function public.normalize_name();
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Foods
-- owner_id null = shared reference catalog (read-only to users).
-- Nutrients are per reference_amount of base_unit; NOT assumed to be per 100 g.
-- ---------------------------------------------------------------------------

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid unique references public.recipes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  brand text check (char_length(brand) <= 80),
  base_unit text not null default 'g' check (base_unit in ('g', 'ml')),
  reference_amount numeric(9, 2) not null default 100 check (reference_amount > 0 and reference_amount <= 100000),
  calories numeric(8, 2) not null check (calories >= 0 and calories <= 100000),
  protein_g numeric(8, 2) not null check (protein_g >= 0),
  carbs_g numeric(8, 2) not null check (carbs_g >= 0),
  fat_g numeric(8, 2) not null check (fat_g >= 0),
  fiber_g numeric(8, 2) check (fiber_g >= 0),
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  preparation text not null default 'not_applicable'
    check (preparation in ('raw', 'cooked', 'not_applicable')),
  provenance text not null default 'user_entered'
    check (provenance in ('user_entered', 'nutrition_label', 'reference_database', 'estimated', 'recipe_calculated')),
  provenance_note text check (char_length(provenance_note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Macronutrient mass cannot exceed the mass of the reference amount (2% rounding tolerance).
  constraint foods_macro_mass check (
    base_unit <> 'g' or protein_g + carbs_g + fat_g <= reference_amount * 1.02
  ),
  constraint foods_fiber_within_carbs check (fiber_g is null or fiber_g <= carbs_g + 0.5),
  constraint foods_recipe_owned check (recipe_id is null or owner_id is not null)
);

create index foods_owner_idx on public.foods (owner_id);
create index foods_name_lower_idx on public.foods (lower(name) text_pattern_ops);
create trigger foods_normalize before insert or update of name on public.foods
  for each row execute function public.normalize_name();
create trigger foods_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

create table public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  amount numeric(9, 2) not null check (amount > 0 and amount <= 100000),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (food_id, label)
);

create index food_servings_food_idx on public.food_servings (food_id);

create table public.favorite_foods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create index favorite_foods_food_idx on public.favorite_foods (food_id);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  quantity numeric(9, 2) not null check (quantity > 0 and quantity <= 100000),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_food_idx on public.recipe_ingredients (food_id);

-- ---------------------------------------------------------------------------
-- Food diary entries
-- Snapshot columns freeze the food's nutrition at log time so historical totals stay
-- stable when the source food changes. Consumed values are computed by trigger.
-- ---------------------------------------------------------------------------

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_id uuid references public.foods (id) on delete set null,
  duplicated_from_id uuid references public.food_entries (id) on delete set null,
  quantity numeric(9, 2) not null check (quantity > 0 and quantity <= 100000),
  serving_id uuid references public.food_servings (id) on delete set null,
  serving_label text,
  serving_amount numeric(9, 2),
  serving_count numeric(7, 2) check (serving_count > 0 and serving_count <= 1000),
  -- snapshot
  food_name text not null,
  food_brand text,
  base_unit text not null check (base_unit in ('g', 'ml')),
  snapshot_reference_amount numeric(9, 2) not null check (snapshot_reference_amount > 0),
  snapshot_calories numeric(8, 2) not null,
  snapshot_protein_g numeric(8, 2) not null,
  snapshot_carbs_g numeric(8, 2) not null,
  snapshot_fat_g numeric(8, 2) not null,
  snapshot_fiber_g numeric(8, 2),
  snapshot_provenance text not null,
  -- computed (authoritative)
  calories numeric(9, 2) not null,
  protein_g numeric(9, 2) not null,
  carbs_g numeric(9, 2) not null,
  fat_g numeric(9, 2) not null,
  fiber_g numeric(9, 2),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_entries_serving_consistent check (
    (serving_count is null and serving_amount is null and serving_label is null)
    or (serving_count is not null and serving_amount is not null and serving_label is not null)
  )
);

create index food_entries_user_date_idx on public.food_entries (user_id, entry_date);
create index food_entries_user_logged_idx on public.food_entries (user_id, logged_at desc);
create index food_entries_food_idx on public.food_entries (food_id);
create index food_entries_serving_idx on public.food_entries (serving_id);
create index food_entries_duplicated_from_idx on public.food_entries (duplicated_from_id);

-- ---------------------------------------------------------------------------
-- Body weight
-- ---------------------------------------------------------------------------

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  weight_kg numeric(6, 2) not null check (weight_kg between 20 and 400),
  note text check (char_length(note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create trigger weight_entries_updated_at before update on public.weight_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Exercises
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  equipment text not null check (equipment in (
    'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell',
    'smith_machine', 'ez_bar', 'trap_bar', 'band', 'other')),
  category text not null check (category in (
    'legs', 'chest', 'back', 'shoulders', 'arms', 'core', 'full_body')),
  movement_pattern text not null check (movement_pattern in (
    'squat', 'hinge', 'lunge', 'horizontal_push', 'vertical_push', 'horizontal_pull',
    'vertical_pull', 'fly', 'raise', 'curl', 'extension', 'calf_raise', 'core', 'carry', 'other')),
  mechanic text not null check (mechanic in ('compound', 'isolation')),
  primary_muscles text[] not null default '{}',
  powerlifting_lift text check (powerlifting_lift in ('squat', 'bench', 'deadlift')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Only the shared catalog decides which movements count toward a powerlifting total.
  constraint exercises_pl_lift_catalog_only check (powerlifting_lift is null or owner_id is null)
);

create unique index exercises_catalog_name_key on public.exercises (lower(name)) where owner_id is null;
create unique index exercises_owner_name_key on public.exercises (owner_id, lower(name)) where owner_id is not null;
create index exercises_owner_idx on public.exercises (owner_id);

create or replace function public.validate_exercise_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is not null and exists (
    select 1 from public.exercises e
    where e.owner_id is null and lower(e.name) = lower(new.name)
  ) then
    raise exception 'An exercise named "%" already exists in the library', new.name
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger exercises_normalize before insert or update of name on public.exercises
  for each row execute function public.normalize_name();
-- Runs after normalize_name (triggers fire in name order: exercises_n... < exercises_v...).
create trigger exercises_validate before insert or update of name on public.exercises
  for each row execute function public.validate_exercise_name();
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workout templates
-- ---------------------------------------------------------------------------

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_templates_user_idx on public.workout_templates (user_id);
create trigger workout_templates_normalize before insert or update of name on public.workout_templates
  for each row execute function public.normalize_name();
create trigger workout_templates_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  planned_sets smallint not null default 3 check (planned_sets between 1 and 20),
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  target_rpe numeric(3, 1) check (target_rpe between 5 and 10 and target_rpe * 2 = floor(target_rpe * 2)),
  rest_seconds integer check (rest_seconds between 0 and 1800),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint template_exercises_rep_range check (rep_min is null or rep_max is null or rep_max >= rep_min),
  constraint template_exercises_position_key unique (template_id, position) deferrable initially immediate
);

create index template_exercises_exercise_idx on public.template_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- Workout sessions
-- ---------------------------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  session_date date not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_status_completed check ((status = 'completed') = (completed_at is not null)),
  constraint workout_sessions_completed_after_start check (completed_at is null or completed_at >= started_at)
);

-- At most one in-progress workout per user: prevents accidental duplicate sessions.
create unique index workout_sessions_one_in_progress on public.workout_sessions (user_id)
  where status = 'in_progress';
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, session_date desc);
create index workout_sessions_template_idx on public.workout_sessions (template_id);
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  rep_min smallint check (rep_min between 1 and 100),
  rep_max smallint check (rep_max between 1 and 100),
  target_rpe numeric(3, 1) check (target_rpe between 5 and 10),
  rest_seconds integer check (rest_seconds between 0 and 1800),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  constraint workout_exercises_position_key unique (session_id, position) deferrable initially immediate
);

create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 50),
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop')),
  load_kg numeric(7, 3) check (load_kg >= 0 and load_kg <= 1000),
  load_unit text not null default 'kg' check (load_unit in ('kg', 'lb')),
  reps smallint check (reps between 0 and 100),
  rpe numeric(3, 1) check (rpe between 1 and 10 and rpe * 2 = floor(rpe * 2)),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A completed set must record its repetitions.
  constraint workout_sets_completed_has_reps check (completed_at is null or reps is not null),
  unique (workout_exercise_id, set_number)
);

create trigger workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();
