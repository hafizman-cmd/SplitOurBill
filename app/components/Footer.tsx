import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mx-auto mt-8 max-w-sm px-6 pb-28 text-center">
      <details className="mb-4 text-left text-sm leading-relaxed text-slate-300">
        <summary className="flex min-h-11 cursor-pointer items-center justify-center font-semibold text-slate-100">Privacy and data use <span aria-hidden="true" className="ml-2">▾</span></summary>
        <ul className="space-y-2 pb-2">
          <li><strong>On this device:</strong> This browser saves your draft, bill history, saved payment settings, and manual payment marks.</li>
          <li><strong>Receipt scanning:</strong> When you scan, the app sends the receipt image to its server and an AI provider (Google Gemini, with Groq as a fallback when available) to read it. The server uses a browser ID and IP address to enforce scan limits. Manual entry skips the photo upload.</li>
          <li><strong>Shared bills:</strong> Creating a link saves a copy of the breakdown and any included payment details on the server. Anyone with the link can view it for up to 72 hours.</li>
        </ul>
      </details>
      <p className="text-sm font-normal leading-relaxed text-slate-300">
        <ShieldCheck className="-mt-0.5 mr-1 inline-block w-3.5 h-3.5 text-slate-300" />
        Kira-Kira is a bill calculation tool and does not process payments
        directly. All fund transfers are executed securely within your
        bank&apos;s official application.
      </p>
    </footer>
  );
}
