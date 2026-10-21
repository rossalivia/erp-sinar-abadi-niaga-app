'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { buatBarangAction } from '../actions';

export function BarangForm() {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await buatBarangAction(null, formData);
      if (!res.success) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        toast.error(res.message || 'Gagal menambahkan barang');
      } else {
        toast.success(res.message || 'Barang berhasil ditambahkan');
        router.push('/barang');
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-2xl bg-white p-6 rounded-md border border-slate-200"
    >
      <div className="flex items-start gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
        <div className="leading-relaxed">
          Stok awal barang baru otomatis diset <strong>0</strong>. Penambahan kuantitas fisik dilakukan secara akuntabel melalui penerimaan pembelian barang (PO) atau penyesuaian stok opname.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          id="kode"
          label="Kode Barang"
          required
          error={fieldErrors.kode?.[0]}
          hint="Unik, contoh: BRG-001"
        >
          <Input
            id="kode"
            name="kode"
            placeholder="BRG-001"
            className="uppercase"
            required
            disabled={isPending}
            onChange={() => setFieldErrors((prev) => ({ ...prev, kode: [] }))}
          />
        </FormField>

        <FormField
          id="nama"
          label="Nama Barang"
          required
          error={fieldErrors.nama?.[0]}
        >
          <Input
            id="nama"
            name="nama"
            placeholder="Minyak Goreng 2L"
            required
            disabled={isPending}
            onChange={() => setFieldErrors((prev) => ({ ...prev, nama: [] }))}
          />
        </FormField>

        <FormField
          id="satuan"
          label="Satuan"
          required
          error={fieldErrors.satuan?.[0]}
          hint="Contoh: Pcs, Dus, Kg, Botol"
        >
          <Input
            id="satuan"
            name="satuan"
            placeholder="Pcs"
            required
            disabled={isPending}
          />
        </FormField>

        <FormField
          id="stok_minimum"
          label="Batas Stok Minimum"
          required
          error={fieldErrors.stok_minimum?.[0]}
          hint="Peringatan stok menipis"
        >
          <Input
            id="stok_minimum"
            name="stok_minimum"
            type="number"
            min="0"
            defaultValue={5}
            required
            disabled={isPending}
          />
        </FormField>

        <FormField
          id="harga_jual"
          label="Harga Jual (Rp)"
          required
          error={fieldErrors.harga_jual?.[0]}
        >
          <Input
            id="harga_jual"
            name="harga_jual"
            type="number"
            min="1"
            step="500"
            placeholder="35000"
            required
            disabled={isPending}
          />
        </FormField>

        <FormField
          id="harga_pokok"
          label="Harga Pokok Awal (Rp)"
          error={fieldErrors.harga_pokok?.[0]}
          hint="Opsional (HPP awal)"
        >
          <Input
            id="harga_pokok"
            name="harga_pokok"
            type="number"
            min="0"
            step="500"
            placeholder="30000"
            disabled={isPending}
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
          {isPending ? 'Menyimpan...' : 'Simpan Barang'}
        </Button>
      </div>
    </form>
  );
}
