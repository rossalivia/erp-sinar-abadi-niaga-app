import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  basePath,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1 && totalCount <= pageSize) {
    return (
      <div className="flex items-center justify-between px-2 py-3 text-xs text-slate-500">
        <span>Menampilkan {totalCount} data</span>
      </div>
    );
  }

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, val]) => {
      if (val !== undefined && val !== '' && key !== 'page') {
        params.set(key, val);
      }
    });
    params.set('page', String(page));
    return `${basePath}?${params.toString()}`;
  };

  const from = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t border-slate-200 text-xs text-slate-600">
      <div>
        Menampilkan <span className="font-medium text-slate-900">{from}</span>–
        <span className="font-medium text-slate-900">{to}</span> dari{' '}
        <span className="font-medium text-slate-900">{totalCount}</span> data
      </div>

      <div className="flex items-center gap-1.5">
        <span className="mr-2 text-slate-500">
          Halaman {currentPage} dari {Math.max(1, totalPages)}
        </span>

        {currentPage > 1 ? (
          <Link
            href={buildPageUrl(currentPage - 1)}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-7 px-2 text-xs flex items-center gap-1'
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Sebelumnya</span>
          </Link>
        ) : (
          <button
            disabled
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-7 px-2 text-xs flex items-center gap-1 opacity-50 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Sebelumnya</span>
          </button>
        )}

        {currentPage < totalPages ? (
          <Link
            href={buildPageUrl(currentPage + 1)}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-7 px-2 text-xs flex items-center gap-1'
            )}
          >
            <span>Selanjutnya</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <button
            disabled
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-7 px-2 text-xs flex items-center gap-1 opacity-50 cursor-not-allowed'
            )}
          >
            <span>Selanjutnya</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
