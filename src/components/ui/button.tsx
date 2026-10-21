import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-slate-900 text-white shadow-none hover:bg-slate-800 active:bg-slate-950',
        destructive:
          'bg-red-600 text-white shadow-none hover:bg-red-700 active:bg-red-800',
        outline:
          'border border-slate-300 bg-white text-slate-800 shadow-none hover:bg-slate-50 active:bg-slate-100',
        secondary:
          'bg-slate-100 text-slate-900 shadow-none hover:bg-slate-200 active:bg-slate-300',
        ghost:
          'text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
        link: 'text-slate-900 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 rounded-md px-2.5 text-xs',
        lg: 'h-9 rounded-md px-4 text-sm',
        icon: 'h-8 w-8',
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
