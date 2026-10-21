import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from './empty-state';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  isNumeric?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
  zebra?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'Tidak ada data',
  emptyDescription = 'Belum ada data yang tersedia.',
  emptyAction,
  className,
  zebra = false,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full border border-slate-200 rounded-md overflow-hidden bg-white p-4">
        <div className="space-y-2">
          <div className="h-7 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 bg-slate-50 rounded animate-pulse" />
          <div className="h-6 bg-slate-50 rounded animate-pulse" />
          <div className="h-6 bg-slate-50 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((col, idx) => (
            <TableHead
              key={idx}
              className={cn(
                col.align === 'right' || col.isNumeric
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : 'text-left',
                col.className
              )}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, rowIdx) => (
          <TableRow
            key={keyExtractor(row)}
            className={cn(
              zebra && rowIdx % 2 === 1 && 'bg-slate-50/50'
            )}
          >
            {columns.map((col, colIdx) => (
              <TableCell
                key={colIdx}
                className={cn(
                  col.align === 'right' || col.isNumeric
                    ? 'text-right tabular-nums'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left',
                  col.className
                )}
              >
                {col.cell
                  ? col.cell(row)
                  : col.accessorKey
                  ? String(row[col.accessorKey] ?? '-')
                  : null}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
