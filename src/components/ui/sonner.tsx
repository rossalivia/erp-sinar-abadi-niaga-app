'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-md group-[.toaster]:text-xs',
          description: 'group-[.toast]:text-slate-500 text-xs',
          actionButton:
            'group-[.toast]:bg-slate-900 group-[.toast]:text-white text-xs',
          cancelButton:
            'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 text-xs',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
