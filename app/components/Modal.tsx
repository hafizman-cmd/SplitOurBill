'use client';

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';
import { createPortal } from 'react-dom';

type Props = Omit<ComponentPropsWithoutRef<'div'>, 'onClose'> & {
  onClose: () => void;
};

const openDialogs: HTMLDivElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = '';

function updateBackground() {
  const top = openDialogs.at(-1);
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (!originalInert.has(child)) originalInert.set(child, child.inert);
    child.inert = top ? child !== top : originalInert.get(child) ?? false;
  }
  if (!top) {
    for (const [element, inert] of originalInert) element.inert = inert;
    originalInert.clear();
    document.body.style.overflow = originalOverflow;
  }
}

export default function Modal({ onClose, children, ...props }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openDialogs.length === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogs.push(dialog);
    updateBackground();

    const focusInside = () => {
      (dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog).focus({ preventScroll: true });
    };
    focusInside();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1) !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), textarea, select, summary, [tabindex]',
      )).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0);
      const first = targets[0];
      const last = targets.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (openDialogs.at(-1) === dialog && !dialog.contains(event.target as Node)) focusInside();
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocus);
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      updateBackground();
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
      else openDialogs.at(-1)?.focus({ preventScroll: true });
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div {...props} ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>
      {children}
    </div>,
    document.body,
  );
}
