# Google sign-in (web + mobile)

Both apps offer **Continue with Google** against the same Supabase project.
The feature is implemented in code; it starts working once the two dashboards
below are configured. Nothing in the repo stores a Google secret.

---

## 1. Supabase → Authentication → Providers → Google

1. Enable **Google**.
2. Paste the **Client ID** and **Client secret** from Google Cloud (step 2).
3. Save.

## 2. Google Cloud Console → APIs & Services → Credentials

1. Create an **OAuth client ID** of type **Web application**.
2. Add an **Authorized redirect URI**:

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   This is Supabase's callback, **not** the app's. There is only one entry
   needed for web, iOS, and Android.
3. Copy the client ID / secret into Supabase (step 1).

## 3. Supabase → Authentication → URL Configuration

This is the step that breaks Google sign-in most often. Supabase only
returns the browser to a URL that matches this list. If it does not match,
Supabase **silently falls back to the Site URL** and the browser is sent
somewhere the app cannot finish the PKCE exchange — usually a spinner that
never resolves.

Set **Site URL** (one value, must include the scheme):

```
http://localhost:3000                      # local development
https://<your-production-domain>           # deployed
```

Add every redirect the apps can return to:

| Environment | Redirect URL |
|---|---|
| Web (local) | `http://localhost:3000/**` |
| Web (local, alternate host) | `http://127.0.0.1:3000/**` |
| Web (production) | `https://<your-domain>/**` |
| Mobile dev build / TestFlight / Play | `dorsu-mental://**` |
| Expo Go (tunnel / dev-server hostname) | `exp://**` |
| Expo Go (LAN IP, e.g. `exp://192.168.1.248:8081/**`) | **must be added per IP** — `exp://**` does not cover raw IP hosts |

`supabase/config.toml` already lists the local values:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "exp://**", "dorsu-mental://**"]
```

Hosted projects do **not** read `config.toml` — set these in the dashboard.

> **Current hosted project (`xueqvjozlyayggsyfzsq`):** Site URL is
> `https://chekie.vercel.app`. `dorsu-mental://**`, `exp://**`, and
> `https://chekie.vercel.app/**` are allowlisted (verified against
> `/auth/v1/verify`), so dev builds and TestFlight/Play return to the app.

### Expo Go over LAN falls back to the website (known limitation)

Verified against the hosted project:

| `redirect_to` | Result |
|---|---|
| `exp://abc.example.com:8081/--/auth/callback` | honored (`exp://**` matches hostnames) |
| `exp://127.0.0.1:8081/--/auth/callback` | honored |
| `exp://192.168.1.248:8081/--/auth/callback` | **falls back to Site URL** |
| `exp://my-tunnel.exp.direct/--/auth/callback` | honored |

`exp://**` matches *hostnames*, not raw IPv4 hosts, so scanning the Metro QR
code over the office/school Wi-Fi (`exp://192.168.x.x:8081/--/…`) sends the
browser to the web portal and `openAuthSessionAsync` reports a dismissal.
Workarounds, best first:

1. `npx expo start --tunnel` — the hostname becomes `<name>.exp.direct` (or
   `u.expo.dev`), which `exp://**` already allows. No dashboard change.
2. Add the exact origin to Redirect URLs, e.g. `exp://192.168.1.248:8081/**`.
   This must be re-done whenever the LAN IP changes.
3. Use a development build / TestFlight / Play build — those use
   `dorsu-mental://auth/callback`, which is already allowed.

`continueWithGoogle` logs the exact `redirectTo` while `__DEV__` and, if the
browser is dismissed after >4s, returns an error naming the URL that has to be
allowlisted. Check the Metro terminal before guessing.

### Diagnosing a misconfigured project (no Google login needed)

`/auth/v1/verify` with an invalid token redirects to `redirect_to` when that
URL is allowlisted, and to the configured Site URL when it is not. Use it to
read the live configuration:

```bash
# Allowlisted? -> Location starts with the full URL you passed.
curl -s -D - -o NUL \
  "https://<ref>.supabase.co/auth/v1/verify?token=x&type=signup&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fconfirm" \
  | grep -i '^location:'

# Not allowlisted? -> Location is your Site URL (here it is malformed).
# Location: localhost:3000#error=...
```

