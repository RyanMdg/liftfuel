-- Trusted database logic. Every function is SECURITY INVOKER (RLS still applies) and
-- pins search_path to '' with fully qualified names, per Supabase guidance.

-- ---------------------------------------------------------------------------
-- Food entries: snapshot + authoritative nutrient calculation
-- ---------------------------------------------------------------------------
-- INSERT
--   * duplicated_from_id set -> copy food, snapshot and serving from that (own) entry.
--   * otherwise food_id is required -> snapshot the food as it is right now.
-- UPDATE
--   * snapshot columns, user_id and duplicated_from_id are immutable.
--   * food_id may only change to null (the source food was deleted).
-- Always
--   * serving mode (serving_count not null): quantity = serving_count * serving_amount.
--   * nutrient = quantity / snapshot_reference_amount * snapshot_nutrient.

create or replace function public.food_entries_compute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  f public.foods%rowtype;
  src public.food_entries%rowtype;
  s public.food_servings%rowtype;
  factor numeric;
begin
  if tg_op = 'INSERT' then
    if new.duplicated_from_id is not null then
      select * into src from public.food_entries e
      where e.id = new.duplicated_from_id and e.user_id = new.user_id;
      if not found then
        raise exception 'Entry to duplicate was not found' using errcode = 'P0002';
      end if;
      new.food_id := src.food_id;
      new.food_name := src.food_name;
      new.food_brand := src.food_brand;
      new.base_unit := src.base_unit;
      new.snapshot_reference_amount := src.snapshot_reference_amount;
      new.snapshot_calories := src.snapshot_calories;
      new.snapshot_protein_g := src.snapshot_protein_g;
      new.snapshot_carbs_g := src.snapshot_carbs_g;
      new.snapshot_fat_g := src.snapshot_fat_g;
      new.snapshot_fiber_g := src.snapshot_fiber_g;
      new.snapshot_provenance := src.snapshot_provenance;
      if new.quantity is null and new.serving_count is null then
        new.quantity := src.quantity;
        new.serving_id := src.serving_id;
        new.serving_label := src.serving_label;
        new.serving_amount := src.serving_amount;
        new.serving_count := src.serving_count;
      elsif new.serving_count is not null and new.serving_id is null then
        -- keep the source serving definition, new count
        new.serving_id := src.serving_id;
        new.serving_label := src.serving_label;
        new.serving_amount := src.serving_amount;
      end if;
    else
      if new.food_id is null then
        raise exception 'food_id is required' using errcode = '23502';
      end if;
      -- RLS applies: only catalog foods and the user's own foods are found.
      select * into f from public.foods where id = new.food_id;
      if not found then
        raise exception 'Food not found' using errcode = 'P0002';
      end if;
      new.food_name := f.name;
      new.food_brand := f.brand;
      new.base_unit := f.base_unit;
      new.snapshot_reference_amount := f.reference_amount;
      new.snapshot_calories := f.calories;
      new.snapshot_protein_g := f.protein_g;
      new.snapshot_carbs_g := f.carbs_g;
      new.snapshot_fat_g := f.fat_g;
      new.snapshot_fiber_g := f.fiber_g;
      new.snapshot_provenance := f.provenance;
      new.serving_label := null;
      new.serving_amount := null;
    end if;
    new.logged_at := now();
  else
    if new.food_id is distinct from old.food_id and new.food_id is not null then
      raise exception 'The food of an entry cannot be changed; log a new entry instead'
        using errcode = '22023';
    end if;
    new.user_id := old.user_id;
    new.duplicated_from_id := old.duplicated_from_id;
    new.food_name := old.food_name;
    new.food_brand := old.food_brand;
    new.base_unit := old.base_unit;
    new.snapshot_reference_amount := old.snapshot_reference_amount;
    new.snapshot_calories := old.snapshot_calories;
    new.snapshot_protein_g := old.snapshot_protein_g;
    new.snapshot_carbs_g := old.snapshot_carbs_g;
    new.snapshot_fat_g := old.snapshot_fat_g;
    new.snapshot_fiber_g := old.snapshot_fiber_g;
    new.snapshot_provenance := old.snapshot_provenance;
    new.logged_at := old.logged_at;
    new.created_at := old.created_at;
    if new.serving_id is not distinct from old.serving_id then
      -- serving definition is part of the snapshot unless a new serving is chosen
      new.serving_label := old.serving_label;
      new.serving_amount := old.serving_amount;
    end if;
    new.updated_at := now();
  end if;

  -- A newly chosen serving must belong to this entry's food.
  if new.serving_id is not null
     and (tg_op = 'INSERT' and new.duplicated_from_id is null
          or tg_op = 'UPDATE' and new.serving_id is distinct from old.serving_id) then
    select * into s from public.food_servings fs
    where fs.id = new.serving_id and fs.food_id = new.food_id;
    if not found then
      raise exception 'Serving does not belong to this food' using errcode = '22023';
    end if;
    new.serving_label := s.label;
    new.serving_amount := s.amount;
    new.serving_count := coalesce(new.serving_count, 1);
  end if;

  if new.serving_count is null then
    new.serving_id := null;
    new.serving_label := null;
    new.serving_amount := null;
  else
    if new.serving_amount is null then
      raise exception 'A serving must be selected when logging by serving' using errcode = '22023';
    end if;
    new.quantity := round(new.serving_count * new.serving_amount, 2);
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Quantity must be greater than zero' using errcode = '22023';
  end if;

  factor := new.quantity / new.snapshot_reference_amount;
  new.calories := round(new.snapshot_calories * factor, 2);
  new.protein_g := round(new.snapshot_protein_g * factor, 2);
  new.carbs_g := round(new.snapshot_carbs_g * factor, 2);
  new.fat_g := round(new.snapshot_fat_g * factor, 2);
  new.fiber_g := case when new.snapshot_fiber_g is null then null
                      else round(new.snapshot_fiber_g * factor, 2) end;
  return new;
