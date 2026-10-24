'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onChange, onCheckedChange, disabled, ...props }, ref) => {
    const [isChecked, setIsChecked] = React.useState<boolean>(
      Boolean(checked ?? defaultChecked ?? false)
    );

    React.useEffect(() => {
      if (checked !== undefined) {
        setIsChecked(Boolean(checked));
      }
    }, [checked]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.checked;
      if (checked === undefined) {
        setIsChecked(next);
      }
      onChange?.(e);
      onCheckedChange?.(next);
    };

    return (
      <label className="relative inline-flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          ref={ref}
          checked={isChecked}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'h-4.5 w-4.5 rounded-md border border-slate-300/80 bg-[#f8fafc] shadow-neu-inset transition-all duration-150 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1',
            isChecked
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-neu-sm'
              : 'hover:bg-slate-100',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
        </div>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
