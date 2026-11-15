# Chekie Student — DOrSU Guidance Mobile App

The student-facing companion to the DOrSU Guidance platform. Built with **Expo SDK 58**, **expo-router**, **React 19**, and **TypeScript (strict)**, sharing domain logic, validation, and Supabase types with the web app through the monorepo packages.

Students can log in, book a session, complete a PSS-10 stress check-in, and review session/chat surfaces in the brand's "sunrise" design system.

---

## Run

From the repo root:

```bash
pnpm install
pnpm --filter @dorsu/mobile dev
```

Or from this folder:

```bash
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go.

### Environment

The app reads the shared Supabase project through `EXPO_PUBLIC_*` variables (see the root `.env.example`). Create `apps/mobile/.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Connection resolution lives in `@dorsu/supabase-client`; the app only owns the AsyncStorage session adapter (`lib/supabase/client.ts`). Never put the service-role key in a mobile env file.

### Typecheck / lint

```bash
pnpm --filter @dorsu/mobile typecheck
pnpm --filter @dorsu/mobile lint
```

---

## Routes

Flat expo-router structure (no `(auth)` / `(student)` groups):

| Route | Purpose |
|---|---|
| `/` | Launch gate: existing session → Home, returning visitor → Login, brand-new install → three-page onboarding carousel (chat, booking, check-ins). `?replay=1` (from Profile) reopens the carousel |
| `/login` | Email + password sign-in via Supabase Auth; **Continue with Google** signs in an existing student only (a Google email with no Chekie account gets a "create an account first" dialog); staff accounts are refused; backfills a missing profile/student row |
| `/register` | Student self-registration (name, email, student no., program, year level, strong password) or **Sign up with Google** (an already-registered Google email gets a "log in instead" dialog; new ones finish school details on the same screen via `?google=1`). Supabase email confirmation is ON, so rows are created at first login |
| `/blocked` | Staff-account dead end: names the detected role, signs the session out, and points counselors/heads/faculty/admins to the web portal |
| `/auth/callback` | OAuth return point for `dorsu-mental://auth/callback?code=…`: exchanges the PKCE code (or reuses the session the in-app browser already created), applies the sign-in/sign-up rule, then routes to Home, the school-details form, or `/blocked` |
| `/(tabs)/home` | Student home: next session from Supabase (tap the card for the shared details/cancel sheet), quick actions, breathing exercise, mood check. Announcements are **not** listed here — the header megaphone opens `/announcements` |
| `/(tabs)/sessions` | Upcoming / Past / Canceled tabs from Supabase with an animated segmented control: a summary strip (upcoming / completed / check-ins), a deep-blue "next up" spotlight for the soonest session, and cards with date badge, counselor monogram, check-in state, rating, cancel, reschedule, and message actions. Tap a card for the details sheet |
| `/(tabs)/profile` | Identity hero from `profiles` + `students` (photo or monogram, alias, role, member-since), live upcoming/completed/check-in stats, quick actions (book, check-in, messages), DOrSU record details, privacy/photo-sharing + alias card, notification/announcement/onboarding shortcuts, avatar editing, pull-to-refresh, animated skeleton, and confirmed log out |
| `/announcements` | Published announcements from the Guidance Office with `All / Events / Notices` filter tabs (a row is an event when `event_date` is set), counts, pull-to-refresh, and expandable cards |
| `/book` | Booking step 1 of 2: concern, mode (in person / online), day and time, anonymous toggle |
| `/check-in` | Booking step 2 of 2: PSS-10 questions; submits the assessment and creates the appointment, then opens chat |
| `/chat` | Two-level messaging: the inbox lists the counselors from the student's confirmed/completed sessions (`messageableCounselors`) as cards (monogram, specialty, last message, unread dot, local search, pull-to-refresh), then the conversation. Tapping a counselor lazily calls `openThread({ counselorId })` (one open thread per counselor), sends via `sendMessage`, and replies arrive through a realtime `chat_messages` subscription. The thread groups consecutive bubbles, offers quick replies, a floating composer that grows with the draft, and a "jump to latest" pill with a new-message count when the reader scrolls up. Back from a dialog returns to the inbox; back from the inbox leaves Chat. |

Tab bar: `components/TabBar.tsx` — a floating frosted-glass dock with all five destinations (home, book, chat, sessions, profile) in one capsule, tracked by a sliding sun pill. Book and Chat are root stack screens but render the same dock at the bottom (Chat adds a `TAB_BAR_BASE` margin above the composer). `TAB_BAR_BASE` is the vertical space the floating bar occupies, so screens add it as bottom padding. Tab switching has **zero animation and no cold mount**: `(tabs)/_layout.tsx` sets `animation: 'none'` with `lazy: false` (all tabs pre-mounted), the root stack gives the dock's destinations plus the screens that return to it (`(tabs)`, `book`, `chat`, `check-in`, `notifications`, `announcements`) `animation: 'none'`, and the dock uses `router.navigate` so it never stacks duplicates. The sun pill snaps into place on first mount (Chat/Book render their own dock) and each dock button dims on press for instant feedback.

