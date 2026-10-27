'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Clock,
  RefreshCw,
  Plus,
  Search,
  MessageSquare,
  ArrowRight,
  Radio,
  Link2,
  RotateCcw,
  ClipboardPaste,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BadgeStatus } from '@/components/shared/badge-status';
import { formatRupiah, formatTanggalWaktu, formatTanggal } from '@/lib/format';
import { normalisasiNomorTelepon, buatUrlWhatsApp } from '@/features/penagihan/utils';
import { periksaStatusMayarAction } from '../actions';
import { MayarCreateDialog } from './MayarCreateDialog';
import type { TagihanMayarRow } from '../types';

export interface PesananDikirimItem {
  id: string;
  nomor: string;
  total: number;
  status: string;
  dibuat_pada: string;
  dikirim_pada: string | null;
  jatuh_tempo: string | null;
  pelanggan: {
    id: string;
    kode: string;
    nama_toko: string;
    telepon: string | null;
  } | null;
}

export interface MonitoringItem {
  id: string;
  pesanan_jual_id: string;
  nomor_pesanan: string;
  kode_pelanggan: string;
  nama_toko: string;
  telepon_toko: string | null;
  total_pesanan: number;
  status_pesanan: string;
  // Mayar specific
  tagihan_id?: string;
  mayar_invoice_id?: string;
  tautan?: string | null;
  status_tagihan?: string;
  berlaku_sampai?: string | null;
  dibuat_pada: string;
  catatan_tinjau?: string | null;
}

interface PembayaranMayarViewProps {
  tagihanList: TagihanMayarRow[];
  pesananDikirimList: PesananDikirimItem[];
  webhookUrl: string;
  hasRealKey: boolean;
  defaultCustomerEmail: string;
}

