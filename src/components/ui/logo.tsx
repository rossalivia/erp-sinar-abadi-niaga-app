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
 * Desain geometris presisi B2B: Kubus distribusi isometrik terkoordinasi (Pemasok - Pergudangan - Toko Kelontong)
 * dengan siluet perisai stabilitas niaga dan inti fajar keemasan ("Sinar Abadi").
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
  const topFace = monochrome
    ? 'currentColor'
    : inverted
    ? '#38BDF8' // Sky-400 (Platform Distribusi Terpusat)
    : '#0284C7'; // Sky-600

  const leftFace = monochrome
    ? 'currentColor'
    : inverted
    ? '#FFFFFF' // White (Inbound / Pergudangan Pusat)
    : '#0F172A'; // Slate-900

  const rightFace = monochrome
    ? 'currentColor'
    : inverted
    ? '#94A3B8' // Slate-400 (Outbound / Armada Mitra)
    : '#334155'; // Slate-700

  const accentColor = monochrome
    ? 'currentColor'
    : inverted
    ? '#F59E0B' // Amber-500 (Komoditas Pangan & Sinar Abadi)
    : '#D97706'; // Amber-600

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0 select-none', className)}
      aria-hidden="true"
    >
      {/* Bidang Atas Isometrik: Platform & Hub Distribusi */}
      <path
        d="M20 4.5L34 12.5L20 20.5L6 12.5L20 4.5Z"
        fill={topFace}
        fillOpacity={monochrome ? 0.85 : 1}
      />

      {/* Inti Fajar Keemasan (Monogram Sinar Komoditas) */}
      <path
        d="M20 9.5L23.5 12.5L20 15.5L16.5 12.5L20 9.5Z"
        fill={accentColor}
      />

      {/* Bidang Kiri Isometrik: Pergudangan & Manajemen Persediaan */}
      <path
        d="M6 14.8L18.5 22V35.5L6 28.3V14.8Z"
        fill={leftFace}
      />

      {/* Bidang Kanan Isometrik: Penjualan & Distribusi Toko Kelontong */}
      <path
        d="M21.5 22L34 14.8V28.3L21.5 35.5V22Z"
        fill={rightFace}
        fillOpacity={monochrome ? 0.7 : 1}
      />

      {/* Titik Jangkar Presisi Logistik */}
      <circle cx="20" cy="27" r="1.5" fill={accentColor} />
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