In this project's hosted instance only `http://127.0.0.1:3000/**` was
allowlisted while the Site URL was stored as `localhost:3000` **without a
scheme**. As a result `http://localhost:3000/auth/confirm` fell back to
`Location: localhost:3000?code=...`, which browsers cannot follow — the
Google flow appears to hang after the account picker. Fixing the dashboard
values above resolves it; opening the app at `http://127.0.0.1:3000` is a
temporary local workaround because that origin is already allowlisted.

---

## How each app uses Google

### Web

`apps/web/components/auth/GoogleButton.tsx` → `signInWithOAuth` (PKCE) →
Supabase → `/auth/confirm?code=...` → exchanges the code, then routes by
profile: existing users go to their role home, pending staff to
`/pending-approval`, and first-time web users to `/register/role` where they
pick Faculty or Guidance Counselor (students use the mobile app). The profile
is written afterwards by `/api/auth/oauth-profile`. Both staff roles start
pending; after head approval they add their real name/employee details on
`/complete-profile` (00076).

### Mobile

`apps/mobile/lib/supabase/googleAuth.ts` (`continueWithGoogle(mode)`):

1. `signInWithOAuth` with `skipBrowserRedirect: true` and
   `redirectTo = Linking.createURL('auth/callback')`.
2. Opens the provider in an in-app browser (`expo-web-browser`).
3. Reads `code` from the returned deep link and calls
   `exchangeCodeForSession` (PKCE verifier is in AsyncStorage).
4. Reads the caller's own `profiles.role`. Supabase creates an auth user for
   any Google account, so the `profiles` row is what marks a real Chekie
   account. The screen decides what happens next:

   | Situation | `mode: 'signin'` (login screen) | `mode: 'signup'` (register screen) |
   |---|---|---|
   | Staff role | Signed out → `/blocked` | Signed out → `/blocked` |
   | No `profiles` row yet | Signed out → "No account found, create one first" dialog | `finishOAuthAccount()` creates the rows → school-details step |
   | Student profile exists | Into the app (or school details if missing) | Signed out → "Account already exists, log in" dialog |

   Neither mode writes a `students` row for a staff account, and sign-in never
   silently creates an account.

Because Google never supplies school details, a student who is missing them is
routed to `/register?google=1` — the same screen in a "Finish your account"
mode that asks only for student number, faculty, and year level. Existing
students skip it.

**Fallback route.** `WebBrowser.openAuthSessionAsync` normally intercepts
`dorsu-mental://auth/callback` and hands the URL back to `continueWithGoogle`.
On Android (and on a cold start) the OS can deliver the same link to
expo-router instead, so `apps/mobile/app/auth/callback.tsx` exists as a real
route: it exchanges the single-use code (or reuses the session the browser
path already created), applies the same mode rules, and routes on. Without it
the deep link shows expo-router's "Unmatched Route" screen. The mode is parked
in AsyncStorage before the provider opens so the callback knows whether the
user pressed *Continue with Google* or *Sign up with Google*.

`apps/mobile/lib/supabase/client.ts` must keep `flowType: 'pkce'` and
`detectSessionInUrl: false`; the app owns the redirect.

---

## Verifying

1. Web: log out → `/login` → Continue with Google → lands on the role home.
2. Mobile: log out → Continue with Google → consent → app returns.
   - Existing student → Home.
   - New student → "Finish your account" → Home after saving.
   - Google email that was never registered (login screen) → signed out,
     "No account found" dialog → Create student account.
   - Google email that is already registered (register screen) → signed out,
     "Account already exists" dialog → Log in.
   - Staff account → signed out → `/blocked` (web portal).
   - New faculty/counselor (web) → pending approval → `/complete-profile` after
     the guidance head approves.
3. Cancel the consent screen → no error, no session, stay on login.

## Common failures

| Symptom | Cause |
|---|---|
| `redirect_uri_mismatch` (Google page) | Redirect URI in Google Cloud is not `https://<ref>.supabase.co/auth/v1/callback` |
| Spinner after picking a Google account, never returns | Site URL/Redirect URLs missing or malformed (no scheme, missing `/**`, wrong host). Supabase falls back to the Site URL; see §3 |
| Returns to login with no session | Mobile redirect scheme missing from Supabase URL Configuration |
| `provider is not enabled` | Google provider disabled in Supabase |
| "This email already has an account" | The email already signs in with a password; use that login |
| Works on web, fails in Expo Go | `exp://**` missing from the redirect allowlist |