end;
$$;

create trigger food_entries_compute before insert or update on public.food_entries
  for each row execute function public.food_entries_compute();

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

-- Recalculates the recipe's derived food (the row users log) from its ingredients.
-- Yield: explicit cooked_yield_g when known; otherwise the raw ingredient total,
-- and the result is labelled as an estimate.
create or replace function public.recompute_recipe_food(p_recipe_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  r public.recipes%rowtype;
  t record;
  v_yield numeric;
  v_estimated boolean;
  v_note text;
  v_food_id uuid;
begin
  select * into r from public.recipes where id = p_recipe_id;
  if not found then
    raise exception 'Recipe not found' using errcode = 'P0002';
  end if;

  select
    count(*) as n,
    coalesce(sum(ri.quantity / f.reference_amount * f.calories), 0) as calories,
    coalesce(sum(ri.quantity / f.reference_amount * f.protein_g), 0) as protein_g,
    coalesce(sum(ri.quantity / f.reference_amount * f.carbs_g), 0) as carbs_g,
    coalesce(sum(ri.quantity / f.reference_amount * f.fat_g), 0) as fat_g,
    case when bool_and(f.fiber_g is not null)
         then sum(ri.quantity / f.reference_amount * f.fiber_g) end as fiber_g,
    coalesce(sum(ri.quantity), 0) as raw_amount,
    coalesce(bool_or(f.provenance = 'estimated'), false) as any_estimated,
    coalesce(bool_or(f.base_unit = 'ml'), false) as any_ml
  into t
  from public.recipe_ingredients ri
  join public.foods f on f.id = ri.food_id
  where ri.recipe_id = p_recipe_id;

  if t.n = 0 then
    raise exception 'A recipe needs at least one ingredient' using errcode = '22023';
  end if;

  v_yield := coalesce(r.cooked_yield_g, t.raw_amount);
  v_estimated := r.cooked_yield_g is null or t.any_estimated;
  v_note := concat_ws(' ',
    case when r.cooked_yield_g is null then
      'Cooked yield not recorded; per-gram values assume the final weight equals the raw ingredient weight'
      || case when t.any_ml then ' (ml counted as g).' else '.' end
    end,
    case when t.any_estimated then 'Includes ingredients with estimated nutrition values.' end);

  insert into public.foods as fd (
    owner_id, recipe_id, name, base_unit, reference_amount,
    calories, protein_g, carbs_g, fat_g, fiber_g, preparation, provenance, provenance_note)
  values (
    r.owner_id, r.id, r.name, 'g', round(v_yield, 2),
    round(t.calories, 2), round(t.protein_g, 2), round(t.carbs_g, 2), round(t.fat_g, 2),
    round(t.fiber_g, 2), 'cooked',
    case when v_estimated then 'estimated' else 'recipe_calculated' end,
    nullif(v_note, ''))
  on conflict (recipe_id) do update set
    name = excluded.name,
    reference_amount = excluded.reference_amount,
    calories = excluded.calories,
    protein_g = excluded.protein_g,
    carbs_g = excluded.carbs_g,
    fat_g = excluded.fat_g,
    fiber_g = excluded.fiber_g,
    provenance = excluded.provenance,
    provenance_note = excluded.provenance_note
  returning fd.id into v_food_id;

  -- Servings are rebuilt; past diary entries keep their own serving snapshot.
  delete from public.food_servings where food_id = v_food_id;
  if r.servings is not null then
    insert into public.food_servings (food_id, label, amount, position)
    values (v_food_id, '1 serving', round(v_yield / r.servings, 2), 0);
  end if;

  return v_food_id;
end;
$$;

-- Creates or updates a recipe and replaces its ingredient list atomically.
-- p_ingredients: [{"food_id": uuid, "quantity": number}, ...]
create or replace function public.save_recipe(
  p_recipe_id uuid,
  p_name text,
  p_notes text,
  p_servings numeric,
  p_cooked_yield_g numeric,
  p_ingredients jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int;
  v_valid int;
begin
  if jsonb_typeof(p_ingredients) is distinct from 'array' or jsonb_array_length(p_ingredients) = 0 then
    raise exception 'A recipe needs at least one ingredient' using errcode = '22023';
  end if;

  if p_recipe_id is null then
    insert into public.recipes (name, notes, servings, cooked_yield_g)
    values (p_name, nullif(btrim(p_notes), ''), p_servings, p_cooked_yield_g)
    returning id into v_id;
  else
    update public.recipes
    set name = p_name, notes = nullif(btrim(p_notes), ''),
        servings = p_servings, cooked_yield_g = p_cooked_yield_g
    where id = p_recipe_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Recipe not found' using errcode = 'P0002';
    end if;
  end if;

  select count(*), count(f.id) into v_count, v_valid
  from jsonb_to_recordset(p_ingredients) as i(food_id uuid, quantity numeric)
  left join public.foods f on f.id = i.food_id and f.recipe_id is null;
  if v_valid <> v_count then
    raise exception 'Ingredients must be catalog foods or your own foods (not other recipes)'
      using errcode = '22023';
  end if;

  delete from public.recipe_ingredients where recipe_id = v_id;
  insert into public.recipe_ingredients (recipe_id, food_id, quantity, position)
  select v_id, (e.item ->> 'food_id')::uuid, (e.item ->> 'quantity')::numeric, (e.ord - 1)::smallint
  from jsonb_array_elements(p_ingredients) with ordinality as e(item, ord);

  perform public.recompute_recipe_food(v_id);
  return v_id;
end;
$$;

-- Keep recipe nutrition in sync when a user edits an ingredient food.
create or replace function public.foods_propagate_to_recipes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rid uuid;
begin
  for rid in
    select distinct ri.recipe_id from public.recipe_ingredients ri where ri.food_id = new.id
  loop
    perform public.recompute_recipe_food(rid);
  end loop;
  return null;
end;
$$;

create trigger foods_propagate_to_recipes
  after update of reference_amount, calories, protein_g, carbs_g, fat_g, fiber_g, provenance, base_unit
  on public.foods
  for each row
  when (new.recipe_id is null)
  execute function public.foods_propagate_to_recipes();

-- ---------------------------------------------------------------------------
-- Custom foods: food row and its serving sizes saved atomically.
-- p_food: {name, brand, base_unit, reference_amount, calories, protein_g, carbs_g, fat_g,
--          fiber_g, barcode, preparation, provenance, provenance_note}
-- p_servings: [{id?, label, amount}]; servings missing from the list are deleted
-- (diary entries keep their own serving snapshot).
-- ---------------------------------------------------------------------------

create or replace function public.save_food(p_food_id uuid, p_food jsonb, p_servings jsonb default '[]'::jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_provenance text := coalesce(p_food ->> 'provenance', 'user_entered');
  v_servings jsonb := coalesce(p_servings, '[]'::jsonb);
begin
  if v_provenance = 'recipe_calculated' then
    raise exception 'Recipe-calculated values are set by recipes only' using errcode = '22023';
  end if;
  if jsonb_typeof(v_servings) <> 'array' then
    raise exception 'Servings must be a list' using errcode = '22023';
  end if;

  if p_food_id is null then
    insert into public.foods (name, brand, base_unit, reference_amount, calories, protein_g, carbs_g, fat_g,
      fiber_g, barcode, preparation, provenance, provenance_note)
    values (
      p_food ->> 'name',
      nullif(btrim(p_food ->> 'brand'), ''),
      coalesce(p_food ->> 'base_unit', 'g'),
      (p_food ->> 'reference_amount')::numeric,
      (p_food ->> 'calories')::numeric,
      (p_food ->> 'protein_g')::numeric,
      (p_food ->> 'carbs_g')::numeric,
      (p_food ->> 'fat_g')::numeric,
      (p_food ->> 'fiber_g')::numeric,
      nullif(btrim(p_food ->> 'barcode'), ''),
      coalesce(p_food ->> 'preparation', 'not_applicable'),
      v_provenance,
      nullif(btrim(p_food ->> 'provenance_note'), ''))
    returning id into v_id;
  else
    update public.foods set
      name = p_food ->> 'name',
      brand = nullif(btrim(p_food ->> 'brand'), ''),
      base_unit = coalesce(p_food ->> 'base_unit', 'g'),
      reference_amount = (p_food ->> 'reference_amount')::numeric,
      calories = (p_food ->> 'calories')::numeric,
      protein_g = (p_food ->> 'protein_g')::numeric,
      carbs_g = (p_food ->> 'carbs_g')::numeric,
      fat_g = (p_food ->> 'fat_g')::numeric,
      fiber_g = (p_food ->> 'fiber_g')::numeric,
      barcode = nullif(btrim(p_food ->> 'barcode'), ''),
      preparation = coalesce(p_food ->> 'preparation', 'not_applicable'),
      provenance = v_provenance,
      provenance_note = nullif(btrim(p_food ->> 'provenance_note'), '')
    where id = p_food_id and recipe_id is null
    returning id into v_id;
    if v_id is null then
      raise exception 'Food not found or not editable' using errcode = 'P0002';
    end if;
  end if;

  delete from public.food_servings fs
  where fs.food_id = v_id
    and fs.id not in (
      select (e ->> 'id')::uuid from jsonb_array_elements(v_servings) e where nullif(e ->> 'id', '') is not null);

  update public.food_servings fs
  set label = btrim(e.item ->> 'label'), amount = (e.item ->> 'amount')::numeric, position = (e.ord - 1)::smallint
  from jsonb_array_elements(v_servings) with ordinality as e(item, ord)
  where nullif(e.item ->> 'id', '') is not null and fs.id = (e.item ->> 'id')::uuid and fs.food_id = v_id;

  insert into public.food_servings (food_id, label, amount, position)
  select v_id, btrim(e.item ->> 'label'), (e.item ->> 'amount')::numeric, (e.ord - 1)::smallint
  from jsonb_array_elements(v_servings) with ordinality as e(item, ord)
  where nullif(e.item ->> 'id', '') is null;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Food search: every whitespace-separated term must appear in name or brand.
-- Uses position() rather than LIKE so user input needs no escaping.
-- ---------------------------------------------------------------------------

create or replace function public.search_foods(p_query text, p_limit integer default 25)
returns setof public.foods
language sql
stable
set search_path = ''
as $$
  with q as (
    select lower(regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' ', 'g')) as text
  )
  select f.*
  from public.foods f, q
  where q.text <> ''
    and not exists (
      select 1 from unnest(string_to_array(q.text, ' ')) term
      where position(term in lower(f.name || ' ' || coalesce(f.brand, ''))) = 0)
  order by
    lower(f.name) = q.text desc,
    starts_with(lower(f.name), q.text) desc,
    f.owner_id is null asc,
    char_length(f.name) asc,
    f.name asc
  limit least(greatest(coalesce(p_limit, 25), 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Onboarding (profile + first nutrition goal + optional first weigh-in, atomically)
-- ---------------------------------------------------------------------------

create or replace function public.complete_onboarding(
  p_display_name text,
  p_weight_unit text,
  p_time_zone text,
  p_goal text,
  p_start_date date,
  p_calories numeric,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric,
  p_weight_kg numeric default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  update public.profiles
  set display_name = nullif(btrim(p_display_name), ''),
      weight_unit = p_weight_unit,
      time_zone = p_time_zone,
      goal = p_goal,
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_uid;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  insert into public.nutrition_goals (user_id, effective_date, calories, protein_g, carbs_g, fat_g)
  values (v_uid, p_start_date, p_calories, p_protein_g, p_carbs_g, p_fat_g)
  on conflict (user_id, effective_date) do update set
    calories = excluded.calories, protein_g = excluded.protein_g,
    carbs_g = excluded.carbs_g, fat_g = excluded.fat_g;

  if p_weight_kg is not null then
    insert into public.weight_entries (user_id, entry_date, weight_kg)
    values (v_uid, p_start_date, p_weight_kg)
    on conflict (user_id, entry_date) do update set weight_kg = excluded.weight_kg;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Templates
-- ---------------------------------------------------------------------------

create or replace function public.add_template_exercise(p_template_id uuid, p_exercise_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Lock the template row so concurrent adds get distinct positions.
  perform 1 from public.workout_templates where id = p_template_id for update;
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
  insert into public.template_exercises (template_id, exercise_id, position)
  values (p_template_id, p_exercise_id,
    coalesce((select max(position) + 1 from public.template_exercises where template_id = p_template_id), 0))
  returning id into v_id;
  return v_id;
end;
$$;

-- p_ordered_ids must contain exactly the template's exercise row ids, in the new order.
create or replace function public.reorder_template_exercises(p_template_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_existing int;
begin
  perform 1 from public.workout_templates where id = p_template_id for update;
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;
  select count(*) into v_existing from public.template_exercises where template_id = p_template_id;
  if v_existing <> coalesce(array_length(p_ordered_ids, 1), 0)
     or v_existing <> (select count(distinct x) from unnest(p_ordered_ids) x)
     or exists (select 1 from unnest(p_ordered_ids) x
                where not exists (select 1 from public.template_exercises te
                                  where te.id = x and te.template_id = p_template_id)) then
    raise exception 'Order must list every exercise in the template exactly once' using errcode = '22023';
  end if;

  set constraints public.template_exercises_position_key deferred;
  update public.template_exercises te
  set position = o.ord - 1
  from unnest(p_ordered_ids) with ordinality as o(id, ord)
  where te.id = o.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workout sessions
-- ---------------------------------------------------------------------------

-- Starts a workout, optionally from a template. Idempotent with respect to the
-- one-in-progress rule: if a workout is already running, returns it with created = false.
create or replace function public.start_workout(
  p_session_date date,
  p_template_id uuid default null,
  p_name text default null
)
returns table (session_id uuid, created boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_session uuid;
  v_name text;
  te record;
  v_we uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select id into v_existing from public.workout_sessions
  where user_id = v_uid and status = 'in_progress';
  if found then
    return query select v_existing, false;
    return;
  end if;

  if p_template_id is not null then
    select name into v_name from public.workout_templates where id = p_template_id;
    if not found then
      raise exception 'Template not found' using errcode = 'P0002';
    end if;
  end if;
  v_name := coalesce(nullif(btrim(p_name), ''), v_name, 'Workout');

  begin
    insert into public.workout_sessions (user_id, template_id, name, session_date)
    values (v_uid, p_template_id, v_name, p_session_date)
    returning id into v_session;
  exception when unique_violation then
    -- A concurrent request created the session first.
    select id into v_existing from public.workout_sessions
    where user_id = v_uid and status = 'in_progress';
    return query select v_existing, false;
    return;
  end;

  if p_template_id is not null then
    for te in
      select * from public.template_exercises where template_id = p_template_id order by position
    loop
      insert into public.workout_exercises
        (session_id, exercise_id, position, rep_min, rep_max, target_rpe, rest_seconds, notes)
      values
        (v_session, te.exercise_id, te.position, te.rep_min, te.rep_max, te.target_rpe, te.rest_seconds, te.notes)
      returning id into v_we;

      insert into public.workout_sets (workout_exercise_id, set_number, set_type)
      select v_we, g, 'working' from generate_series(1, te.planned_sets) g;
    end loop;
  end if;

  return query select v_session, true;
end;
$$;

create or replace function public.add_workout_exercise(p_session_id uuid, p_exercise_id uuid, p_sets integer default 1)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_we uuid;
begin
  perform 1 from public.workout_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Workout not found' using errcode = 'P0002';
  end if;
  insert into public.workout_exercises (session_id, exercise_id, position)
  values (p_session_id, p_exercise_id,
    coalesce((select max(position) + 1 from public.workout_exercises where session_id = p_session_id), 0))
  returning id into v_we;

  insert into public.workout_sets (workout_exercise_id, set_number, set_type)
  select v_we, g, 'working' from generate_series(1, least(greatest(coalesce(p_sets, 1), 1), 20)) g;
  return v_we;
end;
$$;

-- Adds a set after the last one, copying its type, load and unit (not reps or completion).
create or replace function public.add_workout_set(p_workout_exercise_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  last_set public.workout_sets%rowtype;
  v_id uuid;
begin
  perform 1 from public.workout_exercises where id = p_workout_exercise_id for update;
  if not found then
    raise exception 'Exercise not found in this workout' using errcode = 'P0002';
  end if;
  select * into last_set from public.workout_sets
  where workout_exercise_id = p_workout_exercise_id
  order by set_number desc limit 1;

  insert into public.workout_sets (workout_exercise_id, set_number, set_type, load_kg, load_unit)
  values (
    p_workout_exercise_id,
    coalesce(last_set.set_number, 0) + 1,
    coalesce(last_set.set_type, 'working'),
    last_set.load_kg,
    coalesce(last_set.load_unit, 'kg'))
  returning id into v_id;
  return v_id;
end;
$$;

-- Finishes a workout. By default, planned sets that were never completed are removed,
-- and exercises left with no sets are removed. Requires at least one completed set.
create or replace function public.finish_workout(p_session_id uuid, p_discard_incomplete boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.workout_sessions where id = p_session_id for update;
  if not found then
    raise exception 'Workout not found' using errcode = 'P0002';
  end if;
  if v_status = 'completed' then
    return; -- idempotent: a repeated finish is a no-op
  end if;

  if not exists (
    select 1 from public.workout_sets ws
    join public.workout_exercises we on we.id = ws.workout_exercise_id
    where we.session_id = p_session_id and ws.completed_at is not null
  ) then
    raise exception 'Complete at least one set before finishing, or discard the workout'
      using errcode = '22023';
  end if;

  if p_discard_incomplete then
    delete from public.workout_sets ws
    using public.workout_exercises we
    where we.id = ws.workout_exercise_id and we.session_id = p_session_id and ws.completed_at is null;

    delete from public.workout_exercises we
    where we.session_id = p_session_id
      and not exists (select 1 from public.workout_sets ws where ws.workout_exercise_id = we.id);
  end if;

  update public.workout_sessions
  set status = 'completed', completed_at = greatest(now(), started_at)
  where id = p_session_id;
end;
$$;

-- Previous performance: for each exercise in the given session, the completed sets from
-- the most recent earlier completed session that included that exercise.
-- set_ordinal is the 1-based position among those completed sets.
create or replace function public.get_previous_performance(p_session_id uuid)
returns table (
  exercise_id uuid,
  session_id uuid,
  session_date date,
  set_ordinal integer,
  set_type text,
  load_kg numeric,
  load_unit text,
  reps smallint,
  rpe numeric
)
language sql
stable
set search_path = ''
as $$
  with cur as (
    select s.id, s.user_id, s.started_at from public.workout_sessions s where s.id = p_session_id
  ),
  ex as (
    select distinct we.exercise_id from public.workout_exercises we where we.session_id = p_session_id
  ),
  last_session as (
    select distinct on (ex.exercise_id) ex.exercise_id, s.id as session_id, s.session_date
    from ex
    join public.workout_exercises we on we.exercise_id = ex.exercise_id
    join public.workout_sessions s on s.id = we.session_id
    join cur on s.user_id = cur.user_id
    where s.status = 'completed'
      and s.id <> cur.id
      and s.started_at < cur.started_at
      and exists (select 1 from public.workout_sets ws
                  where ws.workout_exercise_id = we.id and ws.completed_at is not null)
    order by ex.exercise_id, s.started_at desc
  )
  select
    ls.exercise_id,
    ls.session_id,
    ls.session_date,
    (row_number() over (partition by ls.exercise_id order by we.position, ws.set_number))::integer,
    ws.set_type,
    ws.load_kg,
    ws.load_unit,
    ws.reps,
    ws.rpe
  from last_session ls
  join public.workout_exercises we on we.session_id = ls.session_id and we.exercise_id = ls.exercise_id
  join public.workout_sets ws on ws.workout_exercise_id = we.id
  where ws.completed_at is not null
  order by ls.exercise_id, we.position, ws.set_number;
$$;

-- ---------------------------------------------------------------------------
-- Analytics views (security_invoker so the caller's RLS applies)
-- ---------------------------------------------------------------------------

create view public.completed_sets with (security_invoker = true) as
select
  ws.id as set_id,
  s.user_id,
  s.id as session_id,
  s.session_date,
  s.completed_at as session_completed_at,
  we.id as workout_exercise_id,
  we.exercise_id,
  e.name as exercise_name,
  e.powerlifting_lift,
  ws.set_number,
  ws.set_type,
  ws.load_kg,
  ws.load_unit,
  ws.reps,
  ws.rpe,
  ws.completed_at
from public.workout_sets ws
join public.workout_exercises we on we.id = ws.workout_exercise_id
join public.workout_sessions s on s.id = we.session_id
join public.exercises e on e.id = we.exercise_id
where ws.completed_at is not null and s.status = 'completed';

-- All-time records per exercise, computed in the database so they are never truncated
-- by API row limits. e1RM uses Epley, only for completed working sets of 1-10 reps
-- (a single counts at its actual load). Ties keep the earliest set.
create view public.exercise_records with (security_invoker = true) as
with counted as (
  select cs.*,
    case when cs.set_type = 'working' and cs.reps between 1 and 10 then
      case when cs.reps = 1 then cs.load_kg else round(cs.load_kg * (1 + cs.reps / 30.0), 2) end
    end as e1rm
  from public.completed_sets cs
  where cs.set_type <> 'warmup' and cs.load_kg > 0 and cs.reps >= 1
),
best_e1rm as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, e1rm, load_kg as e1rm_load_kg, reps as e1rm_reps, session_date as e1rm_date
  from counted
  where e1rm is not null
  order by user_id, exercise_id, e1rm desc, completed_at asc
),
heaviest as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, exercise_name, powerlifting_lift,
    load_kg as heaviest_kg, reps as heaviest_reps, session_date as heaviest_date
  from counted
  order by user_id, exercise_id, load_kg desc, completed_at asc
)
select
  h.user_id, h.exercise_id, h.exercise_name, h.powerlifting_lift,
  h.heaviest_kg, h.heaviest_reps, h.heaviest_date,
  b.e1rm as best_e1rm, b.e1rm_load_kg, b.e1rm_reps, b.e1rm_date
from heaviest h
left join best_e1rm b on b.user_id = h.user_id and b.exercise_id = h.exercise_id;

create view public.daily_nutrition_totals with (security_invoker = true) as
select
  user_id,
  entry_date,
  count(*)::integer as entry_count,
  sum(calories) as calories,
  sum(protein_g) as protein_g,
  sum(carbs_g) as carbs_g,
  sum(fat_g) as fat_g
from public.food_entries
group by user_id, entry_date;

-- ---------------------------------------------------------------------------
-- Privileges for functions and views
-- ---------------------------------------------------------------------------

revoke all on function
  public.food_entries_compute(),
  public.recompute_recipe_food(uuid),
  public.save_recipe(uuid, text, text, numeric, numeric, jsonb),
  public.foods_propagate_to_recipes(),
  public.save_food(uuid, jsonb, jsonb),
  public.search_foods(text, integer),
  public.complete_onboarding(text, text, text, text, date, numeric, numeric, numeric, numeric, numeric),
  public.add_template_exercise(uuid, uuid),
  public.reorder_template_exercises(uuid, uuid[]),
  public.start_workout(date, uuid, text),
  public.add_workout_exercise(uuid, uuid, integer),
  public.add_workout_set(uuid),
  public.finish_workout(uuid, boolean),
  public.get_previous_performance(uuid)
from public, anon;

grant execute on function
  public.food_entries_compute(),
  public.recompute_recipe_food(uuid),
  public.save_recipe(uuid, text, text, numeric, numeric, jsonb),
  public.foods_propagate_to_recipes(),
  public.save_food(uuid, jsonb, jsonb),
  public.search_foods(text, integer),
  public.complete_onboarding(text, text, text, text, date, numeric, numeric, numeric, numeric, numeric),
  public.add_template_exercise(uuid, uuid),
  public.reorder_template_exercises(uuid, uuid[]),
  public.start_workout(date, uuid, text),
  public.add_workout_exercise(uuid, uuid, integer),
  public.add_workout_set(uuid),
  public.finish_workout(uuid, boolean),
  public.get_previous_performance(uuid)
to authenticated;

revoke all on public.completed_sets, public.exercise_records, public.daily_nutrition_totals from anon;
grant select on public.completed_sets, public.exercise_records, public.daily_nutrition_totals to authenticated;
