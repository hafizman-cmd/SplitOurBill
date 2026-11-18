'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Toast({ message }: { message: string }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const updateContainer = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]:not([inert])'));
      setContainer(dialogs.at(-1) ?? document.body);
    };
    updateContainer();
    const observer = new MutationObserver(updateContainer);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  if (!container) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-20 z-[110] w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl bg-slate-900/90 px-4 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-sm"
    >
      {message}
    </div>,
    container,
  );
}
