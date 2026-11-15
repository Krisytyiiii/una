import type { TypedSupabaseClient } from '@dorsu/supabase-client';
import { STUDENT_ROLE, roleLabel } from './accountAccess';

function isConflict(message: string): boolean {
  return /duplicate|unique|23505|already exists|already registered/i.test(message);
}

function makeAlias(): string {
  return `Client-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function friendlyDbError(message: string): string {
  if (/student_no/i.test(message) && isConflict(message)) {
    return 'That student number is already registered.';
  }
  if (isConflict(message)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  return message;
}

/**
 * Outcome of the idempotent student-row bootstrap.
 *
 * `notStudent` is kept separate from a plain error so callers can sign the
 * account out and send it to `/blocked` instead of showing a generic failure.
 */
export type EnsureStudentOutcome =
  | { ok: true }
  | { ok: false; error: string; notStudent?: false }
  | { ok: false; error: string; notStudent: true; role: string };

export function notStudentMessage(role: string | null | undefined): string {
  return `This is a ${roleLabel(role)} account. Please use the Chekie website instead.`;
}

/**
 * Ensure `profiles` + `students` rows exist for an authenticated student.
 * RLS (00030 `profiles_insert_own_student`, `students_insert_own`) lets a
 * signed-in user insert exactly their own rows with role forced to
 * 'student'. Safe to call on every login: existing rows are left alone.
 *
 * The role is checked first: `students_insert_own` only requires
 * `profile_id = auth.uid()`, so without this a staff session could mint a
 * student row for itself. Staff accounts are returned as `notStudent` and no
 * write is attempted.
 */
export async function ensureStudentRows(
  supabase: TypedSupabaseClient,
  userId: string,
  fields: {
    email: string;
    fullName: string;
    studentNo?: string;
    program?: string;
    yearLevel?: string;
    /** Optional signup demographics (00079) — copied onto the student row. */
    gender?: 'male' | 'female' | 'prefer_not_to_say';
    birthdate?: string;
  },
): Promise<EnsureStudentOutcome> {
  const { data: profile, error: profileReadError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();
  if (profileReadError) return { ok: false, error: profileReadError.message };
  const profileRow = profile as { id: string; role?: string | null } | null;
  if (profileRow?.role && profileRow.role !== STUDENT_ROLE) {
    return {
      ok: false,
      notStudent: true,
      role: profileRow.role,
      error: notStudentMessage(profileRow.role),
    };
  }
  if (!profileRow) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      email: fields.email,
      role: 'student',
      full_name: fields.fullName,
    });
    if (profileError && !isConflict(profileError.message)) {
      return { ok: false, error: profileError.message };
    }
  }
  // The `students` row is what bookings/PSS-10 reference (appointments.student_id),
  // so it must exist even for legacy accounts that signed up before the
  // student number was stored in auth metadata. `student_no` is nullable since
  // migration 00020, so we can mint the row and let Guidance fill it in later.
  const { data: student, error: studentReadError } = await supabase
    .from('students')
    .select('profile_id')
    .eq('profile_id', userId)
    .maybeSingle();
  if (studentReadError) return { ok: false, error: studentReadError.message };
  if (!student) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error: studentError } = await supabase.from('students').insert({
        profile_id: userId,
        student_no: fields.studentNo,
        program: fields.program ?? null,
        year_level: fields.yearLevel ?? null,
        gender: fields.gender ?? null,
        birthdate: fields.birthdate ?? null,
        anonymous_alias: makeAlias(),
      });
      if (!studentError) return { ok: true };
      if (/anonymous_alias/i.test(studentError.message) && isConflict(studentError.message)) {
        continue; // alias collision — retry with a fresh one
      }
      if (/student_no/i.test(studentError.message) && /null|not-null/i.test(studentError.message)) {
        return {
          ok: false,
          error: 'Your student number is missing. Please re-register or contact the Guidance Office.',
        };
      }
      return { ok: false, error: studentError.message };
    }
    return { ok: false, error: 'Could not finish account setup. Please try again.' };
  }
  return { ok: true };
}
