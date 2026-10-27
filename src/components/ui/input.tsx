import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8.5 w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800/80 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 shadow-neu-inset transition-all duration-150 file:border-0 file:bg-transparent file:text-xs file:font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:border-indigo-400 focus-visible:bg-white dark:focus-visible:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