---

## What is wired vs. still mocked

**Wired to Supabase / shared services:**

- Authentication: login, logout, student registration (`registerStudentSchema`, strong-password rule), session persistence.
- **Google sign-in / sign-up:** `Continue with Google` opens the provider in an in-app browser, exchanges the PKCE code, then applies the screen's mode — **login** refuses a Google email with no Chekie account ("create an account first") and **sign-up** refuses one that already has an account ("log in instead"). New Google users finish student number/faculty/year on `/register?google=1`; staff Google accounts are signed out to `/blocked`. Setup is documented in [`docs/operations/google-signin.md`](../../docs/operations/google-signin.md).
- Profile bootstrap: `lib/supabase/ensureStudent.ts` creates the `profiles` + `students` rows for a signed-in student (RLS-safe, idempotent, alias collision retry).
- Home: upcoming appointments and notifications via `listStudentAppointments`; cancellation via `cancelAppointment`. Notifications now have a real screen (`app/notifications.tsx`) with per-item mark-read, an exact unread badge on the bell/tab bar, and a single realtime subscription (`lib/notifications-context.tsx`) scoped to the signed-in student.
- Reminders: `00065_session_reminders` runs in Postgres every minute and inserts a generic “starts in 10 minutes” notification for the student and the assigned counselor; it arrives through the same realtime bell/toast/inbox path as other notifications.
- Profile: real `profiles`, `students`, appointment and PSS-10 data. A deep-blue identity card shows the uploaded photo (signed URL) or a monogram, anonymous alias, role, member-since, and tappable upcoming/completed/check-in counts. Tapping the avatar offers choose/remove photo (`expo-image-picker` → private `avatars` bucket); the student-only “Share photo with my counselor” opt-in stays off by default with an optimistic toggle, and the alias is explained beside it. Quick-action tiles, the DOrSU record card, notification/announcement/onboarding rows, a pulsing skeleton, pull-to-refresh, and a confirmed log out round out the screen.
- Sessions: own appointments via `listStudentAppointments` (refresh on focus + pull-to-refresh), an animated Upcoming/Past/Canceled control with counts, a summary strip (upcoming / completed / check-ins, with the check-in tile opening `/check-in`), and date-badge cards showing the status, counselor monogram and specialty, pre-session check-in state, and only the applicable actions (check-in, message, reschedule, cancel). The soonest upcoming session gets the deep-blue "NEXT UP" spotlight with a countdown. Tapping the card opens the shared details sheet (semantic status badge, date/time hero with countdown, four-step journey, counselor card with message shortcut, tappable Google Meet link, reference/booked-on tiles, and sticky reschedule/cancel actions), cancel uses `cancelAppointment`, reschedule uses the shared reschedule sheet + `rescheduleAppointment` (pending/assigned at any time; confirmed sessions until 24 hours before the start — inside that window the app directs the student to the Guidance Office), and completed sessions take one rating via `submitFeedback`. Home and Sessions share the same details/cancel/reschedule sheets (`components/SessionDetailsModal.tsx`, `components/RescheduleModal.tsx`). Update attribution comes from the student-scoped `appointment_update_info(uuid)` RPC (00064); nothing from `audit_events` is exposed.
- Booking: real counselor availability from `counselor_availability` (`bookableDays` / `bookableSlots`), then `bookAppointment` / `submitPss10` (`@dorsu/shared-services`). Requests land as `pending` for the head to assign.
- Chat: the inbox is anchored on the student's counselors - `messageableCounselors` derives one contact per counselor from confirmed/completed appointments, and tapping one reuses or lazily opens the thread bound to that counselor (`openThread({ counselorId })`, idempotent per student+counselor). Contacts and threads bound to a `guidance_head` are hidden (`counselor_directory` now returns the profile role, 00074) because heads are not chat participants. Leftover/closed threads stay in a "Conversations" list underneath; there is no counselor-less "Guidance Office" thread anymore (those rows are invisible to the staff inbox, which filters by counselor id). `getThreadWithMessages` loads the selected dialog, `sendMessage` sends, and a `chat_messages` INSERT subscription delivers live staff replies. Migration `00073_chat_message_notify` also drops a generic "New message" notification on the counselor when the student writes. Back from a dialog returns to the inbox, then back from the inbox exits. Opening a dialog clears unread chat notifications and marks that thread seen for the inbox's unread dot (in-memory per visit; the OS/notification badge covers cross-launch). Unread cards sort first. Quick replies are sun-chipped suggestions with a sparkle icon and send immediately.
- Stress check: `/check-in` without booking params records the PSS-10 only (Home shortcut).
- Stress check-in: scored and persisted with the PSS-10 band; the total is never shown to the student.

