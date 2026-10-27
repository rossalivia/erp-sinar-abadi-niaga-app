'use client';

import * as React from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme } from './theme-provider';
import { cn } from '@/lib/utils';

function subscribeEmpty() {
  return () => {};
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const isMounted = React.useSyncExternalStore(subscribeEmpty, () => true, () => false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Tutup dropdown jika klik di luar
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isMounted) {
    return (
      <div className={cn('h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse', className)} />
    );
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-[#f0f5fa] dark:hover:bg-slate-800 border border-[#e2ebf6] dark:border-slate-700/80 transition-colors cursor-pointer select-none"
        title={`Tema saat ini: ${theme === 'system' ? 'Ikuti Sistem' : theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}`}
        aria-label="Ganti tema tampilan"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4 text-amber-400" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl glass-dropdown border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-lg py-1 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Mode Tampilan
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setTheme('light');
              setIsOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors cursor-pointer text-left',
              theme === 'light'
                ? 'font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Terang</span>
            </div>
            {theme === 'light' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('dark');
              setIsOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors cursor-pointer text-left',
              theme === 'dark'
                ? 'font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Gelap</span>
            </div>
            {theme === 'dark' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme('system');
              setIsOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors cursor-pointer text-left',
              theme === 'system'
                ? 'font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <div className="flex items-center gap-2">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>Sistem</span>
            </div>
            {theme === 'system' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
          </button>
        </div>
      )}
    </div>
  );
}
