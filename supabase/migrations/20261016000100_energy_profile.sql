-- Inputs for the target calculator (Mifflin-St Jeor BMR x activity factor).
-- All optional: users can still type targets by hand. Stored so Settings can
-- recalculate without asking again. Birth year rather than a birth date keeps
-- the stored detail to what the formula needs (age in whole years, +/- 1).
--
-- No new grants or policies: profiles already has a table-level update grant
-- for authenticated and the "profiles: update own" RLS policy, which cover new
-- columns. anon has no privileges on profiles.

alter table public.profiles
  add column sex text check (sex in ('male', 'female')),
  add column birth_year smallint check (birth_year between 1900 and 2100),
  add column height_cm numeric(4, 1) check (height_cm between 100 and 250),
  add column activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra'));
