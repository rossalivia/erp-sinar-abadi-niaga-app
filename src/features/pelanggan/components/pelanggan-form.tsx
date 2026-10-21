'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { buatPelangganAction } from '../actions';

interface PelangganFormProps {
  isManajer: boolean;
}

export function PelangganForm({ isManajer }: PelangganFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await buatPelangganAction(null, formData);
      if (!res.success) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        toast.error(res.message || 'Gagal menambahkan pelanggan');
      } else {
        toast.success(res.message || 'Pelanggan berhasil ditambahkan');
        router.push('/pelanggan');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl bg-white p-6 rounded-md border border-slate-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          id="kode"
          label="Kode Pelanggan"
          required
          error={fieldErrors.kode?.[0]}
          hint="Contoh: PLG-001"
        >
          <Input
            id="kode"
            name="kode"
            placeholder="PLG-001"
            className="uppercase"
            required
            disabled={isPending}
            onChange={() => setFieldErrors((prev) => ({ ...prev, kode: [] }))}
          />
        </FormField>

        <FormField
          id="nama_toko"
          label="Nama Toko"
          required
          error={fieldErrors.nama_toko?.[0]}
        >
          <Input
            id="nama_toko"
            name="nama_toko"
            placeholder="Toko Maju Jaya"
            required
            disabled={isPending}
            onChange={() => setFieldErrors((prev) => ({ ...prev, nama_toko: [] }))}
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
            placeholder="08123456789"
            disabled={isPending}
          />
        </FormField>

        <FormField
          id="termin_hari"
          label="Termin Bayar"
          required
          error={fieldErrors.termin_hari?.[0]}
        >
          <select
            id="termin_hari"
            name="termin_hari"
            defaultValue="0"
            disabled={isPending}
            className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
          >
            <option value="0">0 Hari (Tunai / CBD)</option>
            <option value="7">7 Hari (1 Minggu)</option>
            <option value="14">14 Hari (2 Minggu)</option>
            <option value="30">30 Hari (1 Bulan)</option>
          </select>
        </FormField>
      </div>

      <FormField
        id="alamat"
        label="Alamat Toko"
        error={fieldErrors.alamat?.[0]}
        hint="Opsional"
      >
        <Input
          id="alamat"
          name="alamat"
          placeholder="Jl. Raya No. 123, Jakarta"
          disabled={isPending}
        />
      </FormField>

      <div className="pt-2 border-t border-slate-100">
        <FormField
          id="batas_kredit"
          label="Batas Kredit Awal (Rp)"
          error={fieldErrors.batas_kredit?.[0]}
          hint={
            isManajer
              ? 'Khusus Manajer: isi batas kredit awal'
              : 'Staf Penjualan: otomatis Rp0. Hubungi Manajer untuk menaikkan limit.'
          }
        >
          <Input
            id="batas_kredit"
            name="batas_kredit"
            type="number"
            min="0"
            step="100000"
            defaultValue={0}
            disabled={isPending || !isManajer}
            className={!isManajer ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}
          />
        </FormField>
      </div>

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
          {isPending ? 'Menyimpan...' : 'Simpan Pelanggan'}
        </Button>
      </div>
    </form>
  );
}
