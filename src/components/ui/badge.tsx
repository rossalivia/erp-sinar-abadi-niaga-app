import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-600 tracking-tight',
  {
    variants: {
      variant: {
        default:
          'border-[#0c1b3a]/20 bg-[#0c1b3a] text-white',
        secondary:
          'border-[#e2ebf6] bg-[#f0f5fa] text-[#0c1a30]',
        destructive:
          'border-[#fecaca] bg-[#feecec] text-[#991b1b]',
        outline:
          'border-[#e2ebf6] bg-white text-[#0c1a30]',
        // Varian status ERP fungsional (GeneX soft frosted pills)
        success:
          'border-[#a7f3d0] bg-[#e6f8f0] text-[#065f46]',
        warning:
          'border-[#fde68a] bg-[#fef7e6] text-[#92400e]',
        danger:
          'border-[#fecaca] bg-[#feecec] text-[#991b1b]',
        neutral:
          'border-[#e2ebf6] bg-[#f8fafc] text-slate-600',
        info:
          'border-[#bfdbfe] bg-[#e5f0fd] text-[#1e40af]',
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
