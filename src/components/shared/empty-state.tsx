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
        'flex flex-col items-center justify-center p-8 text-center rounded-md border border-dashed border-slate-200 bg-slate-50/50',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-xs font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-slate-500 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