export function PembayaranMayarView({
  tagihanList,
  pesananDikirimList,
  webhookUrl,
  hasRealKey,
  defaultCustomerEmail,
}: PembayaranMayarViewProps) {
  const router = useRouter();
  const [localTagihanList, setLocalTagihanList] = React.useState<TagihanMayarRow[]>(tagihanList);
  const [localPesananDikirimList, setLocalPesananDikirimList] = React.useState<PesananDikirimItem[]>(pesananDikirimList);

  React.useEffect(() => {
    setLocalTagihanList(tagihanList);
  }, [tagihanList]);

  React.useEffect(() => {
    setLocalPesananDikirimList(pesananDikirimList);
  }, [pesananDikirimList]);

  const [urlWebhook, setUrlWebhook] = React.useState(webhookUrl);
  const [isCustomUrl, setIsCustomUrl] = React.useState(false);
  const [copiedWebhook, setCopiedWebhook] = React.useState(false);
  const [copiedLinkId, setCopiedLinkId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterTab, setFilterTab] = React.useState<'semua' | 'perlu_tautan' | 'aktif' | 'lunas'>('semua');
  const [checkingTagihanId, setCheckingTagihanId] = React.useState<string | null>(null);

  // 1. Supabase Realtime Channel: Re-render instan ketika database berubah via WebSocket
  React.useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel('realtime_pembayaran_mayar')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tagihan_mayar' },
          () => {
            router.refresh();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pesanan_jual' },
          () => {
            router.refresh();
          }
        )
        .subscribe();
    } catch {
      // Abaikan jika konfigurasi realtime client tidak aktif
    }

    return () => {
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [router]);

  // Inisialisasi custom webhook URL dari localStorage jika pernah disimpan
  React.useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem('erp_mayar_custom_webhook_url');
        if (saved && saved.trim() !== '') {
          setUrlWebhook(saved);
          setIsCustomUrl(saved !== webhookUrl);
          return;
        }
      } catch {}
      setUrlWebhook(webhookUrl);
      setIsCustomUrl(false);
    });
    return () => cancelAnimationFrame(frameId);
  }, [webhookUrl]);

  const handleChangeWebhookUrl = (val: string) => {
    setUrlWebhook(val);
    const customized = val.trim() !== webhookUrl.trim();
    setIsCustomUrl(customized);
    try {
      if (customized) {
        localStorage.setItem('erp_mayar_custom_webhook_url', val.trim());
      } else {
        localStorage.removeItem('erp_mayar_custom_webhook_url');
      }
    } catch {}
  };

  const handleResetWebhookUrl = () => {
    try {
      localStorage.removeItem('erp_mayar_custom_webhook_url');
    } catch {}
    setUrlWebhook(webhookUrl);
    setIsCustomUrl(false);
    toast.info('URL Webhook dikembalikan ke pengaturan default');
  };

  const handlePasteWebhook = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim() !== '') {
          handleChangeWebhookUrl(text.trim());
          toast.success('URL berhasil ditempelkan dari clipboard!');
          return;
        }
      }
    } catch {}
    toast.info('Gunakan kombinasi keyboard Ctrl+V di dalam kolom input.');
  };

  // Dialog pembuatan tautan
  const [selectedPesananForCreate, setSelectedPesananForCreate] = React.useState<MonitoringItem | null>(null);

  // Gabungkan pesanan berstatus dikirim dan riwayat tagihan Mayar
  const combinedItems: MonitoringItem[] = React.useMemo(() => {
    const items: MonitoringItem[] = [];
    const processedPesananIds = new Set<string>();

    // 1. Proses semua pesanan yang berstatus 'dikirim'
    for (const p of localPesananDikirimList) {
      processedPesananIds.add(p.id);

      // Cari tagihan untuk pesanan ini: prioritaskan 'dibayar' / 'lunas' terlebih dahulu
      const matchingTagihan =
        localTagihanList.find((t) => t.pesanan_jual_id === p.id && (t.status === 'dibayar' || t.status_efektif === 'dibayar')) ||
        localTagihanList.find((t) => t.pesanan_jual_id === p.id && (t.status === 'dibuat' || t.status_efektif === 'dibuat')) ||
        localTagihanList.find((t) => t.pesanan_jual_id === p.id);

      const isLunas = p.status === 'lunas' || matchingTagihan?.status === 'dibayar' || matchingTagihan?.status_efektif === 'dibayar';

      items.push({
        id: matchingTagihan ? matchingTagihan.id : `pesanan-${p.id}`,
        pesanan_jual_id: p.id,
        nomor_pesanan: p.nomor,
        kode_pelanggan: p.pelanggan?.kode || '-',
        nama_toko: p.pelanggan?.nama_toko || 'Pelanggan',
        telepon_toko: p.pelanggan?.telepon || null,
        total_pesanan: Number(p.total),
        status_pesanan: isLunas ? 'lunas' : p.status,
        tagihan_id: matchingTagihan?.id,
        mayar_invoice_id: matchingTagihan?.mayar_invoice_id,
        tautan: matchingTagihan?.tautan || null,
        status_tagihan: isLunas ? 'dibayar' : (matchingTagihan?.status_efektif || matchingTagihan?.status || 'belum_diterbitkan'),
        berlaku_sampai: matchingTagihan?.berlaku_sampai || null,
        dibuat_pada: matchingTagihan?.dibuat_pada || p.dikirim_pada || p.dibuat_pada,
        catatan_tinjau: matchingTagihan?.catatan_tinjau || null,
      });
    }

    // 2. Tambahkan tagihan Mayar lainnya yang pesanannya sudah lunas atau di luar status dikirim
    for (const t of localTagihanList) {
      if (!processedPesananIds.has(t.pesanan_jual_id)) {
        items.push({
          id: t.id,
          pesanan_jual_id: t.pesanan_jual_id,
          nomor_pesanan: t.nomor_pesanan || 'SO-00000',
          kode_pelanggan: t.kode_pelanggan || '-',
          nama_toko: t.nama_toko || 'Pelanggan',
          telepon_toko: null,
          total_pesanan: Number(t.jumlah),
          status_pesanan: t.status === 'dibayar' ? 'lunas' : 'dikirim',
          tagihan_id: t.id,
          mayar_invoice_id: t.mayar_invoice_id,
          tautan: t.tautan,
          status_tagihan: t.status_efektif || t.status,
          berlaku_sampai: t.berlaku_sampai,
          dibuat_pada: t.dibuat_pada,
          catatan_tinjau: t.catatan_tinjau,
        });
      }
    }

    // Urutkan berdasarkan waktu terbaru
    return items.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime());
  }, [localPesananDikirimList, localTagihanList]);

  // Filter & Search
  const filteredItems = React.useMemo(() => {
    return combinedItems.filter((item) => {
      // Filter tab
      if (filterTab === 'perlu_tautan' && item.status_tagihan !== 'belum_diterbitkan') {
        return false;
      }
      if (filterTab === 'aktif' && item.status_tagihan !== 'dibuat') {
        return false;
      }
      if (filterTab === 'lunas' && item.status_tagihan !== 'dibayar' && item.status_pesanan !== 'lunas') {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = item.nomor_pesanan.toLowerCase().includes(q);
        const matchToko = item.nama_toko.toLowerCase().includes(q);
        const matchKode = item.kode_pelanggan.toLowerCase().includes(q);
        return matchNo || matchToko || matchKode;
      }

      return true;
    });
  }, [combinedItems, filterTab, searchQuery]);

  // Handler Salin Webhook URL (dengan fallback robust)
  const handleCopyWebhook = async () => {
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(urlWebhook);
        copied = true;
      }
    } catch {
      // Fallback ke textarea di bawah
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = urlWebhook;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {}
    }

    if (copied) {
      setCopiedWebhook(true);
      toast.success('URL Webhook berhasil disalin ke clipboard!');
      setTimeout(() => setCopiedWebhook(false), 2500);
    } else {
      toast.error('Gagal menyalin otomatis. Silakan blok teks URL lalu tekan Ctrl+C.');
    }
  };

  // Handler Salin Link Pembayaran Per Baris
  const handleCopyPaymentLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLinkId(id);
    toast.success('Tautan pembayaran berhasil disalin ke clipboard!');
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  // Handler Periksa Status Mayar on-demand
  const handleCheckStatus = async (tagihanId: string, pesananId: string) => {
    setCheckingTagihanId(tagihanId);
    try {
      const res = await periksaStatusMayarAction(tagihanId, pesananId);
      if (res.success) {
        toast.success(res.message);
        if (res.data?.status === 'lunas' || res.data?.status === 'paid' || res.data?.status === 'dibayar') {
          setLocalTagihanList((prev) =>
            prev.map((t) =>
              t.id === tagihanId || t.pesanan_jual_id === pesananId
                ? { ...t, status: 'dibayar', status_efektif: 'dibayar', dibayar_pada: new Date().toISOString() }
                : t
            )
          );
          setLocalPesananDikirimList((prev) =>
            prev.map((p) =>
              p.id === pesananId ? { ...p, status: 'lunas' } : p
            )
          );
        }
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Gagal menghubungi gateway untuk sinkronisasi status');
    } finally {
      setCheckingTagihanId(null);
    }
  };

  // Auto Background Sync: Jika ada tagihan aktif berstatus 'dibuat',
  // sistem akan memeriksa otomatis ke server Mayar setiap 5 detik secara silent
  // sehingga layar langsung berubah menjadi Lunas tanpa perlu refresh manual.
  React.useEffect(() => {
    const activeWaitingItems = combinedItems.filter(
      (item) => item.tagihan_id && item.status_tagihan === 'dibuat' && item.status_pesanan === 'dikirim'
    );

    if (activeWaitingItems.length === 0) return;

    const interval = setInterval(async () => {
      for (const item of activeWaitingItems) {
        if (!item.tagihan_id) continue;
        try {
          const res = await periksaStatusMayarAction(item.tagihan_id, item.pesanan_jual_id);
          if (res.success && (res.data?.status === 'lunas' || res.data?.status === 'paid' || res.data?.status === 'dibayar')) {
            toast.success(`Pesanan ${item.nomor_pesanan} berhasil terverifikasi lunas dari Mayar! 🎉`);
            setLocalTagihanList((prev) =>
              prev.map((t) =>
                t.id === item.tagihan_id || t.pesanan_jual_id === item.pesanan_jual_id
                  ? { ...t, status: 'dibayar', status_efektif: 'dibayar', dibayar_pada: new Date().toISOString() }
                  : t
              )
            );
            setLocalPesananDikirimList((prev) =>
              prev.map((p) =>
                p.id === item.pesanan_jual_id ? { ...p, status: 'lunas' } : p
              )
            );
            router.refresh();
          }
        } catch {
          // Abaikan polling background error
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [combinedItems, router]);

  // Helper Pembuat Link WhatsApp
  const generateWhatsAppUrl = (item: MonitoringItem) => {
    if (!item.tautan) return null;
    const telpNorm = normalisasiNomorTelepon(item.telepon_toko);
    if (!telpNorm.valid) return null;

    const pesan =
      `Halo *${item.nama_toko}*,\n\n` +
      `Berikut adalah tautan pembayaran online resmi CV Sinar Abadi Niaga untuk pesanan *${item.nomor_pesanan}* sebesar *${formatRupiah(item.total_pesanan)}*:\n` +
      `${item.tautan}\n\n` +
      (item.berlaku_sampai ? `Batas waktu pembayaran: *${formatTanggalWaktu(item.berlaku_sampai)}*.\n` : '') +
      `Pembayaran dapat dilakukan melalui Virtual Account, QRIS, atau E-Wallet. Terima kasih.`;

    return buatUrlWhatsApp(telpNorm.nomor, pesan);
  };

  const countPerluTautan = combinedItems.filter((i) => i.status_tagihan === 'belum_diterbitkan').length;
  const countAktif = combinedItems.filter((i) => i.status_tagihan === 'dibuat').length;
  const countLunas = combinedItems.filter((i) => i.status_tagihan === 'dibayar' || i.status_pesanan === 'lunas').length;

  return (
    <div className="space-y-5">
      {/* 1. KARTU STATUS GATEWAY & KONEKSI API */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Gateway & Status Koneksi API */}
        <Card className="border-slate-200 bg-white shadow-none">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Gateway Provider</p>
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  API Terhubung
                </div>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                Mayar {hasRealKey ? 'Production' : 'Sandbox'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {hasRealKey ? 'Koneksi Live API Aktif' : 'Simulasi Sandbox & Mock Aktif'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Verifikasi Webhook Callback */}
        <Card className="border-slate-200 bg-white shadow-none">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Verifikasi Webhook</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Two-Way Handshake</p>
              <p className="text-[11px] text-slate-500">Pemeriksaan ulang aktif ke server Mayar</p>
            </div>
          </CardContent>
        </Card>

        {/* Masa Berlaku Default */}
        <Card className="border-slate-200 bg-white shadow-none">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Masa Berlaku Default</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">7 Hari (168 Jam)</p>
              <p className="text-[11px] text-slate-500">Dapat disesuaikan 1–30 hari per tagihan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. PANEL INFORMASI DESKRIPSI & KOLOM INPUT KHUSUS URL WEBHOOK MAYAR */}
      <Card className="border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/60 shadow-none overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Integrasi Webhook & Callback Otomatis Mayar
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] bg-white border-slate-300 text-slate-700 font-medium">
            Event: payment.received
          </Badge>
        </div>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Deskripsi Fungsionalitas */}
          <div className="text-xs text-slate-600 leading-relaxed bg-blue-50/60 border border-blue-200/70 rounded-md p-3.5">
            <p className="font-semibold text-slate-900 mb-1">
              Fungsionalitas Payment Gateway Mayar (CV Sinar Abadi Niaga):
            </p>
            <p>
              Sistem ini memfasilitasi penerbitan tautan bayar online digital (Virtual Account, QRIS, e-Wallet) bagi toko pelanggan untuk pesanan berstatus <strong className="text-slate-800">Dikirim</strong>. Ketika pelanggan menyelesaikan pembayaran di Mayar, sinyal webhook akan diterima oleh sistem ERP untuk memverifikasi keaslian transaksi dan secara otomatis melunasi pesanan tanpa perlu input manual.
            </p>
          </div>

          {/* Kolom Input Khusus URL Webhook Mayar (Callback) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                URL Endpoint Webhook Callback (Dapat Diedit / Disesuaikan):
              </label>
              <div className="flex items-center gap-2.5">
                {isCustomUrl && (
                  <button
                    type="button"
                    onClick={handleResetWebhookUrl}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset ke Default Server
                  </button>
                )}
                {typeof window !== 'undefined' && !urlWebhook.startsWith(window.location.origin) && (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const parsed = new URL(urlWebhook);
                        const newUrl = `${window.location.origin}${parsed.pathname}`;
                        handleChangeWebhookUrl(newUrl);
                        toast.success('URL disesuaikan dengan host browser saat ini!');
                      } catch {
                        const tokenPart = urlWebhook.split('/api/webhooks/mayar/')[1] || '';
                        handleChangeWebhookUrl(`${window.location.origin}/api/webhooks/mayar/${tokenPart}`);
                      }
                    }}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 underline cursor-pointer"
                  >
                    Gunakan Host Browser Ini
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={urlWebhook}
                  onChange={(e) => handleChangeWebhookUrl(e.target.value)}
                  placeholder="https://domain-anda.com/api/webhooks/mayar/token"
                  className="font-mono text-xs bg-white text-slate-900 border-slate-300 pr-10 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
                />
                <Link2 className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasteWebhook}
                  className="text-xs h-9 px-3 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Tempelkan URL dari clipboard"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Tempel</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleCopyWebhook}
                  className={
                    copiedWebhook
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 h-9 shrink-0'
                      : 'bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 h-9 shrink-0 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                  }
                >
                  {copiedWebhook ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      URL Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Salin Link Webhook
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-1 pt-0.5">
              <span>
                💡 <strong>Bebas diedit/ditempel:</strong> Jika Anda menggunakan <em>ngrok / tunnel</em> atau domain live Mayar, Anda dapat langsung mengedit atau menempelkan domain di kolom ini tanpa hardcode.
              </span>
              <span>
                Pilih event di Mayar: <code className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">payment.received</code>
              </span>
            </div>
          </div>

          {/* Panduan Alur Integrasi 3 Langkah */}
          <div className="pt-2 border-t border-slate-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Panduan Alur Integrasi Otomatis (3 Tahap):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-xs font-semibold text-slate-900">Salin URL Webhook</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Manajer menyalin URL Endpoint di atas lalu menempelkannya ke Dashboard Mayar.
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-xs font-semibold text-slate-900">Terbitkan Tautan</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Saat pesanan berstatus <strong className="text-slate-700">Dikirim</strong>, klik tombol buat tautan Mayar dan kirim link ke toko pelanggan.
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <span className="text-xs font-semibold text-slate-900">Pelunasan Otomatis</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Saat toko melunasi tagihan, Webhook memvalidasi ke server Mayar dan otomatis mengubah status pesanan menjadi <strong className="text-emerald-700">Lunas</strong>.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. TABEL RIWAYAT TAUTAN & TRANSAKSI MAYAR */}
      <Card className="border-slate-200 bg-white shadow-none">
        <div className="border-b border-slate-200 px-4 py-3.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Riwayat Tautan & Transaksi Mayar (Pesanan Dikirim)
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Live Auto-Sync
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Menampilkan {filteredItems.length} pesanan dengan akses tautan pembayaran dinamis.
            </p>
          </div>

          {/* Filter Tab & Pencarian */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari pesanan / toko..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 w-44 sm:w-56"
              />
            </div>

            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterTab('semua')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterTab === 'semua'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Semua ({combinedItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('perlu_tautan')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterTab === 'perlu_tautan'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Perlu Tautan ({countPerluTautan})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('aktif')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterTab === 'aktif'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Menunggu ({countAktif})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('lunas')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterTab === 'lunas'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Lunas ({countLunas})
              </button>
            </div>
          </div>
        </div>

        {/* Tabel Data Padat Enterprise */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-32">No. Pesanan</th>
                <th className="py-2.5 px-3 min-w-[160px]">Pelanggan / Toko</th>
                <th className="py-2.5 px-3 w-28 text-right">Total Tagihan</th>
                <th className="py-2.5 px-3 w-24">Status Pesanan</th>
                <th className="py-2.5 px-3 w-32">Status Tagihan</th>
                <th className="py-2.5 px-3 min-w-[280px]">Kolom Link Pembayaran Mayar</th>
                <th className="py-2.5 px-3 w-24 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 text-xs">
                    Tidak ditemukan data transaksi yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const waUrl = generateWhatsAppUrl(item);
                  const isCopied = copiedLinkId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* No. Pesanan */}
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        <Link
                          href={`/pesanan/${item.pesanan_jual_id}`}
                          className="hover:text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          {item.nomor_pesanan}
                        </Link>
                        <p className="text-[10px] text-slate-400 font-sans">
                          {formatTanggal(item.dibuat_pada)}
                        </p>
                      </td>

                      {/* Pelanggan */}
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-800">{item.nama_toko}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{item.kode_pelanggan}</span>
                          {item.telepon_toko && <span>&bull; {item.telepon_toko}</span>}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatRupiah(item.total_pesanan)}
                      </td>

                      {/* Status Pesanan */}
                      <td className="py-2.5 px-3">
                        <BadgeStatus status={item.status_pesanan} className="text-[10px] px-1.5 py-0 h-4" />
                      </td>

                      {/* Status Tagihan Mayar */}
                      <td className="py-2.5 px-3">
                        {item.status_tagihan === 'belum_diterbitkan' ? (
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-600 border-slate-200">
                            Belum Ada Tautan
                          </Badge>
                        ) : (
                          <div>
                            <BadgeStatus status={item.status_tagihan || 'dibuat'} className="text-[10px] px-1.5 py-0 h-4" />
                            {item.berlaku_sampai && item.status_tagihan === 'dibuat' && (
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                Exp: {formatTanggal(item.berlaku_sampai)}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* KOLOM TAUTAN PEMBAYARAN DINAMIS & SALIN LINK */}
                      <td className="py-2.5 px-3">
                        {item.status_pesanan === 'lunas' && item.status_tagihan !== 'dibayar' ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Lunas Manual (Tautan Nonaktif)</span>
                          </div>
                        ) : item.tautan ? (
                          <div className="space-y-1.5 max-w-sm">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="text"
                                readOnly
                                value={item.tautan}
                                className="font-mono text-[11px] h-7 bg-slate-50 border-slate-300 text-slate-700 pr-1 select-all"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyPaymentLink(item.tautan!, item.id)}
                                className={
                                  isCopied
                                    ? 'h-7 px-2 text-[11px] bg-emerald-50 text-emerald-700 border-emerald-300 shrink-0 font-medium'
                                    : 'h-7 px-2 text-[11px] bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shrink-0 font-medium'
                                }
                                title="Salin Link Pembayaran"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                    Tersalin
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Salin Link
                                  </>
                                )}
                              </Button>
                            </div>

                            <div className="flex items-center gap-2 text-[11px]">
                              <a
                                href={item.tautan}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Buka Halaman Bayar
                              </a>

                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-medium ml-2"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  Kirim ke WA
                                </a>
                              )}
                            </div>
                          </div>
                        ) : item.status_pesanan === 'lunas' ? (
                          <span className="text-[11px] text-slate-400 italic">
                            Pesanan Sudah Lunas
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPesananForCreate(item)}
                              className="h-7 px-2.5 text-[11px] bg-white border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 font-semibold inline-flex items-center gap-1 shadow-none"
                            >
                              <Plus className="w-3.5 h-3.5 text-slate-600" />
                              Terbitkan Tautan Mayar
                            </Button>
                          </div>
                        )}
                      </td>

                      {/* Aksi Tambahan */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.tagihan_id && item.status_tagihan === 'dibuat' && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={checkingTagihanId === item.tagihan_id}
                              onClick={() => handleCheckStatus(item.tagihan_id!, item.pesanan_jual_id)}
                              className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
                              title="Periksa Status Terkini dari Gateway Mayar"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  checkingTagihanId === item.tagihan_id ? 'animate-spin text-blue-600' : ''
                                }`}
                              />
                            </Button>
                          )}

                          <Link
                            href={`/pesanan/${item.pesanan_jual_id}`}
                            className="inline-flex items-center justify-center h-7 px-2.5 text-[11px] font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded border border-transparent transition-colors"
                          >
                            Detail
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DIALOG PEMBUATAN TAUTAN PEMBAYARAN MAYAR */}
      {selectedPesananForCreate && (
        <MayarCreateDialog
          isOpen={Boolean(selectedPesananForCreate)}
          onClose={() => setSelectedPesananForCreate(null)}
          pesananId={selectedPesananForCreate.pesanan_jual_id}
          nomorPesanan={selectedPesananForCreate.nomor_pesanan}
          totalPesanan={selectedPesananForCreate.total_pesanan}
          namaToko={selectedPesananForCreate.nama_toko}
          teleponToko={selectedPesananForCreate.telepon_toko}
          defaultEmail={defaultCustomerEmail}
        />
      )}
    </div>
  );
}
