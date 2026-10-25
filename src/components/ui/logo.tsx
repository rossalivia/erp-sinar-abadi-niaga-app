import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'full' | 'horizontal' | 'icon' | 'monochrome';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubdeskripsi?: boolean;
  inverted?: boolean;
}

/**
 * Simbol Grafis Resmi CV Sinar Abadi Niaga
 * Desain geometris 2D arsitektural: Dua pilar niaga yang menopang busur fajar emas ("Sinar"),
 * membentuk monogram terpadu "SAN" yang tenang, berwibawa, dan profesional.
 */
export function LogoIcon({
  className,
  size = 32,
  monochrome = false,
  inverted = false,
}: {
  className?: string;
  size?: number;
  monochrome?: boolean;
  inverted?: boolean;
}) {
  const primaryColor = monochrome
    ? 'currentColor'
    : inverted
    ? '#FFFFFF'
    : '#0F172A'; // Slate-900 (Corporate Ink)

  const accentColor = monochrome
    ? 'currentColor'
    : inverted
    ? '#F59E0B'
    : '#D97706'; // Amber-600 (Sinar Fajar)

  const subColor = monochrome
    ? 'currentColor'
    : inverted
    ? '#94A3B8'
    : '#475569'; // Slate-600

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {/* Dasar Balok Logistik Distribusi */}
      <rect x="4" y="24" width="32" height="10" rx="2" fill={primaryColor} />

      {/* Pilar Niaga Kiri & Kanan */}
      <rect x="4" y="10" width="8" height="12" rx="1.5" fill={primaryColor} />
      <rect x="28" y="10" width="8" height="12" rx="1.5" fill={primaryColor} />

      {/* Inti Pilar Tengah (Distribusi Terkoordinasi) */}
      <rect x="16" y="14" width="8" height="8" rx="1.5" fill={subColor} />

      {/* Busur Fajar Keemasan (Sinar Abadi) */}
      <path
        d="M12 8C12 5.79086 15.5817 4 20 4C24.4183 4 28 5.79086 28 8"
        stroke={accentColor}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="20" cy="8.5" r="2" fill={accentColor} />
    </svg>
  );
}

/**
 * Komponen Logo CV Sinar Abadi Niaga
 * Menerapkan tipografi korporat yang tenang, berwibawa, dan proporsional.
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
    xs: 22,
    sm: 28,
    md: 36,
    lg: 44,
    xl: 56,
  }[size];

  const titleSizeClass = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  }[size];

  const descSizeClass = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  const subSizeClass = {
    xs: 'text-[8px]',
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
    xl: 'text-xs',
  }[size];

  if (variant === 'icon') {
    return (
      <div className={cn('inline-flex items-center justify-center', className)} {...props}>
        <LogoIcon size={iconPixel} inverted={inverted} />
      </div>
    );
  }

  if (variant === 'monochrome') {
    return (
      <div className={cn('flex items-center gap-2.5 text-slate-900', className)} {...props}>
        <LogoIcon size={iconPixel} monochrome />
        <div className="flex flex-col">
          <span className={cn('font-bold tracking-tight uppercase leading-tight', titleSizeClass)}>
            CV Sinar Abadi Niaga
          </span>
          <span className={cn('font-medium text-slate-700 tracking-normal', descSizeClass)}>
            Distributor Kebutuhan Toko Kelontong
          </span>
          {showSubdeskripsi && (
            <span className={cn('text-slate-500', subSizeClass)}>
              Bekasi &amp; Jakarta Timur &bull; 1 Gudang &bull; Tempo
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        className
      )}
      {...props}
    >
      <LogoIcon size={iconPixel} inverted={inverted} />
      <div className="flex flex-col justify-center leading-tight">
        <span
          className={cn(
            'font-bold tracking-tight',
            titleSizeClass,
            inverted ? 'text-white' : 'text-slate-900'
          )}
        >
          CV Sinar Abadi Niaga
        </span>

        <span
          className={cn(
            'font-medium tracking-normal mt-0.5',
            descSizeClass,
            inverted ? 'text-slate-300' : 'text-slate-600'
          )}
        >
          Distributor Kebutuhan Toko Kelontong
        </span>

        {showSubdeskripsi && (
          <span
            className={cn(
              'mt-0.5',
              subSizeClass,
              inverted ? 'text-slate-400' : 'text-slate-500'
            )}
          >
            Bekasi &amp; Jakarta Timur &bull; 1 Gudang &bull; Tempo
          </span>
        )}
      </div>
    </div>
  );
}
