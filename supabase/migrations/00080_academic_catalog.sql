-- 00080_academic_catalog: head-managed list of programs/courses and year levels.
--
-- WHY: the student signup form used a hard-coded DOrSU program list
-- (apps/mobile/data/academics.ts). When the university adds or renames a
-- program, the guidance head needs to add it without a code release, and the
-- same list should drive Web forms/filters.
--
-- DESIGN:
--   * One row per option, discriminated by `kind` ('program' | 'year_level').
--     Programs carry a `faculty` so the signup picker can keep its grouped
--     presentation; year levels leave it null.
--   * The catalog is public, non-personal reference data. Students must read it
--     BEFORE they have an account, so SELECT is granted to `anon` as well as
--     `authenticated`. Only active rows are visible.
--   * The guidance head is the only writer (same rule as workspace_settings).
--   * Removing an option deletes the catalog row only; existing
--     students.program / students.year_level text is untouched.
--
-- STATEMENTS ARE IDEMPOTENT for re-application.

create table if not exists public.academic_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('program', 'year_level')),
  faculty text,
  label text not null check (length(btrim(label)) > 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_options_program_faculty_check
    check (kind <> 'program' or (faculty is not null and length(btrim(faculty)) > 0))
);

-- Case-insensitive uniqueness within a kind so "BS Nursing" and "bs nursing"
-- can't both be added.
create unique index if not exists academic_options_kind_label_uniq
  on public.academic_options (kind, lower(btrim(label)));

create index if not exists academic_options_kind_active_idx
  on public.academic_options (kind, is_active, sort_order);

alter table public.academic_options enable row level security;

drop policy if exists "academic_options_select_public" on public.academic_options;
create policy "academic_options_select_public"
  on public.academic_options for select
  to anon, authenticated
  using (is_active);

drop policy if exists "academic_options_write_head" on public.academic_options;
create policy "academic_options_write_head"
  on public.academic_options for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'guidance_head'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'guidance_head'
    )
  );

grant select on public.academic_options to anon, authenticated;

-- Keep updated_at honest on edits (no shared trigger helper is assumed).
create or replace function public.touch_academic_options_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists academic_options_touch_updated_at on public.academic_options;
create trigger academic_options_touch_updated_at
  before update on public.academic_options
  for each row execute function public.touch_academic_options_updated_at();

-- ── seed the current official DOrSU catalog ────────────────────────────────
-- Mirrors apps/mobile/data/academics.ts so nothing changes on day one. Inserts
-- are skipped when a row with the same kind + label already exists.

insert into public.academic_options (kind, faculty, label, sort_order)
values
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Agribusiness Management', 10),
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Agriculture major in Animal Science', 20),
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Agriculture major in Crop Science', 30),
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Agriculture major in Horticulture', 40),
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Biology major in Animal Biology', 50),
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Biology major in Ecology', 60),
  ('program', 'Faculty of Agriculture and Life Sciences', 'BS Environmental Science', 70),
  ('program', 'Faculty of Governance, Business and Management', 'BS Business Administration major in Financial Management', 10),
  ('program', 'Faculty of Governance, Business and Management', 'BS Hospitality Management', 20),
  ('program', 'Faculty of Computing, Data Sciences, Engineering and Technology', 'BS Information Technology', 10),
  ('program', 'Faculty of Computing, Data Sciences, Engineering and Technology', 'BS Civil Engineering', 20),
  ('program', 'Faculty of Computing, Data Sciences, Engineering and Technology', 'BS Mathematics', 30),
  ('program', 'Faculty of Computing, Data Sciences, Engineering and Technology', 'BS Mathematics with Research Statistics', 40),
  ('program', 'Faculty of Computing, Data Sciences, Engineering and Technology', 'Bachelor in Industrial Technology Management major in Automotive Technology', 50),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Elementary Education', 10),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Early Childhood Education', 20),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Special Needs Education', 30),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Physical Education', 40),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Technology and Livelihood Education major in Home Economics', 50),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Technology and Livelihood Education major in Industrial Arts', 60),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Secondary Education major in English', 70),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Secondary Education major in Filipino', 80),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Secondary Education major in Mathematics', 90),
  ('program', 'Faculty of Teacher Education', 'Bachelor of Secondary Education major in Science', 100),
  ('program', 'Faculty of Nursing and Allied Health Sciences', 'BS Nursing', 10),
  ('program', 'Faculty of Criminal Justice Education', 'BS Criminology', 10),
  ('program', 'Faculty of Humanities, Social Sciences and Communication', 'BA major in Political Science', 10),
  ('program', 'Faculty of Humanities, Social Sciences and Communication', 'BS Psychology', 20),
  ('program', 'Faculty of Humanities, Social Sciences and Communication', 'BS Development Communication', 30),
  ('year_level', null, '1st Year', 10),
  ('year_level', null, '2nd Year', 20),
  ('year_level', null, '3rd Year', 30),
  ('year_level', null, '4th Year', 40)
on conflict do nothing;
