import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-slate-950',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-slate-900 text-white',
        secondary:
          'border-transparent bg-slate-100 text-slate-800',
        destructive:
          'border-transparent bg-red-100 text-red-800 border-red-200',
        outline: 'text-slate-700 border-slate-300',
        // Varian status ERP (warna redup, kontras teks tinggi)
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-800',
        warning:
          'border-amber-200 bg-amber-50 text-amber-800',
        danger:
          'border-red-200 bg-red-50 text-red-800',
        neutral:
          'border-slate-200 bg-slate-100 text-slate-700',
        info:
          'border-blue-200 bg-blue-50 text-blue-800',
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
