'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/shared/form-field';
import { setPeranAction } from '../actions';
import type { Database } from '@/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

interface EditPeranDialogProps {
  user: ProfileRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditPeranDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: EditPeranDialogProps) {
  const [isPending, startTransition] = React.useTransition();

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await setPeranAction(user.id, null, formData);
      if (!res.success) {
        toast.error(res.message || 'Gagal mengubah peran');
      } else {
        toast.success(res.message || 'Peran pengguna berhasil diperbarui');
        onOpenChange(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Ubah Hak Akses & Peran Pengguna
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pengguna: <span className="font-medium text-slate-800">{user.nama_lengkap}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FormField id="peran" label="Peran Pengguna" required>
              <select
                id="peran"
                name="peran"
                defaultValue={user.peran}
                disabled={isPending}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
              >
                <option value="penjualan">Staf Penjualan</option>
                <option value="gudang">Staf Gudang</option>
                <option value="manajer">Manajer</option>
              </select>
            </FormField>

            <FormField
              id="aktif"
              label="Status Akun"
              hint="Akun nonaktif tidak dapat login ke sistem"
            >
              <select
                id="aktif"
                name="aktif"
                defaultValue={user.aktif ? 'true' : 'false'}
                disabled={isPending}
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </FormField>
          </div>

          <DialogFooter className="flex sm:justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
