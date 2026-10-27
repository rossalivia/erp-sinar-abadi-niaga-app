import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div
      className={cn(
        'relative w-full overflow-auto max-h-[calc(100vh-230px)] min-h-[260px] rounded-2xl border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm scrollbar-thin',
        containerClassName
      )}
    >
      <table
        ref={ref}
        className={cn(
          'w-full caption-bottom text-xs border-separate border-spacing-0 bg-white dark:bg-slate-900 text-left',
          className
        )}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-[#f0f5fa] dark:bg-slate-800 text-[#0c1a30] dark:text-slate-100 font-semibold sticky top-0 z-20',
      className
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('bg-white dark:bg-slate-900 [&_tr:last-child_td]:border-b-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-[#e2ebf6] dark:border-slate-800 bg-[#f0f5fa] dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-300',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'transition-colors hover:bg-[#f0f5fa]/70 dark:hover:bg-slate-800/60 data-[state=selected]:bg-[#e5f0fd]/50 dark:data-[state=selected]:bg-slate-800/60',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'sticky top-0 z-20 h-9 px-3.5 py-2 text-left align-middle font-bold text-[#0c1a30] dark:text-slate-100 bg-[#f0f5fa] dark:bg-slate-800 border-b border-[#e2ebf6] dark:border-slate-700 shadow-[0_1px_0_0_#e2ebf6] dark:shadow-[0_1px_0_0_#334155] whitespace-nowrap [&:has([role=checkbox])]:pr-0 tracking-tight select-none',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-3.5 py-2.5 align-middle text-slate-800 dark:text-slate-200 border-b border-[#eef4fb] dark:border-slate-800/80 [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-2 text-xs text-slate-500', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
