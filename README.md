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

### Admin and developer access

Admin and developer mode share the same login. Use a long, unique `ADMIN_PASSWORD`. Production authentication requires a shared Turso database. The app creates the `admin_login_limit` and `admin_sessions` tables and expiry index on first use.

Login attempts share a limit of 10 submissions per 15-minute window across visitors and server instances. Sessions expire after eight hours, and signing out revokes the current session. After deploying this session update, sign in again to replace older cookies.

To revoke all admin and developer sessions, set `ADMIN_SESSION_RESET_KEY` to a fresh random value in the server environment and redeploy or restart. Use the same new key on every server instance and keep it server-side. To revoke hosted sessions, change the key on the host. Changing `ADMIN_PASSWORD` also revokes existing sessions.

On a borrowed device, decline any save-password prompt, sign out after use, and remove any saved credential from the browser or password manager. Change `ADMIN_PASSWORD` if a saved copy could still be accessed.

- The API key lives only in `.env` (gitignored) and is used server-side only.
- `/api/scan` rate-limits requests per IP (10/min) and enforces a 30s upstream timeout.
- Server logs never contain API keys or receipt contents.
- Receipt photos are compressed client-side before upload.
