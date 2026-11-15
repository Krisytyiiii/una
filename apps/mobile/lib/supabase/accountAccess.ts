import type { TypedSupabaseClient } from '@dorsu/supabase-client';

/**
 * The mobile app is the student surface only. Staff work in the web portal,
 * so every entry point (password login, Google, session restore) resolves the
 * caller's role before it touches `students`.
 *
 * `profiles_select_own` (00022/00060) lets an authenticated user read exactly
 * their own role row, which is all this needs.
 */
export const STUDENT_ROLE = 'student';

const ROLE_LABEL: Record<string, string> = {
  counselor: 'Guidance counselor',
  guidance_head: 'Guidance head',
  guidance_personnel: 'Guidance personnel',
  faculty: 'Faculty',
  admin: 'Administrator',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'staff';
  return ROLE_LABEL[role] ?? role.replace(/_/g, ' ');
}

export type AccountAccess =
  /** Student with a complete school record — send them into the app. */
  | { status: 'student' }
  /** A student account that still needs student number / program / year. */
  | { status: 'incomplete' }
  /** Staff account: the mobile app must refuse it. */
  | { status: 'staff'; role: string }
  | { status: 'error'; message: string };

export type RoleLookup =
  | { ok: true; role: string | null }
  | { ok: false; error: string };

/**
 * Read the signed-in caller's own role. `null` means no `profiles` row yet —
 * a brand-new auth user, which the Google flows treat as "no account".
 */
export async function readAccountRole(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<RoleLookup> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const role = (data as { role?: string | null } | null)?.role ?? null;
  return { ok: true, role };
}

/**
 * Decide what a signed-in account may do on mobile.
 *
 * A missing `profiles` row is treated as "not yet set up" rather than staff:
 * RLS forces `role = 'student'` on self-insert, so a brand-new account can
 * only ever become a student. Existence in `students` (with the three school
 * fields the app needs) is what makes an account "already in the system".
 */
export async function resolveAccountAccess(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<AccountAccess> {
  const lookup = await readAccountRole(supabase, userId);
  if (!lookup.ok) return { status: 'error', message: lookup.error };

  const role = lookup.role;
  if (role && role !== STUDENT_ROLE) return { status: 'staff', role };

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_no, program, year_level')
    .eq('profile_id', userId)
    .maybeSingle();
  if (studentError) return { status: 'error', message: studentError.message };

  const row = student as
    | { student_no: string | null; program: string | null; year_level: string | null }
    | null;
  const complete = !!row?.student_no && !!row?.program && !!row?.year_level;
  return complete ? { status: 'student' } : { status: 'incomplete' };
}

/** Route params for `/blocked` — the screen names the role it refused. */
export function blockedParams(role: string | null | undefined): { role: string } {
  return { role: role ?? 'staff' };
}