**No local mock data remains in `data/mock.ts`.** That file was removed in P1. The
profile card reads `profiles` + `students`, and the PSS-10 wording/labels now come
from `@dorsu/shared-services` (`pss10-instrument.ts`). Booking day/time presentation
uses real counselor availability, not fixtures.

When adding data, keep the same flow: call `getSupabase()` and a function from
`@dorsu/shared-services` — do not add direct table logic to screens.

---

## Project structure

```
app/
  _layout.tsx          Root stack, font loading, splash, safe-area + status bar
  index.tsx            Launch gate + onboarding carousel (first launch only)
  login.tsx            Supabase email/password sign-in
  register.tsx         Student registration
  (tabs)/
    _layout.tsx        Custom tab bar
    home.tsx           Home dashboard (live data)
    sessions.tsx       Session list (live data)
    profile.tsx        Profile identity, stats, privacy + settings (live)
  book.tsx             Booking step 1
  check-in.tsx         PSS-10 + booking step 2 (live writes)
  chat.tsx             Student ↔ Guidance chat (live data + realtime)
components/            Button, Card, Chip, Field, ChatBubble, StatusChip, TabBar,
                       BottomSheet, PressableScale, MoodPicker, StarRating,
                       ProgressSegments, InitialsAvatar, mascot, illustrations
  sessions/            SessionCard, SessionTabs, SessionSkeleton
  chat/                ConversationCard, Composer
lib/
  session-format.ts        Shared date/time, title, mode and countdown labels
  supabase/client.ts       AsyncStorage-backed typed Supabase client
  supabase/ensureStudent.ts Profile/student bootstrap + friendly DB errors
  supabase/googleAuth.ts   Google OAuth (in-app browser + PKCE exchange)
  supabase/studentSetup.ts Finishes OAuth accounts; saves school details
  onboarding.ts            First-launch flag (AsyncStorage)
data/
  academics.ts              DOrSU faculties and year levels for registration
theme.ts               Colors, type scale, spacing, radii, button/input sizes, hit slop
```

---

## Design system

`theme.ts` is the single source of truth for mobile styling:

- **Palette:** cream `#FFF8E1`, ink `#14315C`, blue `#2563B8`, sun `#FFC93C`, danger `#D92D20`, plus semantic `success` / `warn` / `dangerSoft` tones that keep status badges matched to their labels.
- **Type:** DM Sans, sizes 10–16 only (`fontSize.xxs` → `fontSize.xl`).
- **Radii:** 4 for inputs/chips/accents, 16 for buttons and cards.
- **Sizes:** 32px buttons, 44px inputs, 16px screen padding, `hitSlop` on small pressables.
- **Cards:** flat white with a soft shadow and a cream underline.
- **Floating chrome:** `floatingShadow` for the tab dock and hero cards, `sheetShadow` for bottom sheets, and `glass.*` for frosted surfaces (real blur on iOS, translucent fill on Android). `BottomSheet` is the shared animated sheet with drag-to-dismiss; `PressableScale` adds the spring press dip.

Use `StyleSheet.create` for screen styles and these tokens everywhere — no ad-hoc hex values or font sizes. NativeWind is configured (metro + `global.css`) but current screens use `StyleSheet`.

Icons come from `lucide-react-native/icons/<name>` (per-icon imports keep the bundle small).

---

## Notes and gotchas

- **Monorepo Metro:** `metro.config.js` watches the workspace root and allows `.mjs` resolution so pnpm-symlinked packages and per-icon lucide imports work.
- **React 19 here, React 18 on web.** Shared packages (`@dorsu/*`) must stay framework-free; never move React-dependent UI into them.
- **Typed routes:** `experiments.typedRoutes` is on. After adding a route, restart the dev server so expo-router regenerates `.expo/types`.
- **No test runner** is configured in this repo. Verify with typecheck and a manual run.
- **Deep links:** scheme `dorsu-mental` (also allowed by the local Supabase auth config).
- **Audio:** the home breathing guide uses `expo-audio` and `assets/audio/breath-guide.mp3`.

## Related docs

- Root [`AGENTS.md`](../../AGENTS.md) — architecture rules, commands, shared-package boundaries.
- [`docs/architecture/realtime-audit.md`](../../docs/architecture/realtime-audit.md) — web realtime/notification architecture.
- [`docs/operations/google-signin.md`](../../docs/operations/google-signin.md) — Google OAuth setup for Supabase, Google Cloud, and mobile redirects.
