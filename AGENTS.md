# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

Kira-Kira (SplitTheBill) is a mobile-first Next.js web app for splitting restaurant bills fairly. Users upload a receipt photo, a vision AI extracts line items / service charge / tax, users assign items to people, and the app computes each person's final payable amount (RM). Built for the Malaysian context (DuitNow, SST, RM currency). No database, no auth — all state is client-side React state plus localStorage for payment settings.

## Commands

```bash
npm run dev     # dev server at http://localhost:3000
npm run build   # production build (includes type checking)
npm run start   # serve production build
npm run lint    # ESLint (flat config, eslint.config.mjs)
```

Run `npm run build` and `npm run lint` before finishing any task. Both must pass cleanly. There is no test framework yet; if adding one, prefer Vitest and put pure-logic tests next to `app/lib/`.

## Environment

Requires a `.env` file (gitignored) with:

```
OPENCODE_API_KEY=...          # required — server-side only, never commit
OPENCODE_ENDPOINT=...         # optional — defaults to the OpenCode gateway
OPENCODE_MODEL=...             # optional — defaults to a vision-capable model
```

Never read, log, or echo values from `.env`. Never commit `.env` or secrets.

## Architecture

```
app/
  page.tsx             'use client' — owns ALL app state; passes props to components
  layout.tsx           Root layout, metadata, viewport
  globals.css          Tailwind directives only
  types.ts             Shared types: Item, ScanResponse, PersonBreakdown, SplitResult
  lib/
    utils.ts           formatRM, round2, uid, compressImage (client-side canvas JPEG), storage keys
    split.ts           PURE bill math: computeSplit(), buildShareText() — no React, no DOM
  components/          Presentational components; each modal owns its draft state + Escape handling
    Header.tsx
    ReceiptScanner.tsx   File input → onSelect(file); clears input itself
    PeopleManager.tsx    onAdd(name) returns boolean (false = duplicate, keep input text)
    ItemList.tsx         Includes manual add form (local state)
    ChargesSection.tsx   Service charge % / tax % inputs (string values, parent parses)
    SummarySection.tsx   Totals + per-person cards + QR button
    SettingsModal.tsx    Bank details + QR image upload; onSave(trimmedBank, qrDataUrl)
    PaymentQrModal.tsx   Full-screen QR display + download
    Toast.tsx
  api/scan/route.ts   POST { imageBase64 } → AI vision proxy → { items, serviceChargePercent, taxPercent }
```

### Data flow

- `page.tsx` holds `people`, `items`, charge/tax inputs, scan state, toast, and settings.
- `computeSplit()` (app/lib/split.ts) is a pure function; `page.tsx` calls it via `useMemo`. Keep it pure and side-effect free.
- Cent allocation: subtotal/service/tax/grand total are rounded to cents; per-person finals use floor + largest-remainder allocation so the displayed per-person amounts ALWAYS sum exactly to the displayed grand total. Preserve this invariant when touching the math.
- Receipt flow: client compresses the photo to a ~1600px JPEG data URL via `compressImage()`, POSTs it to `/api/scan`, which forwards it to the vision model and coerces the JSON response (`coerceScanResult`).

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
- Money is displayed via `formatRM` (`RM x.xx`); internal math uses numbers with `round2`.
- No comments in code unless requested.
- Modals: overlay div with `role="dialog"`, `aria-modal`, click-outside and Escape to close; content wrapper uses `stopPropagation`.
- Accessibility: keep aria-labels on icon-only buttons.

## Known Gaps / Future Work

- No automated tests (candidate: `computeSplit` and `coerceScanResult` are pure and easily testable).
- No component for focus trapping in modals (Escape + click-outside only).
- Rate limiting is in-memory; not suitable for multi-instance deployments.
- No PWA/manifest or offline support yet.
- Item names/prices from the AI are trusted as-is; an "edit scanned item" affordance exists only via delete + manual re-add.
