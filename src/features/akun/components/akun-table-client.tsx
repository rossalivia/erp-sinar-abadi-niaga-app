'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, Column } from '@/components/shared/data-table';
import { BadgeStatus } from '@/components/shared/badge-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTanggalWaktu } from '@/lib/format';
import { EditPeranDialog } from './edit-peran-dialog';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const PERAN_BADGE: Record<string, { label: string; variant: 'secondary' | 'info' | 'default' }> = {
  penjualan: { label: 'Staf Penjualan', variant: 'secondary' },
  gudang: { label: 'Staf Gudang', variant: 'info' },
  manajer: { label: 'Manajer', variant: 'default' },
};

interface AkunTableClientProps {
  users: ProfileRow[];
}

export function AkunTableClient({ users }: AkunTableClientProps) {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = React.useState<ProfileRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const handleEditClick = (user: ProfileRow) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const columns: Column<ProfileRow>[] = [
    {
      header: 'Nama Lengkap',
      accessorKey: 'nama_lengkap',
      className: 'font-medium text-slate-900',
    },
    {
      header: 'Peran Akses',
      accessorKey: 'peran',
      cell: (row) => {
        const info = PERAN_BADGE[row.peran] || { label: row.peran, variant: 'secondary' as const };
        return (
          <Badge variant={info.variant} className="text-xs">
            {info.label}
          </Badge>
        );
      },
      align: 'center',
      className: 'w-36',
    },
    {
      header: 'Status Akun',
      accessorKey: 'aktif',
      cell: (row) => (
        <BadgeStatus status={row.aktif ? 'aktif' : 'nonaktif'} />
      ),
      align: 'center',
      className: 'w-28',
    },
    {
      header: 'Terdaftar Sejak',
      accessorKey: 'dibuat_pada',
      cell: (row) => formatTanggalWaktu(row.dibuat_pada),
      className: 'w-44 text-slate-500 text-xs',
    },
    {
      header: 'Aksi',
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => handleEditClick(row)}
        >
          Ubah Peran
        </Button>
      ),
      align: 'right',
      className: 'w-28',
    },
  ];

  return (
    <>
      <div className="bg-white rounded-2xl border border-white/80 shadow-neu-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(item) => item.id}
          emptyTitle="Belum ada data pengguna"
          emptyDescription="Belum ada pengguna terdaftar dalam sistem."
          zebra
        />
      </div>

      <EditPeranDialog
        user={selectedUser}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
