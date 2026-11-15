# Chekie email templates (Supabase Auth)

HTML bodies for the transactional auth emails. They mirror the app's design
tokens (`packages/ui-tokens/src/colors.ts`) and are written for real email
clients: table layout, inline styles, no flexbox, no external CSS, no scripts.

| File | Supabase template | Subject |
| --- | --- | --- |
| `confirm-signup.html` | **Confirm signup** | `Activate your Chekie account` |
| `magic-link.html` | **Magic Link** | `Your Chekie sign-in code` |
| `recovery.html` | **Reset Password** | `Reset your Chekie password` |

All three are code-based (`{{ .Token }}`), which is what the mobile app expects:
the student reads the 6-digit code and pastes it into the activation screen.
Without a token the app has nothing to verify.

---

## 1. Before pasting

**Host the logo.** Email clients cannot load files from the app bundle, so the
panda mark must be a public URL. Replace this line in every file:

```html
<img src="https://YOUR-DOMAIN/favicon.png" ... />
```

with a reachable copy of `apps/mobile/assets/favicon.png` (for example an
uploaded Storage object or `https://<vercel-domain>/favicon.png`). The mark is
decorative (`alt=""`), so a blocked image degrades to the "Chekie" wordmark
instead of showing broken-image text.

**Keep `{{ .Token }}` verbatim.** Supabase substitutes it with the 6-digit OTP.
`{{ .SiteURL }}` is the project's Site URL — used by the "Open Chekie" button
and the plain-text fallback.

## 2. Apply in the dashboard

`Authentication → Emails → <template>`:

1. Paste the subject line from the table above.
2. Switch the body editor to **Source** and paste the file contents.
3. Toggle **Preview** to sanity-check, then **Save**.

Repeat for each template. Keep **Confirm email** enabled under
`Authentication → Providers → Email`, otherwise signup returns a session
immediately and the OTP screen is never reached.

## 3. Why the design is built this way

- **Tables, not divs.** Outlook (Word renderer) ignores flex/grid; nested
  `role="presentation"` tables are the only reliable layout.
- **Inline styles only.** Gmail strips `<style>` blocks in many contexts.
- **`bgcolor` + `style` on the button cell.** Bulletproof button: the
  background survives even when the `<a>` padding is collapsed.
- **Preheader div.** Controls the inbox preview text instead of leaking the
  first heading, and is padded with zero-width joiners so the body text does
  not bleed in.
- **`color-scheme: light`.** Stops Gmail/Apple Mail dark mode from inverting the
  pale blue card into an unreadable grey.
- **Code cell padding `22px 16px 22px 28px`.** Trailing `letter-spacing` adds an
  invisible 12px after the last digit; the extra left padding re-centres it.
- **No clinical content.** Codes, emails, and timestamps only — never note
  text, PSS-10 scores, or identity data.

## 4. Verify

Send a real signup from the mobile app, open the message in at least Gmail web
and Gmail mobile, and confirm:

- the code is readable and selectable;
- the button opens the site;
- it still reads correctly with images blocked;
- it does not get clipped or horizontally scrolled on a 360px-wide viewport.
