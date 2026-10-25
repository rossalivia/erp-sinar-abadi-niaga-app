import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none btn-neu',
  {
    variants: {
      variant: {
        default:
          'bg-[#0c1b3a] text-white shadow-neu-sm hover:bg-[#162d5c] active:bg-[#071024] active:shadow-neu-inset',
        destructive:
          'bg-red-600 text-white shadow-neu-sm hover:bg-red-700 active:bg-red-800 active:shadow-neu-inset',
        outline:
          'bg-white border border-[#e2ebf6] text-[#0c1a30] shadow-neu-sm hover:bg-[#f0f5fa] hover:text-[#2563eb] hover:border-blue-300 active:shadow-neu-inset',
        secondary:
          'bg-[#eaf1f9] text-[#0c1a30] border border-[#d6e3f2] shadow-xs hover:bg-[#dee9f5] active:shadow-neu-inset',
        ghost:
          'text-slate-600 hover:bg-[#f0f5fa] hover:text-[#0c1a30] active:bg-[#e4edf7]',
        link: 'text-[#2563eb] underline-offset-4 hover:underline p-0 h-auto font-medium',
      },
      size: {
        default: 'h-8 px-3.5 py-1.5',
        sm: 'h-7 rounded-lg px-2.5 text-xs',
        lg: 'h-9 rounded-xl px-4 text-sm',
        icon: 'h-8 w-8 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
