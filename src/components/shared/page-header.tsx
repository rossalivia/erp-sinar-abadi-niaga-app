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
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-slate-200',
        className
      )}
    >
      <div className="space-y-0.5">
        <h1 className="text-base font-semibold text-slate-900 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-500">{description}</p>
        )}
      </div>
      {(action || children) && (
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {action}
          {children}
        </div>
      )}
    </div>
  );
}
