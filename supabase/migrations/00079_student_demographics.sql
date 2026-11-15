-- 00079_student_demographics: optional gender + birthdate from mobile signup.
--
-- WHY: the official referral form (FM-DOrSU-GCTC-02) asks for the student's
-- gender and age. The student app already knows the person behind the account,
-- so collecting these two fields once at signup lets the referral form
-- autofill them instead of making faculty retype what the office already has.
--
-- PRIVACY:
--   * Both columns are nullable and optional at signup — existing accounts keep
--     working with blank values and nothing is backfilled.
--   * They are readable only through the same guarded paths as the rest of the
--     student row (owner, head/admin oversight, and the bounded referral
--     search RPC below that 00078 introduced).
--   * Age is derived at read time from birthdate, never stored, so it can't go
--     stale in the database.
--
-- STATEMENTS ARE IDEMPOTENT for re-application.

alter table public.students
  add column if not exists gender text,
  add column if not exists birthdate date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_gender_check'
  ) then
    alter table public.students
      add constraint students_gender_check
      check (
        gender is null
        or gender in ('male', 'female', 'prefer_not_to_say')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'students_birthdate_check'
  ) then
    -- Fixed bounds: CHECK constraints cannot use current_date (not immutable).
    -- Realistic-range validation (age 10–100) also happens in the Zod schema.
    alter table public.students
      add constraint students_birthdate_check
      check (
        birthdate is null
        or (birthdate > date '1900-01-01' and birthdate < date '2100-01-01')
      );
  end if;
end $$;

-- ── referral search now returns the paper-form demographics ────────────────
-- The return type changes, so the function must be dropped first
-- (CREATE OR REPLACE cannot alter OUT columns). Limits from 00078 are
-- unchanged: referral-creator roles only, min 2 characters, 8 rows max.

drop function if exists public.search_students_for_referral(text);

create or replace function public.search_students_for_referral(p_query text)
returns table (
  id uuid,
  display_name text,
  student_no text,
  program text,
  year_level text,
  gender text,
  age_years int,
  anonymous_alias text
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select btrim(coalesce(p_query, '')) as term
  )
  select
    s.id,
    coalesce(nullif(btrim(p.full_name), ''), s.anonymous_alias, 'Student') as display_name,
    s.student_no,
    s.program,
    s.year_level,
    s.gender,
    case
      when s.birthdate is null then null
      else date_part('year', age(current_date, s.birthdate))::int
    end as age_years,
    s.anonymous_alias
  from public.students s
  join public.profiles p on p.id = s.profile_id
  cross join q
  where public.current_user_role() in ('faculty', 'guidance_personnel', 'guidance_head', 'admin')
    and length(q.term) >= 2
    and p.role = 'student'
    and coalesce(p.is_active, true)
    and (
      position(lower(q.term) in lower(coalesce(p.full_name, ''))) > 0
      or left(lower(s.student_no), length(q.term)) = lower(q.term)
    )
  order by
    case
      when left(lower(coalesce(p.full_name, '')), length(q.term)) = lower(q.term) then 0
      when left(lower(s.student_no), length(q.term)) = lower(q.term) then 1
      else 2
    end,
    coalesce(p.full_name, s.anonymous_alias, 'Student'),
    s.student_no
  limit 8;
$$;

revoke all on function public.search_students_for_referral(text) from public;
grant execute on function public.search_students_for_referral(text) to authenticated;
