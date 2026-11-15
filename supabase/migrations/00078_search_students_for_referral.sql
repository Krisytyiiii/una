-- 00078_search_students_for_referral: name search for the referral form.
--
-- WHY: 00069 removed the browse-all student directory and left referral
-- creation with an exact student-number lookup, so faculty had to type the
-- name by hand even when the student already had an account. The referral
-- form is identifying by design (the paper form carries name + I.D. number),
-- so a bounded search that links an existing account is safe *if* it cannot
-- be used to enumerate the student body.
--
-- THREAT MODEL / LIMITS (all enforced in SQL, not the client):
--   * caller must be a referral creator: faculty, guidance_personnel,
--     guidance_head, admin (same set as lookup_student_for_referral).
--   * search term must be >= 2 characters — empty/one-char calls return no
--     rows, so no page-1 dump of every student.
--   * substring matching is done with position()/left(), never ILIKE on raw
--     input, so `%` and `_` cannot be injected as wildcards.
--   * results are capped at 8 with starts-with matches first.
--   * only active student profiles are searchable; deleted/suspended rows and
--     staff rows never leak into the list.
--   * no email, contact number, or college is returned — only what the paper
--     referral form already asks for (name, I.D. number, program + year).
--
-- SECURITY DEFINER because routine staff cannot read public.profiles/students
-- (00069 RLS). The role gate below is the only path to those rows, and the
-- function is idempotent for re-application.

create or replace function public.search_students_for_referral(p_query text)
returns table (
  id uuid,
  display_name text,
  student_no text,
  program text,
  year_level text,
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

-- Prefix search on the student number stays index-friendly for the
-- left(...) branch above. The name branch is a bounded scan (limit 8) over
-- active student profiles; add a pg_trgm index later if the roster grows
-- large enough to matter.
create index if not exists students_student_no_lower_idx
  on public.students (lower(student_no));
