-- Row Level Security for every table.
-- Conventions (Supabase RLS guide): one policy per operation, scoped `to authenticated`,
-- auth.uid() wrapped in a scalar subquery so it is evaluated once per statement.
-- Child tables prove ownership through their parent instead of trusting client ids.

-- ---------------------------------------------------------------------------
-- Grants: anonymous clients get nothing; signed-in users get only what RLS then filters.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on
  public.nutrition_goals,
  public.recipes,
  public.foods,
  public.food_servings,
  public.recipe_ingredients,
  public.food_entries,
  public.weight_entries,
  public.exercises,
  public.workout_templates,
  public.template_exercises,
  public.workout_sessions,
  public.workout_exercises,
  public.workout_sets
to authenticated;
grant select, insert, delete on public.favorite_foods to authenticated;

-- Trigger functions run with the invoking role's privileges, so it must be able to execute them.
grant execute on function
  public.set_updated_at(),
  public.normalize_name(),
  public.validate_profile(),
  public.validate_exercise_name()
to authenticated;

-- The sign-up trigger runs as Supabase's auth role. Grant it explicitly (guarded so the
-- migration also runs on plain Postgres, e.g. the PGlite test harness).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.nutrition_goals enable row level security;
alter table public.recipes enable row level security;
alter table public.foods enable row level security;
alter table public.food_servings enable row level security;
alter table public.favorite_foods enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.food_entries enable row level security;
alter table public.weight_entries enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- ---------------------------------------------------------------------------
-- profiles (rows are created by the auth trigger; users cannot insert or delete)
-- ---------------------------------------------------------------------------

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Simple user-owned tables
-- ---------------------------------------------------------------------------

create policy "nutrition_goals: read own" on public.nutrition_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "nutrition_goals: insert own" on public.nutrition_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "nutrition_goals: update own" on public.nutrition_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "nutrition_goals: delete own" on public.nutrition_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "recipes: read own" on public.recipes
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "recipes: insert own" on public.recipes
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "recipes: update own" on public.recipes
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "recipes: delete own" on public.recipes
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "food_entries: read own" on public.food_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "food_entries: insert own" on public.food_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "food_entries: update own" on public.food_entries
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "food_entries: delete own" on public.food_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "weight_entries: read own" on public.weight_entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weight_entries: insert own" on public.weight_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weight_entries: update own" on public.weight_entries
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weight_entries: delete own" on public.weight_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "workout_templates: read own" on public.workout_templates
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout_templates: insert own" on public.workout_templates
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workout_templates: update own" on public.workout_templates
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_templates: delete own" on public.workout_templates
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "workout_sessions: read own" on public.workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workout_sessions: insert own" on public.workout_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (template_id is null or exists (
      select 1 from public.workout_templates t
      where t.id = template_id and t.user_id = (select auth.uid())))
  );
create policy "workout_sessions: update own" on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workout_sessions: delete own" on public.workout_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Catalog tables: shared rows (owner_id is null) are readable; only own rows are writable.
-- ---------------------------------------------------------------------------

create policy "foods: read catalog and own" on public.foods
  for select to authenticated using (owner_id is null or (select auth.uid()) = owner_id);
create policy "foods: insert own" on public.foods
  for insert to authenticated with check (
    (select auth.uid()) = owner_id
    and (recipe_id is null or exists (
      select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())))
  );
create policy "foods: update own" on public.foods
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "foods: delete own" on public.foods
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "exercises: read catalog and own" on public.exercises
  for select to authenticated using (owner_id is null or (select auth.uid()) = owner_id);
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "exercises: update own" on public.exercises
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "exercises: delete own" on public.exercises
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Child tables: ownership is verified through the parent row.
-- Referenced catalog rows (foods, exercises) must be visible to the user, because a
-- foreign key alone would accept another user's private food or exercise id.
-- ---------------------------------------------------------------------------

create policy "food_servings: read visible foods" on public.food_servings
  for select to authenticated using (exists (
    select 1 from public.foods f
    where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))));
create policy "food_servings: insert own foods" on public.food_servings
  for insert to authenticated with check (exists (
    select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid())));
create policy "food_servings: update own foods" on public.food_servings
  for update to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid())));
create policy "food_servings: delete own foods" on public.food_servings
  for delete to authenticated using (exists (
    select 1 from public.foods f where f.id = food_id and f.owner_id = (select auth.uid())));

create policy "favorite_foods: read own" on public.favorite_foods
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorite_foods: insert own" on public.favorite_foods
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.foods f
      where f.id = food_id and (f.owner_id is null or f.owner_id = (select auth.uid()))));
create policy "favorite_foods: delete own" on public.favorite_foods
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "recipe_ingredients: read own recipes" on public.recipe_ingredients
  for select to authenticated using (exists (
    select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())));
create policy "recipe_ingredients: insert own recipes" on public.recipe_ingredients
  for insert to authenticated with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid()))
    and exists (select 1 from public.foods f
      where f.id = food_id and f.recipe_id is null
        and (f.owner_id is null or f.owner_id = (select auth.uid()))));
create policy "recipe_ingredients: update own recipes" on public.recipe_ingredients
  for update to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid()))
    and exists (select 1 from public.foods f
      where f.id = food_id and f.recipe_id is null
        and (f.owner_id is null or f.owner_id = (select auth.uid()))));
create policy "recipe_ingredients: delete own recipes" on public.recipe_ingredients
  for delete to authenticated using (exists (
    select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())));

create policy "template_exercises: read own templates" on public.template_exercises
  for select to authenticated using (exists (
    select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())));
create policy "template_exercises: insert own templates" on public.template_exercises
  for insert to authenticated with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))));
create policy "template_exercises: update own templates" on public.template_exercises
  for update to authenticated
  using (exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))));
create policy "template_exercises: delete own templates" on public.template_exercises
  for delete to authenticated using (exists (
    select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())));

create policy "workout_exercises: read own sessions" on public.workout_exercises
  for select to authenticated using (exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "workout_exercises: insert own sessions" on public.workout_exercises
  for insert to authenticated with check (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))));
create policy "workout_exercises: update own sessions" on public.workout_exercises
  for update to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (
    exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))));
create policy "workout_exercises: delete own sessions" on public.workout_exercises
  for delete to authenticated using (exists (
    select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "workout_sets: read own sessions" on public.workout_sets
  for select to authenticated using (exists (
    select 1 from public.workout_exercises we
    join public.workout_sessions s on s.id = we.session_id
    where we.id = workout_exercise_id and s.user_id = (select auth.uid())));
create policy "workout_sets: insert own sessions" on public.workout_sets
  for insert to authenticated with check (exists (
    select 1 from public.workout_exercises we
    join public.workout_sessions s on s.id = we.session_id
    where we.id = workout_exercise_id and s.user_id = (select auth.uid())));
create policy "workout_sets: update own sessions" on public.workout_sets
  for update to authenticated
  using (exists (
    select 1 from public.workout_exercises we
    join public.workout_sessions s on s.id = we.session_id
    where we.id = workout_exercise_id and s.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.workout_exercises we
    join public.workout_sessions s on s.id = we.session_id
    where we.id = workout_exercise_id and s.user_id = (select auth.uid())));
create policy "workout_sets: delete own sessions" on public.workout_sets
  for delete to authenticated using (exists (
    select 1 from public.workout_exercises we
    join public.workout_sessions s on s.id = we.session_id
    where we.id = workout_exercise_id and s.user_id = (select auth.uid())));
