import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = 'Tidak ada data',
  description = 'Belum ada data yang tersedia untuk ditampilkan.',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-white/80 bg-white/65 backdrop-blur-md shadow-neu-sm transition-all',
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4f7fb] shadow-neu-inset text-slate-400 mb-3 border border-white/80">
        {icon || <Inbox className="h-5 w-5 text-indigo-500/70" />}
      </div>
      <h3 className="text-xs font-bold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-slate-500 max-w-sm font-normal">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
