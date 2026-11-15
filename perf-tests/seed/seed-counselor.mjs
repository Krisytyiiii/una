/**
 * Seeds a single counselor + recurring availability (idempotent).
 *
 * Creates (or reuses) an auth user, upserts the `profiles` row with role
 * `counselor`, upserts the `counselors` row, then replaces that counselor's
 * `counselor_availability` windows.
 *
 * Defaults: counselor@dorsu.edu.ph, Mon/Wed... (weekday 1-3) 09:00-11:00.
 *
 * Usage (from perf-tests/, where deps + env loader live):
 *   node seed/seed-counselor.mjs
 *   node seed/seed-counselor.mjs --email=me@dorsu.edu.ph --name="Jane Doe"
 *
 * Password: SEED_COUNSELOR_PASSWORD from root .env (fallback: SEED_DEMO_PASSWORD).
 * Host is staging-gated by lib.mjs; secrets are never printed.
 */
import { loadEnv, assertStaging, adminClient } from "../lib.mjs";

const { url, host, serviceKey, env } = loadEnv();
assertStaging(host);
const db = adminClient({ url, serviceKey });

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=")];
    }),
);

const EMAIL = args.email || "counselor@dorsu.edu.ph";
const FULL_NAME = args.name || "Demo Counselor";
const EMPLOYEE_NO = args["employee-no"] || "DORSU-C001";
const SPECIALIZATION = args.specialization || "General";
const PASSWORD =
  env.SEED_COUNSELOR_PASSWORD ||
  args.password ||
  env.SEED_DEMO_PASSWORD ||
  "Seed#Counselor2026!";

// Mon, Tue, Wed 09:00-11:00 (weekday: 0 = Sunday).
const WINDOWS = [
  { weekday: 1, start_time: "09:00", end_time: "11:00" },
  { weekday: 2, start_time: "09:00", end_time: "11:00" },
  { weekday: 3, start_time: "09:00", end_time: "11:00" },
];

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function ensureUser() {
  const existing = await findUserByEmail(EMAIL);
  if (existing) {
    console.log(`auth user exists: ${EMAIL}`);
    return existing;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
  });
  if (error) {
    const raced = await findUserByEmail(EMAIL);
    if (raced) return raced;
    throw error;
  }
  console.log(`auth user created: ${EMAIL}`);
  return data.user.id;
}

const uid = await ensureUser();

const { error: profileErr } = await db.from("profiles").upsert(
  { id: uid, email: EMAIL, role: "counselor", full_name: FULL_NAME, is_active: true },
  { onConflict: "id" },
);
if (profileErr) throw profileErr;
console.log(`profile upserted: ${FULL_NAME} <${EMAIL}> (counselor)`);

const { data: counselor, error: counselorErr } = await db
  .from("counselors")
  .upsert(
    { profile_id: uid, employee_no: EMPLOYEE_NO, specialization: SPECIALIZATION, is_available: true },
    { onConflict: "profile_id" },
  )
  .select("id")
  .single();
if (counselorErr) throw counselorErr;
console.log(`counselor upserted: ${counselor.id} (employee_no ${EMPLOYEE_NO})`);

const { error: deleteErr } = await db
  .from("counselor_availability")
  .delete()
  .eq("counselor_id", counselor.id);
if (deleteErr) throw deleteErr;

const { error: availErr } = await db.from("counselor_availability").insert(
  WINDOWS.map((w) => ({
    counselor_id: counselor.id,
    weekday: w.weekday,
    start_time: w.start_time,
    end_time: w.end_time,
    is_recurring: true,
  })),
);
if (availErr) throw availErr;

console.log(
  `availability set: ${WINDOWS.map((w) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w.weekday]} ${w.start_time}-${w.end_time}`).join(", ")}`,
);
