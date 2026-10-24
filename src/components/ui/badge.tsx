import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-tight',
  {
    variants: {
      variant: {
        default:
          'border-indigo-600/30 bg-indigo-600 text-white',
        secondary:
          'border-slate-200 bg-slate-100 text-slate-700',
        destructive:
          'border-red-500/30 bg-red-500/10 text-red-700',
        outline:
          'border-slate-300/80 bg-transparent text-slate-700',
        // Varian status ERP fungsional (Apple-style frosted pill)
        success:
          'border-emerald-500/30 bg-emerald-500/15 text-emerald-800',
        warning:
          'border-amber-500/35 bg-amber-500/15 text-amber-900',
        danger:
          'border-red-500/30 bg-red-500/15 text-red-800',
        neutral:
          'border-slate-400/30 bg-slate-500/10 text-slate-700',
        info:
          'border-blue-500/30 bg-blue-500/15 text-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
