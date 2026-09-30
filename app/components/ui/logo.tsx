import React from 'react';

interface LogoProps {
  className?: string;
  showGlow?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
};

export function KiraKiraLogo({ className, showGlow = true, size = 'md' }: LogoProps) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center ${className ?? sizeClasses[size]}`}>
      {showGlow && <div className="absolute inset-0 -z-10 rounded-xl bg-[#007AFF]/25 blur-md" />}
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-slate-900/90 p-1.5 shadow-lg backdrop-blur-md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-full w-full"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 3v17l2.5-1.5L10 20l2.5-1.5L15 20l2.5-1.5L20 20V3a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1z" fill="rgba(0, 122, 255, 0.15)" stroke="#007AFF" />
          <line x1="8.5" y1="7" x2="14.5" y2="7" stroke="#94A3B8" strokeWidth="1.5" />
          <line x1="8.5" y1="10.5" x2="12.5" y2="10.5" stroke="#94A3B8" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1="8" y1="15" x2="16" y2="15" stroke="#00F0FF" strokeWidth="2" />
          <path d="M17 2v2.5M17 4.5v2.5M17 4.5h2.5M17 4.5H14.5" stroke="#00F0FF" strokeWidth="1.75" />
        </svg>
      </div>
    </div>
  );
}
