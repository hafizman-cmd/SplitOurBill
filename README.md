# Kira-Kira (SplitTheBill)

Scan a receipt, assign items to friends, and split the bill fairly with service charge and tax included. Built for Malaysian dining (RM, SST, DuitNow), works entirely in the browser.

## Features

- **AI Receipt Scanner** — upload a receipt photo; a vision model extracts line items, prices, service charge %, and tax %.
- **Item assignment** — tap names to split any item evenly across selected people.
- **Fair totals** — each person's share is proportionally scaled by service charge and tax, with cent-accurate allocation so per-person totals always sum to the grand total.
- **Payment details** — save bank/DuitNow details and a payment QR code (stored on-device) and show them when settling up.
- **Share summary** — export a text breakdown via the native share sheet or clipboard.

## Tech Stack

- [Next.js](https://nextjs.org) 15 (App Router)
- React 19, TypeScript (strict)
- Tailwind CSS 3
- lucide-react icons
- AI vision API via the OpenCode gateway (`OPENCODE_ENDPOINT`, `OPENCODE_MODEL`)

## Getting Started

```bash
npm install
```

Create a `.env` file in the project root:

```
OPENCODE_API_KEY=your-key-here
# Optional overrides:
# OPENCODE_ENDPOINT=https://opencode.ai/zen/go/v1/chat/completions
# OPENCODE_MODEL=deepseek-v4-flash-vision-exp
```

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

- The API key lives only in `.env` (gitignored) and is used server-side only.
- `/api/scan` rate-limits requests per IP (10/min) and enforces a 30s upstream timeout.
- Server logs never contain API keys or receipt contents.
- Receipt photos are compressed client-side before upload.
