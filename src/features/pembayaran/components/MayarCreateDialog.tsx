'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buatTagihanMayarAction } from '../actions';
import { formatRupiah } from '@/lib/format';

interface MayarCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pesananId: string;
  nomorPesanan: string;
  totalPesanan: number;
  namaToko: string;
  teleponToko?: string | null;
  defaultEmail?: string;
}

export function MayarCreateDialog({
  isOpen,
  onClose,
  pesananId,
  nomorPesanan,
  totalPesanan,
  namaToko,
  defaultEmail = '',
}: MayarCreateDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const [email, setEmail] = React.useState(defaultEmail);
  const [masaBerlaku, setMasaBerlaku] = React.useState('7');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast.error('Harap masukkan alamat email yang valid');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('pesananId', pesananId);
      formData.set('email', email.trim());
      formData.set('masaBerlakuHari', masaBerlaku);

      const res = await buatTagihanMayarAction(formData);

      if (res.success) {
        toast.success(res.message);
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
            <CreditCard className="w-5 h-5 text-slate-700" />
            Terbitkan Tautan Pembayaran Mayar
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Buat tautan bayar online resmi sandbox untuk pesanan <strong>{nomorPesanan}</strong> ({namaToko}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Ringkasan Nilai Tagihan */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Nomor Pesanan:</span>
              <span className="font-semibold text-slate-900">{nomorPesanan}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Total Tagihan (100%):</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {formatRupiah(totalPesanan)}
              </span>
            </div>
          </div>

          {/* Input Email Pelanggan (Wajib oleh Mayar) */}
          <div className="space-y-1.5">
            <Label htmlFor="mayar-email" className="text-xs font-medium text-slate-700">
              Email Penerima Tagihan <span className="text-red-500">*</span>
            </Label>
            <Input
              id="mayar-email"
              type="email"
              required
              placeholder="nama@tokopelanggan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="text-xs"
            />
            <p className="text-[11px] text-slate-400">
              Mayar mewajibkan alamat email untuk mengirimkan tanda terima digital.
            </p>
          </div>

          {/* Pilihan Masa Berlaku */}
          <div className="space-y-1.5">
            <Label htmlFor="mayar-tempo" className="text-xs font-medium text-slate-700">
              Masa Berlaku Tautan
            </Label>
            <Select
              value={masaBerlaku}
              onValueChange={setMasaBerlaku}
              disabled={isPending}
            >
              <SelectTrigger id="mayar-tempo" className="text-xs w-full">
                <SelectValue placeholder="Pilih masa berlaku" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Hari</SelectItem>
                <SelectItem value="7">7 Hari (Standar)</SelectItem>
                <SelectItem value="14">14 Hari (2 Minggu)</SelectItem>
                <SelectItem value="30">30 Hari (1 Bulan)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              size="sm"
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              size="sm"
              className="text-xs bg-slate-900 text-white hover:bg-slate-800"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Terbitkan Tautan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
