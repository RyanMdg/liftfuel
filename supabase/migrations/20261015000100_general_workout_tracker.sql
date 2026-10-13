-- General workout tracking (Hevy-style) replaces powerlifting-specific analytics.
-- * Drops exercises.powerlifting_lift (no more squat/bench/deadlift total).
-- * completed_sets gains body area and mechanic for "sets per body area".
-- * exercise_records gains best set volume and most reps, alongside heaviest weight and best e1RM.

drop view if exists public.exercise_records;
drop view if exists public.completed_sets;

alter table public.exercises drop constraint if exists exercises_pl_lift_catalog_only;
alter table public.exercises drop column if exists powerlifting_lift;

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
  e.category,
  e.mechanic,
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

-- All-time records per exercise (warm-ups excluded; ties keep the earliest set):
--   heaviest weight, best estimated 1RM (Epley, working sets of 1-10 reps; a single counts
--   at its load), best set volume (load x reps), and most reps in one set (any load,
--   so bodyweight exercises have a record too).
create view public.exercise_records with (security_invoker = true) as
with counted as (
  select cs.*,
    case when cs.set_type = 'working' and cs.load_kg > 0 and cs.reps between 1 and 10 then
      case when cs.reps = 1 then cs.load_kg else round(cs.load_kg * (1 + cs.reps / 30.0), 2) end
    end as e1rm,
    case when cs.load_kg > 0 then cs.load_kg * cs.reps end as set_volume
  from public.completed_sets cs
  where cs.set_type <> 'warmup' and cs.reps >= 1
),
exercises_done as (
  select distinct on (user_id, exercise_id) user_id, exercise_id, exercise_name, category
  from counted
  order by user_id, exercise_id
),
heaviest as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, load_kg as heaviest_kg, reps as heaviest_reps, session_date as heaviest_date
  from counted where load_kg > 0
  order by user_id, exercise_id, load_kg desc, completed_at asc
),
best_e1rm as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, e1rm, load_kg as e1rm_load_kg, reps as e1rm_reps, session_date as e1rm_date
  from counted where e1rm is not null
  order by user_id, exercise_id, e1rm desc, completed_at asc
),
best_volume as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, set_volume as best_set_volume_kg, load_kg as volume_load_kg, reps as volume_reps,
    session_date as volume_date
  from counted where set_volume is not null
  order by user_id, exercise_id, set_volume desc, completed_at asc
),
most_reps as (
  select distinct on (user_id, exercise_id)
    user_id, exercise_id, reps as max_reps, load_kg as max_reps_load_kg, session_date as max_reps_date
  from counted
  order by user_id, exercise_id, reps desc, completed_at asc
)
select
  d.user_id, d.exercise_id, d.exercise_name, d.category,
  h.heaviest_kg, h.heaviest_reps, h.heaviest_date,
  b.e1rm as best_e1rm, b.e1rm_load_kg, b.e1rm_reps, b.e1rm_date,
  v.best_set_volume_kg, v.volume_load_kg, v.volume_reps, v.volume_date,
  m.max_reps, m.max_reps_load_kg, m.max_reps_date
from exercises_done d
left join heaviest h on h.user_id = d.user_id and h.exercise_id = d.exercise_id
left join best_e1rm b on b.user_id = d.user_id and b.exercise_id = d.exercise_id
left join best_volume v on v.user_id = d.user_id and v.exercise_id = d.exercise_id
left join most_reps m on m.user_id = d.user_id and m.exercise_id = d.exercise_id;

revoke all on public.completed_sets, public.exercise_records from anon;
grant select on public.completed_sets, public.exercise_records to authenticated;
