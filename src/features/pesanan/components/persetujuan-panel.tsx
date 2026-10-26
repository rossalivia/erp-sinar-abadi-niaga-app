'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Send,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { BadgeStatus } from '@/components/shared/badge-status';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  ajukanPersetujuanHargaAction,
  putuskanPersetujuanHargaAction,
  batalkanPengajuanHargaAction,
  konfirmasiPesananAction,
} from '../actions';
import { formatTanggalWaktu } from '@/lib/format';
import type { PersetujuanHargaRow, StatusPesanan } from '../types';
import type { Peran } from '@/types/auth';

interface PersetujuanPanelProps {
  pesananId: string;
  nomor: string;
  statusPesanan: StatusPesanan;
  peran: Peran;
  userId: string;
  dibuatOleh: string;
  persetujuan: PersetujuanHargaRow | null;
}

export function PersetujuanPanel({
  pesananId,
  nomor,
  statusPesanan,
  peran,
  userId,
  dibuatOleh,
  persetujuan,
}: PersetujuanPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  // Modal State
  const [isAjukanOpen, setIsAjukanOpen] = React.useState(false);
  const [catatanPengajuan, setCatatanPengajuan] = React.useState('');

  const [isBatalPengajuanOpen, setIsBatalPengajuanOpen] = React.useState(false);

  const [isSetujuiOpen, setIsSetujuiOpen] = React.useState(false);
  const [catatanKeputusan, setCatatanKeputusan] = React.useState('');

  const [isTolakOpen, setIsTolakOpen] = React.useState(false);
  const [alasanTolak, setAlasanTolak] = React.useState('');
  const [alasanTolakError, setAlasanTolakError] = React.useState<string | null>(null);

  const isOwner = userId === dibuatOleh;
  const isManajer = peran === 'manajer';

  // Jika bukan draf dan tidak pernah ada persetujuan, sembunyikan panel
  if (statusPesanan !== 'draf' && !persetujuan) {
    return null;
  }

  // 1. Staf Penjualan Mengajukan Persetujuan
  async function handleAjukan() {
    setLoading(true);
    try {
      const res = await ajukanPersetujuanHargaAction({
        pesanan_id: pesananId,
        catatan_pengaju: catatanPengajuan.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal mengajukan persetujuan');
        return;
      }

      toast.success(res.message || 'Pengajuan persetujuan harga berhasil dikirim');
      setIsAjukanOpen(false);
      setCatatanPengajuan('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }

  // 2. Staf Penjualan Membatalkan Pengajuan
  async function handleBatalkanPengajuan() {
    if (!persetujuan) return;
    setLoading(true);
    try {
      const res = await batalkanPengajuanHargaAction({
        persetujuan_id: persetujuan.id,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal membatalkan pengajuan');
        return;
      }

      toast.success(res.message || 'Pengajuan persetujuan berhasil dibatalkan');
      setIsBatalPengajuanOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }

  // 3. Manajer Memutuskan: Setuju
  async function handleSetujui() {
    if (!persetujuan) return;
    setLoading(true);
    try {
      const res = await putuskanPersetujuanHargaAction({
        persetujuan_id: persetujuan.id,
        setuju: true,
        catatan_keputusan: catatanKeputusan.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menyetujui pengajuan');
        return;
      }

      toast.success(res.message || 'Persetujuan harga berhasil disetujui');
      setIsSetujuiOpen(false);
      setCatatanKeputusan('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }

  // 3b. Manajer: Setujui & Konfirmasi Sekaligus
  async function handleSetujuiDanKonfirmasi() {
    if (!persetujuan) return;
    setLoading(true);
    try {
      const res = await putuskanPersetujuanHargaAction({
        persetujuan_id: persetujuan.id,
        setuju: true,
        catatan_keputusan: catatanKeputusan.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menyetujui pengajuan');
        return;
      }

      const konf = await konfirmasiPesananAction(pesananId);
      if (!konf.success) {
        toast.error(konf.message || 'Gagal mengonfirmasi pesanan');
        return;
      }

      toast.success('Persetujuan disetujui & pesanan berhasil dikonfirmasi');
      setIsSetujuiOpen(false);
      setCatatanKeputusan('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }

  // 4. Manajer Memutuskan: Tolak
  async function handleTolak() {
    if (!persetujuan) return;
    const trimmed = alasanTolak.trim();
    if (trimmed.length < 10) {
      setAlasanTolakError('Alasan penolakan minimal 10 karakter');
      return;
    }
    setAlasanTolakError(null);

    setLoading(true);
    try {
      const res = await putuskanPersetujuanHargaAction({
        persetujuan_id: persetujuan.id,
        setuju: false,
        alasan_tolak: trimmed,
      });

      if (!res.success) {
        toast.error(res.message || 'Gagal menolak pengajuan');
        return;
      }

      toast.success(res.message || 'Pengajuan persetujuan harga berhasil ditolak');
      setIsTolakOpen(false);
      setAlasanTolak('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  }

  const statusPersetujuan = persetujuan?.status;

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 shadow-none">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">
            Alur Persetujuan Harga di Bawah HPP
          </h2>
          {statusPersetujuan && (
            <BadgeStatus status={statusPersetujuan} className="ml-1" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Penjualan (pemilik draf): Ajukan saat belum ada atau ditolak/kedaluwarsa/dibatalkan */}
          {statusPesanan === 'draf' && isOwner && (!statusPersetujuan || ['ditolak', 'kedaluwarsa', 'dibatalkan'].includes(statusPersetujuan)) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAjukanOpen(true)}
              className="text-xs h-8 border-slate-300"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Ajukan Persetujuan Harga
            </Button>
          )}

          {/* Penjualan (pemilik pengajuan) / Manajer: Batalkan saat Menunggu */}
          {statusPesanan === 'draf' && statusPersetujuan === 'menunggu' && (isOwner || isManajer) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBatalPengajuanOpen(true)}
              className="text-xs h-8 text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              <Ban className="w-3.5 h-3.5 mr-1.5" />
              Batalkan Pengajuan
            </Button>
          )}

          {/* Manajer: Setujui / Tolak saat Menunggu */}
          {statusPersetujuan === 'menunggu' && isManajer && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsTolakOpen(true)}
                className="text-xs h-8 text-rose-700 border-rose-300 hover:bg-rose-50"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Tolak
              </Button>
              <Button
                size="sm"
                onClick={() => setIsSetujuiOpen(true)}
                className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Setujui
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Body Content berdasarkan Status */}
      <div className="pt-3 text-xs text-slate-600">
        {!statusPersetujuan ? (
          <p className="text-slate-500">
            Pesanan ini berada dalam status draf. Jika terdapat harga barang di bawah HPP yang ditolak sistem saat konfirmasi, Staf Penjualan dapat mengajukan permohonan dispensasi persetujuan ke Manajer.
          </p>
        ) : statusPersetujuan === 'menunggu' ? (
          <div className="bg-amber-50/70 border border-amber-200 rounded p-3 text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <Clock className="w-4 h-4" />
              Menunggu Keputusan Manajer
            </div>
            <p>
              Diajukan oleh <span className="font-medium">{persetujuan.nama_pengaju || 'Staf'}</span> pada{' '}
              {formatTanggalWaktu(persetujuan.diajukan_pada)}.
            </p>
            {persetujuan.catatan_pengaju && (
              <p className="text-amber-800/90 italic">
                Catatan Pengajuan: &ldquo;{persetujuan.catatan_pengaju}&rdquo;
              </p>
            )}
          </div>
        ) : statusPersetujuan === 'disetujui' ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded p-3 text-emerald-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4" />
              Persetujuan Disetujui
            </div>
            <p>
              Disetujui pada {persetujuan.keputusan_pada ? formatTanggalWaktu(persetujuan.keputusan_pada) : '-'}.
              {persetujuan.berlaku_sampai && (
                <> Berlaku selama 24 jam hingga: <span className="font-semibold">{formatTanggalWaktu(persetujuan.berlaku_sampai)}</span>.</>
              )}
            </p>
            {persetujuan.catatan_keputusan && (
              <p className="text-emerald-800/90 italic">
                Catatan Manajer: &ldquo;{persetujuan.catatan_keputusan}&rdquo;
              </p>
            )}
            {statusPesanan === 'draf' && (
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-emerald-200/60 mt-1">
                {isManajer ? (
                  <>
                    <p className="text-emerald-800 font-medium">
                      Persetujuan aktif. Anda dapat langsung mengonfirmasi pesanan ini sebagai Manajer:
                    </p>
                    <Button
                      size="sm"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const res = await konfirmasiPesananAction(pesananId);
                          if (!res.success) {
                            toast.error(res.message || 'Gagal mengonfirmasi pesanan');
                            return;
                          }
                          toast.success('Pesanan berhasil dikonfirmasi');
                          router.refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="text-xs h-7 bg-emerald-800 hover:bg-emerald-900 text-white shrink-0"
                    >
                      Konfirmasi Pesanan (Manajer)
                    </Button>
                  </>
                ) : (
                  <p className="text-amber-800 font-medium">
                    Sesuai aturan BR-04, pesanan dengan harga khusus di bawah HPP yang telah disetujui wajib dikonfirmasi oleh Manajer.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : statusPersetujuan === 'ditolak' ? (
          <div className="bg-rose-50/70 border border-rose-200 rounded p-3 text-rose-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-rose-800">
              <XCircle className="w-4 h-4" />
              Pengajuan Ditolak oleh Manajer
            </div>
            <p>
              Ditolak pada {persetujuan.keputusan_pada ? formatTanggalWaktu(persetujuan.keputusan_pada) : '-'}.
            </p>
            {persetujuan.alasan_tolak && (
              <p className="text-rose-900 font-medium">
                Alasan Penolakan: &ldquo;{persetujuan.alasan_tolak}&rdquo;
              </p>
            )}
          </div>
        ) : statusPersetujuan === 'terpakai' ? (
          <div className="bg-blue-50/70 border border-blue-200 rounded p-3 text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-blue-800">
              <CheckCircle2 className="w-4 h-4" />
              Persetujuan Telah Digunakan
            </div>
            <p>
              Persetujuan ini telah resmi digunakan saat pesanan dikonfirmasi pada{' '}
              {persetujuan.dipakai_pada ? formatTanggalWaktu(persetujuan.dipakai_pada) : '-'}.
            </p>
          </div>
        ) : statusPersetujuan === 'kedaluwarsa' ? (
          <div className="bg-slate-100 border border-slate-200 rounded p-3 text-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <AlertCircle className="w-4 h-4" />
              Persetujuan Kedaluwarsa
            </div>
            <p>
              Masa berlaku persetujuan (24 jam) telah berakhir atau pesanan draf telah dimodifikasi ulang.
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-600">
            Pengajuan persetujuan harga telah dibatalkan.
          </div>
        )}
      </div>

      {/* Dialog Ajukan Persetujuan */}
      <Dialog open={isAjukanOpen} onOpenChange={setIsAjukanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Ajukan Persetujuan Harga di Bawah HPP
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Kirimkan permohonan dispensasi harga jual khusus kepada Manajer untuk pesanan {nomor}. Pesanan tidak dapat dikonfirmasi sampai disetujui.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="catatan-pengajuan" className="text-xs font-medium text-slate-700">
              Catatan / Justifikasi Pengajuan (Opsional)
            </Label>
            <Textarea
              id="catatan-pengajuan"
              value={catatanPengajuan}
              onChange={(e) => setCatatanPengajuan(e.target.value)}
              placeholder="Contoh: Diskon khusus cuci gudang pesanan partai besar..."
              rows={3}
              className="text-xs"
            />
          </div>
          <DialogFooter className="flex sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setIsAjukanOpen(false)}
              className="text-xs border-slate-300"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleAjukan}
              className="text-xs bg-slate-900 hover:bg-slate-800 text-white"
            >
              {loading ? 'Mengirimkan...' : 'Kirim Pengajuan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Batalkan Pengajuan */}
      <ConfirmDialog
        open={isBatalPengajuanOpen}
        onOpenChange={setIsBatalPengajuanOpen}
        title="Batalkan Pengajuan Persetujuan?"
        description="Pengajuan persetujuan yang sedang menunggu keputusan akan dibatalkan. Tindakan ini tidak dapat diurungkan."
        variant="destructive"
        confirmLabel={loading ? 'Membatalkan...' : 'Batalkan Pengajuan'}
        onConfirm={handleBatalkanPengajuan}
        isLoading={loading}
      />

      {/* Dialog Setujui Persetujuan (Manajer) */}
      <Dialog open={isSetujuiOpen} onOpenChange={setIsSetujuiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Setujui Persetujuan Harga?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Dengan menyetujui dispensasi harga di bawah HPP, pesanan ini dapat dikonfirmasi oleh Manajer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="catatan-keputusan" className="text-xs font-medium text-slate-700">
              Catatan Manajer (Opsional)
            </Label>
            <Textarea
              id="catatan-keputusan"
              value={catatanKeputusan}
              onChange={(e) => setCatatanKeputusan(e.target.value)}
              placeholder="Contoh: Disetujui khusus pelanggan loyal..."
              rows={2}
              className="text-xs"
            />
          </div>
          <DialogFooter className="flex sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setIsSetujuiOpen(false)}
              className="text-xs border-slate-300"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={handleSetujui}
              className="text-xs"
            >
              {loading ? 'Memproses...' : 'Setujui Saja'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleSetujuiDanKonfirmasi}
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {loading ? 'Memproses...' : 'Setujui & Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak Persetujuan (Manajer) */}
      <Dialog open={isTolakOpen} onOpenChange={setIsTolakOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-rose-700">
              Tolak Pengajuan Persetujuan Harga
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Berikan alasan penolakan yang jelas agar Staf Penjualan dapat menyesuaikan kembali harga pesanan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="alasan-tolak" className="text-xs font-medium text-slate-700">
              Alasan Penolakan <span className="text-rose-500">* (minimal 10 karakter)</span>
            </Label>
            <Textarea
              id="alasan-tolak"
              value={alasanTolak}
              onChange={(e) => {
                setAlasanTolak(e.target.value);
                if (alasanTolakError && e.target.value.trim().length >= 10) {
                  setAlasanTolakError(null);
                }
              }}
              placeholder="Tuliskan alasan penolakan secara jelas (min. 10 karakter)..."
              rows={3}
              className="text-xs"
            />
            {alasanTolakError && (
              <p className="text-[11px] text-rose-600 font-medium">{alasanTolakError}</p>
            )}
          </div>
          <DialogFooter className="flex sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setIsTolakOpen(false)}
              className="text-xs border-slate-300"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={handleTolak}
              className="text-xs bg-rose-700 hover:bg-rose-800 text-white"
            >
              {loading ? 'Memproses...' : 'Tolak Pengajuan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
