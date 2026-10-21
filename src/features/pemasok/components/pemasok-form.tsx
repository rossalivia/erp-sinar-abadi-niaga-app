'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { buatPemasokAction, ubahPemasokAction } from '../actions';
import type { Database } from '@/types/database';

type PemasokRow = Database['public']['Tables']['pemasok']['Row'];

interface PemasokFormProps {
  initialData?: PemasokRow;
}

export function PemasokForm({ initialData }: PemasokFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const isEdit = Boolean(initialData);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      let res;
      if (isEdit && initialData?.id) {
        res = await ubahPemasokAction(initialData.id, null, formData);
      } else {
        res = await buatPemasokAction(null, formData);
      }

      if (!res.success) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        toast.error(res.message || 'Gagal menyimpan data pemasok');
      } else {
        toast.success(res.message || 'Pemasok berhasil disimpan');
        router.push('/pemasok');
        router.refresh();
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-2xl bg-white p-6 rounded-md border border-slate-200"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          id="kode"
          label="Kode Pemasok"
          required={!isEdit}
          error={fieldErrors.kode?.[0]}
          hint={isEdit ? 'Kode tidak dapat diubah' : 'Unik, contoh: PMS-001'}
        >
          <Input
            id="kode"
            name="kode"
            defaultValue={initialData?.kode || ''}
            placeholder="PMS-001"
            className="uppercase"
            required={!isEdit}
            disabled={isPending || isEdit}
            onChange={() => setFieldErrors((prev) => ({ ...prev, kode: [] }))}
          />
        </FormField>

        <FormField
          id="nama"
          label="Nama Pemasok / Distributor"
          required
          error={fieldErrors.nama?.[0]}
        >
          <Input
            id="nama"
            name="nama"
            defaultValue={initialData?.nama || ''}
            placeholder="PT Distribusi Makmur"
            required
            disabled={isPending}
            onChange={() => setFieldErrors((prev) => ({ ...prev, nama: [] }))}
          />
        </FormField>

        <FormField
          id="telepon"
          label="Nomor Telepon"
          error={fieldErrors.telepon?.[0]}
          hint="Opsional"
        >
          <Input
            id="telepon"
            name="telepon"
            type="tel"
            defaultValue={initialData?.telepon || ''}
            placeholder="021-5551234"
            disabled={isPending}
          />
        </FormField>

        {isEdit && (
          <FormField id="aktif" label="Status Pemasok">
            <select
              id="aktif"
              name="aktif"
              defaultValue={initialData?.aktif ? 'true' : 'false'}
              disabled={isPending}
              className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
            >
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </FormField>
        )}
      </div>

      <FormField
        id="alamat"
        label="Alamat Kantor / Gudang Pemasok"
        error={fieldErrors.alamat?.[0]}
        hint="Opsional"
      >
        <Input
          id="alamat"
          name="alamat"
          defaultValue={initialData?.alamat || ''}
          placeholder="Kawasan Industri Pulogadung Blok A No. 5, Jakarta"
          disabled={isPending}
        />
      </FormField>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => router.back()}
        >
          Batal
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending
            ? 'Menyimpan...'
            : isEdit
            ? 'Perbarui Pemasok'
            : 'Simpan Pemasok'}
        </Button>
      </div>
    </form>
  );
}
