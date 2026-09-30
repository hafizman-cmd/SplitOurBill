import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kira-Kira — Split bills fairly',
  description:
    'Scan a receipt, assign items to friends, and split the bill fairly with service charge and tax included.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kira-Kira',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f1117',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="ambient-root antialiased">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="fixed -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
          <div className="fixed top-1/3 -right-24 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
          <div className="fixed -bottom-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
