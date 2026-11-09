import React from 'react';
import { GlassColorVariant } from '../types/payroll';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassColorVariant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const VARIANT_STYLES: Record<GlassColorVariant, string> = {
  emerald:
    'bg-gradient-to-r from-emerald-500/30 via-emerald-600/25 to-teal-500/30 hover:from-emerald-500/45 hover:to-teal-500/45 text-emerald-50 border-emerald-400/45 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.35)]',
  cyan:
    'bg-gradient-to-r from-cyan-500/30 via-sky-500/25 to-blue-500/30 hover:from-cyan-500/45 hover:to-blue-500/45 text-cyan-50 border-cyan-400/45 shadow-[0_4px_20px_-4px_rgba(6,182,212,0.35)]',
  indigo:
    'bg-gradient-to-r from-indigo-500/30 via-blue-600/25 to-violet-500/30 hover:from-indigo-500/45 hover:to-violet-500/45 text-indigo-50 border-indigo-400/45 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.35)]',
  violet:
    'bg-gradient-to-r from-violet-500/30 via-purple-600/25 to-fuchsia-500/30 hover:from-violet-500/45 hover:to-fuchsia-500/45 text-violet-50 border-violet-400/45 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.35)]',
  amber:
    'bg-gradient-to-r from-amber-500/30 via-orange-500/25 to-yellow-500/30 hover:from-amber-500/45 hover:to-orange-500/45 text-amber-50 border-amber-400/45 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.35)]',
  rose:
    'bg-gradient-to-r from-rose-500/30 via-pink-600/25 to-red-500/30 hover:from-rose-500/45 hover:to-red-500/45 text-rose-50 border-rose-400/45 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.35)]',
  teal:
    'bg-gradient-to-r from-teal-500/30 via-emerald-500/25 to-cyan-500/30 hover:from-teal-500/45 hover:to-cyan-500/45 text-teal-50 border-teal-400/45 shadow-[0_4px_20px_-4px_rgba(20,184,166,0.35)]',
  sky:
    'bg-gradient-to-r from-sky-500/25 via-slate-600/25 to-cyan-600/25 hover:from-sky-500/40 hover:to-cyan-600/40 text-sky-100 border-sky-400/35 shadow-[0_4px_16px_-4px_rgba(14,165,233,0.25)]',
};

const SIZE_STYLES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-xs sm:text-sm rounded-xl gap-2',
  lg: 'px-5 py-3 text-sm sm:text-base rounded-xl gap-2.5',
};

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'emerald',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`glass-btn inline-flex items-center justify-center font-semibold border select-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-45 disabled:pointer-events-none cursor-pointer ${
        VARIANT_STYLES[variant]
      } ${SIZE_STYLES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
