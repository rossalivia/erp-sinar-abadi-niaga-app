import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
  className,
  children,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-5 border-b border-slate-200/60',
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-500 font-normal">{description}</p>
        )}
      </div>
      {(action || children) && (
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {action}
          {children}
        </div>
      )}
    </div>
  );
}
