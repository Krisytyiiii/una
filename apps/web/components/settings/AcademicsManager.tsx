"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarDays, GraduationCap, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import type { AcademicProgram, AcademicYearLevel } from "@/lib/hooks/use-settings-board";
import { cn } from "@/lib/utils";

const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint";
const inputCls = "h-9 rounded-lg border-ink/15 bg-white text-[13px]";

/**
 * Head-only picklist editor (00080). The catalog is what student signup and
 * staff forms read, so adding a course here makes it selectable immediately —
 * no release needed.
 */
export function AcademicsManager({
  loading,
  saving,
  programs,
  yearLevels,
  onAddProgram,
  onAddYearLevel,
  onRemove,
}: {
  loading: boolean;
  saving: boolean;
  programs: AcademicProgram[];
  yearLevels: AcademicYearLevel[];
  onAddProgram: (faculty: string, label: string) => void;
  onAddYearLevel: (label: string) => void;
  onRemove: (id: string, label: string) => void;
}) {
  const [faculty, setFaculty] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");

  const faculties = useMemo(
    () => [...new Set(programs.map((p) => p.faculty))].sort((a, b) => a.localeCompare(b)),
    [programs]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AcademicProgram[]>();
    for (const program of programs) {
      const list = map.get(program.faculty) ?? [];
      list.push(program);
      map.set(program.faculty, list);
    }
    return [...map.entries()];
  }, [programs]);

  return (
    <div className="space-y-4" role="tabpanel">
      {/* Courses / programs */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <GraduationCap className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Courses &amp; programs</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                The list students pick from at signup. Add a new course when the university launches one.
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-ink-muted ring-1 ring-ink/10 sm:inline-flex">
            {programs.length} course{programs.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="p-5">
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              onAddProgram(faculty, course);
              setCourse("");
            }}
          >
            <div>
              <label className={labelCls} htmlFor="academic-faculty">
                Faculty
              </label>
              <Input
                id="academic-faculty"
                list="academic-faculty-options"
                className={inputCls}
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="e.g. Faculty of Nursing and Allied Health Sciences"
                disabled={loading || saving}
              />
              <datalist id="academic-faculty-options">
                {faculties.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls} htmlFor="academic-course">
                Course / program
              </label>
              <Input
                id="academic-course"
                className={inputCls}
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g. BS Pharmacy"
                disabled={loading || saving}
              />
            </div>
            <Button type="submit" size="md" className="h-9" loading={saving} disabled={loading}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add course
            </Button>
          </form>

          {loading ? (
            <div className="mt-4 grid animate-pulse gap-2" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-ink/10" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">
              No courses yet. Add the first one above.
            </p>
          ) : (
            <div className="mt-4 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
              {grouped.map(([facultyName, list]) => (
                <div key={facultyName} className="rounded-lg border border-ink/5 bg-cream/30 p-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                    {facultyName}
                  </p>
                  <ul className="mt-1.5 divide-y divide-ink/5">
                    {list.map((program) => (
                      <li key={program.id} className="flex items-center gap-2 py-1.5">
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink" title={program.label}>
                          {program.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(program.id, program.label)}
                          disabled={saving}
                          aria-label={`Remove ${program.label}`}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-white hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Year levels */}
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 bg-cream/20 px-5 py-3.5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <CalendarDays className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Year levels</h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Shown as the year-level chips at student signup.
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-ink-muted ring-1 ring-ink/10 sm:inline-flex">
            {yearLevels.length}
          </span>
        </div>

        <div className="p-5">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              onAddYearLevel(year);
              setYear("");
            }}
          >
            <Input
              className={cn(inputCls, "sm:max-w-xs")}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 5th Year"
              aria-label="New year level"
              disabled={loading || saving}
            />
            <Button type="submit" size="md" className="h-9" loading={saving} disabled={loading}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add year level
            </Button>
          </form>

          {loading ? (
            <div className="mt-4 flex animate-pulse gap-2" aria-hidden>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 w-20 rounded-full bg-ink/10" />
              ))}
            </div>
          ) : yearLevels.length === 0 ? (
            <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-[13px] text-ink-muted">
              No year levels yet. Add the first one above.
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {yearLevels.map((option) => (
                <li
                  key={option.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cream py-1 pl-3 pr-1 text-[12px] font-bold text-ink ring-1 ring-ink/5"
                >
                  {option.label}
                  <button
                    type="button"
                    onClick={() => onRemove(option.id, option.label)}
                    disabled={saving}
                    aria-label={`Remove ${option.label}`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-faint transition hover:bg-white hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
