-- USDA-backed meal logging assisted by a Mistral agent.
-- The agent (Edge Function meal-estimate) only identifies foods and portions. Nutrient
-- values always come from USDA FoodData Central, and the user reviews every item before
-- this migration's log_usda_foods() writes anything.

-- ---------------------------------------------------------------------------
-- USDA provenance on foods
-- ---------------------------------------------------------------------------

alter table public.foods add column fdc_id integer check (fdc_id > 0);
create unique index foods_owner_fdc_key on public.foods (owner_id, fdc_id) where fdc_id is not null;

-- ---------------------------------------------------------------------------
-- Per-user rate limit for AI requests (protects the Mistral and USDA API budgets)
-- ---------------------------------------------------------------------------

create table public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('meal_estimate')),
  created_at timestamptz not null default now()
);

create index ai_requests_user_time_idx on public.ai_requests (user_id, created_at desc);

revoke all on public.ai_requests from anon, authenticated;
grant select, insert on public.ai_requests to authenticated;
alter table public.ai_requests enable row level security;

create policy "ai_requests: read own" on public.ai_requests
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_requests: insert own" on public.ai_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- No update or delete policy: users cannot reset their own usage.

-- Records one request and reports whether the user is within the hourly limit.
create or replace function public.consume_ai_request(p_kind text, p_hourly_limit integer default 30)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select count(*) into v_recent from public.ai_requests
  where user_id = v_uid and kind = p_kind and created_at > now() - interval '1 hour';
  if v_recent >= p_hourly_limit then
    return false;
  end if;
  insert into public.ai_requests (user_id, kind) values (v_uid, p_kind);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Log reviewed USDA items atomically
-- p_items: [{fdc_id, description, data_type, grams, calories, protein_g, carbs_g, fat_g, fiber_g}]
-- Nutrients are per 100 g as published by USDA. Each USDA food is stored once per user
-- (reused on later logs) and each item becomes a diary entry via the normal snapshot trigger.
-- ---------------------------------------------------------------------------

create or replace function public.log_usda_foods(p_entry_date date, p_meal text, p_items jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  item jsonb;
  v_food_id uuid;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nothing to log' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception 'Log at most 20 items at once' using errcode = '22023';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    select id into v_food_id from public.foods
    where owner_id = v_uid and fdc_id = (item ->> 'fdc_id')::integer;

    if v_food_id is null then
      insert into public.foods (owner_id, fdc_id, name, base_unit, reference_amount, calories, protein_g,
        carbs_g, fat_g, fiber_g, preparation, provenance, provenance_note)
      values (
        v_uid,
        (item ->> 'fdc_id')::integer,
        left(btrim(item ->> 'description'), 120),
        'g', 100,
        (item ->> 'calories')::numeric,
        (item ->> 'protein_g')::numeric,
        (item ->> 'carbs_g')::numeric,
        (item ->> 'fat_g')::numeric,
        (item ->> 'fiber_g')::numeric,
        'not_applicable',
        'reference_database',
        left(format('USDA FoodData Central, FDC ID %s (%s). Values per 100 g.',
          item ->> 'fdc_id', coalesce(item ->> 'data_type', 'unknown data type')), 300))
      returning id into v_food_id;
    end if;

    insert into public.food_entries (entry_date, meal, food_id, quantity)
    values (p_entry_date, p_meal, v_food_id, round((item ->> 'grams')::numeric, 2));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.consume_ai_request(text, integer), public.log_usda_foods(date, text, jsonb) from public, anon;
grant execute on function public.consume_ai_request(text, integer), public.log_usda_foods(date, text, jsonb) to authenticated;
