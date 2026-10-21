import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id?: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  error,
  required,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col space-y-1', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <div>{children}</div>
      {error && (
        <p className="text-[11px] text-red-600 font-medium leading-none mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
