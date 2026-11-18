# Kira-Kira (SplitTheBill)

Scan a receipt, assign items to friends, and split the bill fairly with service charge and tax included. Built for Malaysian dining (RM, SST, DuitNow).

## Features

- **AI Receipt Scanner** — upload a receipt photo; a vision model extracts line items, prices, service charge %, and tax %.
- **Item assignment** — tap names to split any item evenly across selected people.
- **Fair totals** — each person's share is proportionally scaled by service charge and tax, with cent-accurate allocation so per-person totals always sum to the grand total.
- **Payment details** — save bank/DuitNow details and a payment QR code (stored on-device) and show them when settling up.
- **Share summary** — send a text breakdown and a short guest link via WhatsApp, the native share sheet, or the clipboard. Anyone with the link can see the bill and any included payment details for 72 hours.

## Tech Stack

- [Next.js](https://nextjs.org) 15 (App Router)
- React 19, TypeScript (strict)
- Tailwind CSS 3
- lucide-react icons
- AI receipt scanning via the Gemini API (`GEMINI_API_KEY`)

## Getting Started

```bash
npm install
```

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your-key-here
TURSO_DATABASE_URL=your-database-url
TURSO_AUTH_TOKEN=your-database-token
```

The share feature creates its table on first use. Expired bills are removed during later share requests. Create links from the public deployment when sharing with other devices.

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (includes type checking) |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint with ESLint (flat config) |

## Project Structure

```
app/
  page.tsx               Main client page (state orchestration)
  layout.tsx             Root layout + metadata
  globals.css            Tailwind entry
  types.ts               Shared types (Item, ScanResponse, SplitResult)
  lib/
    utils.ts             Formatting, ids, client-side image compression
    split.ts             Pure bill-splitting math + share text builder
  components/            UI components (Header, ReceiptScanner, PeopleManager,
                         ItemList, ChargesSection, SummarySection, modals, Toast)
  api/
    scan/route.ts        Receipt OCR endpoint (AI proxy)
```

## Security Notes

### Reset admin and developer access

Admin and developer mode share the same login. Keep `ADMIN_PASSWORD` unchanged and set `ADMIN_SESSION_RESET_KEY` to a new unique value in your hosting environment, then redeploy or restart the server. Every existing admin and developer login will be rejected on its next protected request. You can log in again with the same password.

For local development, set `ADMIN_SESSION_RESET_KEY` in your gitignored `.env` and restart the dev server. Changing only your local environment does not revoke logins on the hosted app. Use the same reset key across all server instances, choose a fresh value each time, and never restore an old value, which could make old cookies valid again.

Deploying the session reset support also invalidates all cookies issued by the previous version, even if no reset key is configured. This setting is server-side only; never prefix it with `NEXT_PUBLIC_`.

Both login forms request `autocomplete="off"`, but browsers and password managers can ignore it. On a borrowed phone, decline any save-password prompt, log out after testing, and remove any saved credential from the browser/password manager. Revoking sessions does not delete saved passwords; a saved password can be used to log in again. If the password was saved and cannot be removed, change `ADMIN_PASSWORD` too.

- The API key lives only in `.env` (gitignored) and is used server-side only.
- `/api/scan` rate-limits requests per IP (10/min) and enforces a 30s upstream timeout.
- Server logs never contain API keys or receipt contents.
- Receipt photos are compressed client-side before upload.
