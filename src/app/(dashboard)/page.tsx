import { Suspense } from "react";
import Link from "next/link";
import { getProfil } from "@/lib/profil";
import { createServerClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatTanggal, formatRupiah } from "@/lib/format";
import {
  AlertTriangle,
  Clock,
  Shield,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  ReceiptText,
  ArrowRight,
} from "lucide-react";
import type { LaporanRingkasan, LaporanAgingPiutang } from "@/features/laporan/types";
import {
  TugasHariIniSkeleton,
  TugasHariIniSection,
} from "@/features/pusat-tugas/components/tugas-hari-ini-section";

interface BarangMenipis {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  stok_menipis: boolean;
}

export default async function DashboardPage() {
  const user = await getProfil();
  const supabase = await createServerClient();

  const isManajer = user?.peran === "manajer";

  // Ambil data stok menipis (untuk semua peran)
  const { data: barangMenipisData, error: stokError } = await supabase
    .from("v_barang")
    .select("id, kode, nama, satuan, stok, stok_minimum, stok_menipis")
    .eq("stok_menipis", true)
    .order("stok", { ascending: true });

  const barangMenipis: BarangMenipis[] = (barangMenipisData || []).map((item) => ({
    id: item.id || "",
    kode: item.kode || "-",
    nama: item.nama || "-",
    satuan: item.satuan || "pcs",
    stok: item.stok ?? 0,
    stok_minimum: item.stok_minimum ?? 0,
    stok_menipis: item.stok_menipis ?? true,
  }));

  // Jika Manajer, ambil KPI ringkas minggu berjalan & piutang tempo
  let kpiMinggu: LaporanRingkasan | null = null;
  let agingPiutang: LaporanAgingPiutang | null = null;
  let jumlahPersetujuanMenunggu = 0;

  if (isManajer) {
    const now = new Date();
    // Hitung awal minggu ini (Senin)
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const mondayStr = monday.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    const [ringkasanRes, agingRes, persetujuanRes] = await Promise.all([
      supabase.rpc("rpc_laporan_ringkasan", { p_dari: mondayStr, p_sampai: todayStr }),
      supabase.rpc("rpc_laporan_aging_piutang"),
      supabase.from("v_persetujuan_harga").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
    ]);
    jumlahPersetujuanMenunggu = persetujuanRes.count ?? 0;

    const ringkasanRaw = Array.isArray(ringkasanRes.data) ? ringkasanRes.data[0] : ringkasanRes.data;
    if (ringkasanRaw) {
      kpiMinggu = {
        total_omzet: Number(ringkasanRaw.total_omzet) || 0,
        total_hpp: Number(ringkasanRaw.total_hpp) || 0,
        total_margin: Number(ringkasanRaw.total_margin) || 0,
        margin_persen: Number(ringkasanRaw.margin_persen) || 0,
        jumlah_pesanan: Number(ringkasanRaw.jumlah_pesanan) || 0,
        pesanan_dikirim: Number(ringkasanRaw.pesanan_dikirim) || 0,
        pesanan_lunas: Number(ringkasanRaw.pesanan_lunas) || 0,
      };
    }

    const agingRaw = Array.isArray(agingRes.data) ? agingRes.data[0] : agingRes.data;
    if (agingRaw) {
      agingPiutang = {
        total_piutang_dikirim: Number(agingRaw.total_piutang_dikirim) || 0,
        belum_jatuh_tempo: Number(agingRaw.belum_jatuh_tempo) || 0,
        lewat_1_7_hari: Number(agingRaw.lewat_1_7_hari) || 0,
        lewat_8_30_hari: Number(agingRaw.lewat_8_30_hari) || 0,
        lewat_gt_30_hari: Number(agingRaw.lewat_gt_30_hari) || 0,
        jumlah_pesanan_lewat_tempo: Number(agingRaw.jumlah_pesanan_lewat_tempo) || 0,
        total_pesanan_dikirim: Number(agingRaw.total_pesanan_dikirim) || 0,
      };
    }
  }

  // Ringkasan Tagihan & Overdue untuk Penjualan & Manajer
  let tagihanHariIni = 0;
  let tagihanOverdueCount = 0;
  let tagihanOverdueTotal = 0;

  if (user?.peran === "manajer" || user?.peran === "penjualan") {
    const { data: tagihanData } = await supabase
      .from("v_tagihan")
      .select("total, klasifikasi");

    if (tagihanData) {
      for (const t of tagihanData) {
        if (t.klasifikasi === "hari_ini") {
          tagihanHariIni += 1;
        } else if (t.klasifikasi?.startsWith("overdue")) {
          tagihanOverdueCount += 1;
          tagihanOverdueTotal += Number(t.total) || 0;
        }
      }
    }
  }

  const columns: Column<BarangMenipis>[] = [
    {
      header: "Kode Barang",
      accessorKey: "kode",
      className: "w-32 font-mono text-slate-700 font-medium",
    },
    {
      header: "Nama Barang",
      accessorKey: "nama",
      className: "font-medium text-slate-900",
    },
    {
      header: "Satuan",
      accessorKey: "satuan",
      className: "w-24 text-slate-500",
    },
    {
      header: "Stok Saat Ini",
      isNumeric: true,
      className: "w-32 text-red-600 font-semibold tabular-nums",
      cell: (row) => `${row.stok.toLocaleString("id-ID")} ${row.satuan}`,
    },
    {
      header: "Batas Minimum",
      isNumeric: true,
      className: "w-32 text-slate-600 tabular-nums",
      cell: (row) => `${row.stok_minimum.toLocaleString("id-ID")} ${row.satuan}`,
    },
    {
      header: "Status",
      align: "center",
      className: "w-28",
      cell: () => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
          Menipis
        </span>
      ),
    },
    {
      header: "Aksi",
      align: "right",
      className: "w-28 text-right",
      cell: (row) => {
        if (user?.peran === "gudang" || user?.peran === "manajer") {
          return (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 border-slate-300 hover:border-slate-400 gap-1"
            >
              <Link href={`/pembelian/baru?barang=${row.id}`}>
                <ShoppingCart className="w-3 h-3" />
                Ajukan PO
              </Link>
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const nowJakarta = new Date();

  return (
    <div className="space-y-5">
      {/* 1. Hero Strip Ringkas (1 Baris Ramping Anti-Double) */}
      <div className="surface-raised rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-slate-900">
            Halo, {user?.nama_lengkap}
          </span>
          <span className="text-slate-300 hidden sm:inline">&bull;</span>
          <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200/60 uppercase font-mono">
            {user?.peran}
          </span>
          <span className="text-slate-400 hidden md:inline text-[11px]">
            CV Sinar Abadi Niaga
          </span>
          <span className="text-slate-300 hidden lg:inline">&bull;</span>
          <span className="text-indigo-600 font-medium hidden lg:inline text-[11px]">
            Wholesale Groceries &amp; FMCG
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-600">
              {formatTanggal(nowJakarta)}
            </span>
          </div>
          <span className="text-slate-300">&bull;</span>
          <div className="flex items-center gap-1 text-emerald-700 font-medium">
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span>Sesi Terenkripsi</span>
          </div>
        </div>
      </div>

      {/* 2. Banner Peringatan Penagihan Piutang (Full-Width Tanpa Kotak Ganda) */}
      {(user?.peran === "manajer" || user?.peran === "penjualan") &&
        (tagihanHariIni > 0 || tagihanOverdueCount > 0) && (
          <div className="surface-raised rounded-xl p-3.5 border-amber-300/80 bg-linear-to-r from-amber-50/50 via-white to-amber-50/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                <ReceiptText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-amber-950">
                  Monitoring Penagihan Piutang
                </p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  {tagihanHariIni > 0 && (
                    <span className="font-medium mr-2">
                      &bull; {tagihanHariIni} faktur jatuh tempo hari ini
                    </span>
                  )}
                  {tagihanOverdueCount > 0 && (
                    <span className="font-medium">
                      &bull; {tagihanOverdueCount} faktur menunggak (
                      {formatRupiah(tagihanOverdueTotal)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100/70"
            >
              <Link href="/penagihan">
                Buka Penagihan &rarr;
              </Link>
            </Button>
          </div>
        )}

      {/* 3. Pusat Tugas Prioritas (Antrean Cerdas dengan Stagger) */}
      <Suspense fallback={<TugasHariIniSkeleton />}>
        <TugasHariIniSection />
      </Suspense>

      {/* 4. Panel Khusus Manajer: Bento Grid Keuangan */}
      {isManajer && (
        <section className="space-y-3" aria-label="Keuangan Manajer">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-indigo-600 rounded-full" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Ringkasan Finansial Minggu Berjalan
              </h2>
            </div>
            <Link
              href="/laporan"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              Lihat Laporan Lengkap
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {/* Bento Card 1: Hero Omzet & Margin (Lebar 2 Kolom di Desktop) */}
            <div className="md:col-span-2 surface-raised rounded-xl p-5 flex flex-col justify-between border-slate-200">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      Omzet & Margin Kotor Minggu Ini
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Senin s.d. Hari Ini
                  </span>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Total Omzet</span>
                    <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {formatRupiah(kpiMinggu?.total_omzet || 0)}
                    </div>
                  </div>

                  <div className="sm:border-l sm:border-slate-200 sm:pl-6">
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Margin Kotor ({kpiMinggu?.margin_persen || 0}%)
                    </span>
                    <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                      {formatRupiah(kpiMinggu?.total_margin || 0)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar Visual Margin */}
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>{kpiMinggu?.jumlah_pesanan || 0} pesanan selesai</span>
                    <span className="font-semibold text-slate-700">
                      Rasio Margin: {kpiMinggu?.margin_persen || 0}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(Math.max(kpiMinggu?.margin_persen || 0, 0), 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: Total Piutang Berjalan */}
            <div className="surface-raised rounded-xl p-4 flex flex-col justify-between border-slate-200">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Piutang Aktif</span>
                  <ReceiptText className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-xl font-extrabold text-slate-900 tabular-nums">
                  {formatRupiah(agingPiutang?.total_piutang_dikirim || 0)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {agingPiutang?.total_pesanan_dikirim || 0} faktur belum lunas
                </p>
              </div>

              <Link
                href="/laporan/piutang"
                className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Lihat aging piutang &rarr;
              </Link>
            </div>

            {/* Bento Card 3: Tagihan Lewat Tempo & Persetujuan Menunggu */}
            <div className="surface-raised rounded-xl p-4 flex flex-col justify-between border-slate-200">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Tagihan Lewat Tempo</span>
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0
                        ? "text-red-600"
                        : "text-slate-400"
                    }`}
                  />
                </div>
                <div
                  className={`mt-2 text-xl font-extrabold tabular-nums ${
                    (agingPiutang?.jumlah_pesanan_lewat_tempo || 0) > 0
                      ? "text-red-600"
                      : "text-slate-900"
                  }`}
                >
                  {agingPiutang?.jumlah_pesanan_lewat_tempo || 0}{" "}
                  <span className="text-xs font-normal text-slate-500">faktur</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {jumlahPersetujuanMenunggu} persetujuan harga menunggu
                </p>
              </div>

              <Link
                href="/persetujuan"
                className="mt-3 text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
              >
                Tinjau pengajuan &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 5. Tabel Peringatan Stok Menipis (Single Surface Datar) */}
      <section className="surface-raised rounded-xl p-5 border-slate-200" aria-label="Stok Menipis">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Peringatan Stok Menipis
              </h2>
              <p className="text-xs text-slate-500">
                Barang dengan sisa stok pada atau di bawah batas minimum
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-red-800 bg-red-100 px-2.5 py-0.5 rounded-full tabular-nums">
            {barangMenipis.length} Barang Perlu Restock
          </span>
        </div>

        {stokError ? (
          <div className="p-4 text-xs text-red-600 bg-red-50 rounded-lg border border-red-200">
            Gagal memuat data stok barang: {stokError.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={barangMenipis}
            keyExtractor={(item) => item.id}
            zebra
            emptyTitle="Stok Seluruh Barang Aman"
            emptyDescription="Tidak ada barang yang berada pada atau di bawah batas stok minimum."
          />
        )}
      </section>
    </div>
  );
}
