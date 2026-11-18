# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

Kira-Kira (SplitTheBill) is a mobile-first Next.js web app for splitting restaurant bills fairly. Users upload a receipt photo, a vision AI extracts line items / service charge / tax, users assign items to people, and the app computes each person's final payable amount (RM). Built for the Malaysian context (DuitNow, SST, RM currency). Bill drafts and payment settings stay on the device. Turso stores shared bill snapshots, analytics, and scan limits.

## Commands

```bash
npm run dev     # dev server at http://localhost:3000
npm run build   # production build (includes type checking)
npm run start   # serve production build
npm run lint    # ESLint (flat config, eslint.config.mjs)
```

Run `npm run build` and `npm run lint` before finishing any task. Both must pass cleanly. There is no test framework yet; if adding one, prefer Vitest and put pure-logic tests next to `app/lib/`.

IMPORTANT: `npm run dev` and `npm run build` share the same `.next` directory. NEVER run `npm run build` (or `npm run start`) while the dev server is running — it corrupts the dev webpack runtime (MODULE_NOT_FOUND on chunks) and forces a dev-server restart. If the user's dev server is running, verify with `npm run lint` + `npx tsc --noEmit` instead, and run `npm run build` only when the dev server is stopped.

## Environment

Set the server-side variables needed for the features you run in a gitignored `.env`:

```
GEMINI_API_KEY=...            # required for receipt scanning
GROQ_API_KEY=...              # optional vision fallback
TURSO_DATABASE_URL=...        # shared bills and telemetry
TURSO_AUTH_TOKEN=...          # token for hosted Turso
ADMIN_PASSWORD=...           # admin and developer mode
ADMIN_SESSION_RESET_KEY=...  # optional key for revoking existing admin sessions
```

Never read, log, or echo values from `.env`. Never commit `.env` or secrets.

## Architecture

```
app/
  page.tsx             'use client' — owns shared bill and app state; passes props to components
  layout.tsx           Root layout, metadata, viewport
  globals.css          Tailwind directives only
  types.ts             Shared types: Item, ScanResponse, PersonBreakdown, SplitResult
  lib/
    utils.ts           formatRM, round2, uid, compressImage (client-side canvas JPEG), readQrPayload (jsQR EMVCo decode), storage keys
    split.ts           PURE bill math: computeSplit(), buildShareText(), findAccountNumber() — no React, no DOM
    billStorage.ts     Local draft parsing and history snapshots
    currency.ts        Currency formatting and MYR equivalents
    sharedBill.ts      Shared bill snapshot type and input validation
  components/          Presentational components; modal-specific draft state stays in each modal
    Header.tsx
    ReceiptScanner.tsx   File input → onSelect(file); clears input itself
    PeopleManager.tsx    onAdd(name) returns boolean (false = duplicate, keep input text)
    ItemList.tsx         Includes manual add form (local state)
    ChargesSection.tsx   Service charge % / tax % inputs (string values, parent parses)
    SummarySection.tsx   Totals + per-person cards + QR button
    SettingsModal.tsx    Bank details + QR image upload (jsQR-decoded qrPayload); onSave(trimmedBank, qrDataUrl, qrPayload)
    ShareModal.tsx       Interactive link display + copy, WhatsApp, native share
    PaymentQrModal.tsx   Full-screen QR display + download
    ScanReviewModal.tsx  Review and edit extracted items and charges before applying
    Modal.tsx            Shared dialog with Escape handling, focus trapping and restoration
    Footer.tsx           Privacy disclosure and payment disclaimer
    Toast.tsx
  view/[id]/page.tsx   Read-only guest view: looks up a Turso snapshot with a 72-hour expiry
  api/shared-bills/route.ts  POST bill snapshot → Turso → short share ID
  api/scan/route.ts   POST { imageBase64 } → AI vision proxy → { restaurantName, items, serviceChargePercent, taxPercent, roundingAdjustment }
```

### Data flow

- `page.tsx` holds `people`, `items`, charge/tax inputs, scan state, toast, and settings.
- `computeSplit()` (app/lib/split.ts) is a pure function; `page.tsx` calls it via `useMemo`. Keep it pure and side-effect free.
- Cent allocation: subtotal/service/tax/grand total are rounded to cents; per-person finals use floor + largest-remainder allocation so the displayed per-person amounts ALWAYS sum exactly to the displayed grand total. Preserve this invariant when touching the math.
- Receipt flow: client compresses the photo to a ~1600px JPEG data URL via `compressImage()`, POSTs it to `/api/scan`, which forwards it to the vision model and coerces the JSON response (`coerceScanResult`).

### Privacy and payment status

- Drafts, history, saved payment settings, and manual payment marks are stored in this browser.
- Creating a share link stores a snapshot and any included payment details in Turso. Anyone with the link can view it for up to 72 hours.
- Receipt scans send the image to the app server and the configured AI provider. Usage events and browser/device information are sent to the telemetry API and stored in Turso.
- Paid status is manually tracked by the organizer. The app does not process payments or verify bank transfers.
- Keep the scanner, share dialog, summary, and footer disclosures aligned with these data flows.

### API route hardening (keep intact)

`app/api/scan/route.ts` intentionally includes:

- In-memory per-IP rate limiting (10 req/min; Map with cleanup). Note: per-instance only — fine for single-server deploys; use Redis if scaling horizontally.
- 30s upstream timeout via AbortController.
- Base64/data-URL payload validation and an 8M char limit.
- Error logging that NEVER includes API keys, receipt data, image payloads, or upstream response bodies. Do not re-add verbose logging of user data.
- Generic error messages to the client; details stay in server logs.

## Conventions

- TypeScript strict mode; no `any` where avoidable.
- Tailwind CSS 3 with utility classes inline (no component layer abstractions). Design language: indigo/violet gradient header, rounded-3xl cards, slate palette, lucide-react icons sized via the `size` prop.
- Component props are explicit callbacks (`onX`); state that affects multiple sections lives in `page.tsx`.
- Money is displayed via `formatMoney` in the bill currency; internal math uses numbers with `round2`.
- No comments in code unless requested.
- Use the shared `Modal` for new dialogs and preserve accessible labels, keyboard dismissal and focus restoration.
- Accessibility: keep aria-labels on icon-only buttons.

## Known Gaps / Future Work

- No automated tests (candidate: `computeSplit` and `coerceScanResult` are pure and easily testable).
- Rate limiting is in-memory; not suitable for multi-instance deployments.
- A manifest and service worker support installation and caching. Receipt scanning and hosted sharing require a network connection.
