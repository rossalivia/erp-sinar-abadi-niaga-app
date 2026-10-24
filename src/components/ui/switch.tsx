'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
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
            'w-9 h-5 rounded-full p-0.5 transition-all duration-200 ease-in-out border border-slate-300/60 shadow-neu-inset peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1',
            isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-slate-200/80',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <div
            className={cn(
              'w-4 h-4 rounded-full bg-white shadow-neu-sm transition-transform duration-200 ease-in-out',
              isChecked ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </div>
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
