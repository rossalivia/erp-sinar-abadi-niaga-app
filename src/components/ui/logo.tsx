import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'full' | 'horizontal' | 'icon' | 'monochrome';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubdeskripsi?: boolean;
  inverted?: boolean;
}

/**
 * Simbol Grafis SVG Resmi CV Sinar Abadi Niaga
 * Menggabungkan elemen Sinar keemasan (energi abadi), Perisai heksagon logistik,
 * dan kubus distribusi pangan FMCG / sembako.
 */
export function LogoIcon({
  className,
  size = 36,
  monochrome = false,
}: {
  className?: string;
  size?: number;
  monochrome?: boolean;
}) {
  const primaryGradId = React.useId();
  const accentGradId = React.useId();
  const sunGradId = React.useId();

  if (monochrome) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0', className)}
        aria-hidden="true"
      >
        {/* Hexagon Shield Frame */}
        <polygon
          points="50,4 90,26 90,74 50,96 10,74 10,26"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Sun Core & Rays */}
        <circle cx="50" cy="38" r="14" fill="currentColor" />
        <path
          d="M50,14 L50,18 M50,58 L50,62 M26,38 L30,38 M70,38 L74,38 M33,21 L36,24 M64,52 L67,55 M33,55 L36,52 M64,24 L67,21"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Grocery & FMCG Distribution Blocks */}
        <polygon points="50,58 26,72 26,86 50,72" fill="currentColor" opacity="0.8" />
        <polygon points="50,58 74,72 74,86 50,72" fill="currentColor" />
        <polygon points="50,58 26,72 50,86 74,72" fill="currentColor" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 filter drop-shadow-xs', className)}
      aria-hidden="true"
    >
      <defs>
        {/* Gradien Matahari Sinar Emas-Oranye */}
        <linearGradient id={sunGradId} x1="20" y1="10" x2="80" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>

        {/* Gradien Utama Royal Indigo / Blue Navy */}
        <linearGradient id={primaryGradId} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#1E1B4B" />
        </linearGradient>

        {/* Gradien Segar FMCG Groceries Emerald */}
        <linearGradient id={accentGradId} x1="30" y1="50" x2="70" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>

      {/* Perisai Heksagon Korporat */}
      <polygon
        points="50,5 91,27 91,73 50,95 9,73 9,27"
        fill={`url(#${primaryGradId})`}
        stroke="#6366F1"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Sinar-Sinar Fajar (Sinar Abadi) */}
      <g stroke={`url(#${sunGradId})`} strokeWidth="3" strokeLinecap="round" opacity="0.95">
        <line x1="50" y1="13" x2="50" y2="20" />
        <line x1="28" y1="21" x2="33" y2="26" />
        <line x1="72" y1="21" x2="67" y2="26" />
        <line x1="20" y1="40" x2="27" y2="40" />
        <line x1="80" y1="40" x2="73" y2="40" />
      </g>

      {/* Inti Matahari Keemasan */}
      <circle cx="50" cy="40" r="15" fill={`url(#${sunGradId})`} />
      <circle cx="50" cy="40" r="10" fill="#FEF3C7" opacity="0.6" />

      {/* Kubus Distribusi Logistik Sembako & FMCG */}
      <g>
        {/* Sisi Atas Kubus */}
        <polygon points="50,54 74,67 50,80 26,67" fill="#F8FAFC" opacity="0.95" />
        {/* Sisi Kiri Kubus (Sembako/Agro Emerald) */}
        <polygon points="26,67 50,80 50,91 26,78" fill={`url(#${accentGradId})`} />
        {/* Sisi Kanan Kubus (Perdagangan/Niaga Amber) */}
        <polygon points="50,80 74,67 74,78 50,91" fill={`url(#${sunGradId})`} />
      </g>

      {/* Aksen Daun FMCG / Pangan di Titik Puncak */}
      <path
        d="M50 32 C46 35 46 41 50 44 C54 41 54 35 50 32 Z"
        fill="#FFFFFF"
        opacity="0.9"
      />
    </svg>
  );
}

/**
 * Komponen Logo Lengkap CV Sinar Abadi Niaga
 */
export function Logo({
  variant = 'full',
  size = 'md',
  showSubdeskripsi = true,
  inverted = false,
  className,
  ...props
}: LogoProps) {
  const iconPixel = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 52,
    xl: 68,
  }[size];

  const titleSizeClass = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  }[size];

  const descSizeClass = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
    xl: 'text-base',
  }[size];

  const subSizeClass = {
    xs: 'text-[8px]',
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  if (variant === 'icon') {
    return (
      <div className={cn('inline-flex items-center justify-center', className)} {...props}>
        <LogoIcon size={iconPixel} />
      </div>
    );
  }

  if (variant === 'monochrome') {
    return (
      <div className={cn('flex items-center gap-3 text-slate-900', className)} {...props}>
        <LogoIcon size={iconPixel} monochrome />
        <div className="flex flex-col">
          <span className={cn('font-bold tracking-tight uppercase leading-tight', titleSizeClass)}>
            CV Sinar Abadi Niaga
          </span>
          <span className={cn('font-semibold uppercase tracking-wider text-slate-700', descSizeClass)}>
            Wholesale Trade of Groceries and FMCG
          </span>
          {showSubdeskripsi && (
            <span className={cn('text-slate-600', subSizeClass)}>
              Distribusi Sembako dan Kebutuhan Toko Kelontong
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        variant === 'full' && 'items-start sm:items-center',
        className
      )}
      {...props}
    >
      <LogoIcon size={iconPixel} />
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-extrabold tracking-tight leading-tight',
              titleSizeClass,
              inverted ? 'text-white' : 'text-slate-900'
            )}
          >
            CV Sinar Abadi Niaga
          </span>
        </div>

        <span
          className={cn(
            'font-semibold tracking-wide uppercase font-mono',
            descSizeClass,
            inverted ? 'text-amber-400' : 'text-indigo-600'
          )}
        >
          Wholesale Trade of Groceries and FMCG
        </span>

        {showSubdeskripsi && (
          <span
            className={cn(
              'leading-snug',
              subSizeClass,
              inverted ? 'text-slate-300' : 'text-slate-500'
            )}
          >
            Distribusi Sembako dan Kebutuhan Toko Kelontong
          </span>
        )}
      </div>
    </div>
  );
}
