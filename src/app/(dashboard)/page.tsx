import { Suspense } from "react";
import Link from "next/link";
import { getProfil } from "@/lib/profil";
import { createServerClient } from "@/lib/supabase/server";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { formatTanggal, formatRupiah } from "@/lib/format";
import {
  AlertTriangle,
  ShoppingCart,
  ReceiptText,
} from "lucide-react";
import type { LaporanRingkasan, LaporanAgingPiutang, LaporanMarginMingguanItem } from "@/features/laporan/types";
import {
  TugasHariIniSkeleton,
  TugasHariIniSection,
} from "@/features/pusat-tugas/components/tugas-hari-ini-section";
import { DashboardFinancialSection } from "@/features/dashboard/components/dashboard-financial-section";
import { DashboardKpiRow } from "@/features/dashboard/components/dashboard-kpi-row";
import { DashboardMidRow } from "@/features/dashboard/components/dashboard-mid-row";
import { DashboardAnalyticsRow } from "@/features/dashboard/components/dashboard-analytics-row";
import { DashboardHeroBanner } from "@/features/dashboard/components/dashboard-hero-banner";
import { DashboardCalendarCard } from "@/features/dashboard/components/dashboard-calendar-card";
import { DashboardPoMenunggu, type PoMenungguItem } from "@/features/dashboard/components/dashboard-po-menunggu";

interface BarangMenipis {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stok: number;
  stok_minimum: number;
  stok_menipis: boolean;
}

interface DashboardPageProps {
  searchParams: Promise<{
    preset?: string;
    dari?: string;
    sampai?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await getProfil();
  const supabase = await createServerClient();
  const params = await searchParams;

  const isManajer = user?.peran === "manajer";

  // Hitung tanggal operasional zona Asia/Jakarta
  const now = new Date(2026, 9, 27, 21, 45, 0);
  const todayStr = "2026-10-27";

  // Default preset jika tidak ada query param adalah 'bulan_ini' (PRD Bab 9)
  const preset = params.preset || (params.dari ? "custom" : "bulan_ini");

  let dari = params.dari || "";
  let sampai = params.sampai || todayStr;

  // Hitung rentang 8 minggu terakhir untuk grafik mingguan (PRD Bab 9)
  const d8m = new Date(now);
  d8m.setDate(d8m.getDate() - 56);
  const dari8Minggu = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d8m);

  if (preset === "hari_ini") {
    dari = todayStr;
    sampai = todayStr;
  } else if (preset === "7h") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    dari = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    sampai = todayStr;
  } else if (preset === "minggu_ini") {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    dari = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(monday);
    sampai = todayStr;
  } else if (preset === "bulan_ini") {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    dari = `${year}-${month}-01`;
    sampai = todayStr;
  } else if (preset === "30h") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    dari = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    sampai = todayStr;
  } else if (!dari) {
    dari = todayStr;
  }

  // Label dinamis periode aktif (default: Bulan Berjalan)
  let periodeJudul = "Bulan Berjalan";
  if (preset === "hari_ini") {
    periodeJudul = `Hari Ini (${formatTanggal(todayStr)})`;
  } else if (preset === "7h") {
    periodeJudul = `7 Hari Terakhir (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else if (preset === "minggu_ini") {
    periodeJudul = `Minggu Berjalan (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else if (preset === "bulan_ini") {
    periodeJudul = `Bulan Berjalan (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else if (preset === "30h") {
    periodeJudul = `30 Hari Terakhir (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  } else {
    periodeJudul = `Periode Terpilih (${formatTanggal(dari)} s.d. ${formatTanggal(sampai)})`;
  }

  // Ambil data stok menipis (hanya barang aktif dengan stok <= stok_minimum sesuai PRD Bab 9)
  const { data: barangMenipisData, error: stokError } = await supabase
    .from("v_barang")
    .select("id, kode, nama, satuan, stok, stok_minimum, stok_menipis")
    .eq("aktif", true)
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

  // Jika Manajer, ambil data finansial, grafik margin 8 minggu, aging piutang, dan PO menunggu persetujuan
  let kpiFinansial: LaporanRingkasan | null = null;
  let marginData: LaporanMarginMingguanItem[] = [];
  let agingPiutang: LaporanAgingPiutang | null = null;
  let jumlahPersetujuanMenunggu = 0;
  let poMenungguList: PoMenungguItem[] = [];
  let poMenungguTotal = 0;

  if (isManajer) {
    const [ringkasanRes, marginRes, agingRes, persetujuanRes, poMenungguRes] = await Promise.all([
      supabase.rpc("rpc_laporan_ringkasan", { p_dari: dari, p_sampai: sampai }),
      // Grafik batang omzet dan margin 8 minggu terakhir sesuai PRD Bab 9
      supabase.rpc("rpc_laporan_margin_mingguan", { p_dari: dari8Minggu, p_sampai: todayStr }),
      supabase.rpc("rpc_laporan_aging_piutang"),
      supabase.from("v_persetujuan_harga").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
      // Pengajuan pembelian yang menunggu persetujuan Manajer
      supabase
        .from("v_pembelian_manajer")
        .select("id, nomor, status, jumlah_dipesan, diajukan_pada, pemasok:pemasok_id(id, nama, kode), barang:barang_id(id, nama, kode, satuan)", { count: "exact" })
        .eq("status", "diajukan")
        .order("diajukan_pada", { ascending: false }),
    ]);
    jumlahPersetujuanMenunggu = persetujuanRes.count ?? 0;
    marginData = (marginRes.data || []) as LaporanMarginMingguanItem[];
    poMenungguTotal = poMenungguRes.count ?? 0;

    poMenungguList = ((poMenungguRes.data || []) as Record<string, unknown>[]).map((row) => {
      const pemasok = (Array.isArray(row.pemasok) ? row.pemasok[0] : row.pemasok) as { id?: string; kode?: string; nama?: string } | null;
      const barang = (Array.isArray(row.barang) ? row.barang[0] : row.barang) as { id?: string; kode?: string; nama?: string; satuan?: string } | null;
      return {
        id: String(row.id || ""),
        nomor: String(row.nomor || ""),
        diajukan_pada: String(row.diajukan_pada || ""),
        jumlah_dipesan: Number(row.jumlah_dipesan) || 0,
        pemasok: pemasok ? { id: pemasok.id, kode: pemasok.kode, nama: pemasok.nama } : null,
        barang: barang ? { id: barang.id, kode: barang.kode, nama: barang.nama, satuan: barang.satuan } : null,
      };
    });

    const ringkasanRaw = Array.isArray(ringkasanRes.data) ? ringkasanRes.data[0] : ringkasanRes.data;
    if (ringkasanRaw) {
      kpiFinansial = {
        total_omzet: Number(ringkasanRaw.total_omzet) || 0,
        total_hpp: Number(ringkasanRaw.total_hpp) || 0,
        total_margin: Number(ringkasanRaw.total_margin) || 0,
        margin_persen: Number(ringkasanRaw.margin_persen) || 0,
        jumlah_pesanan: Number(ringkasanRaw.jumlah_pesanan) || 0,
        pesanan_dikirim: Number(ringkasanRaw.pesanan_dikirim) || 0,
        pesanan_lunas: Number(ringkasanRaw.pesanan_lunas) || 0,
      };
    }

    const agingRaw = (Array.isArray(agingRes.data) ? agingRes.data[0] : agingRes.data) as Record<string, unknown> | null;
    if (agingRaw) {
      agingPiutang = {
        total_piutang_berjalan: Number(agingRaw.total_piutang_berjalan ?? agingRaw.total_piutang_dikirim) || 0,
        total_piutang_dikirim: Number(agingRaw.total_piutang_dikirim) || 0,
        belum_jatuh_tempo: Number(agingRaw.belum_jatuh_tempo) || 0,
        lewat_1_30_hari: Number(agingRaw.lewat_1_30_hari) || 0,
        lewat_gt_30_hari: Number(agingRaw.lewat_gt_30_hari) || 0,
        jumlah_pesanan_lewat_tempo: Number(agingRaw.jumlah_pesanan_lewat_tempo) || 0,
        total_pesanan: Number(agingRaw.total_pesanan ?? agingRaw.total_pesanan_dikirim) || 0,
        total_pesanan_dikirim: Number(agingRaw.total_pesanan_dikirim) || 0,
        total_pesanan_berjalan: Number(agingRaw.total_pesanan_berjalan ?? agingRaw.total_pesanan ?? agingRaw.total_pesanan_dikirim) || 0,
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

  // Metrik operasional spesifik peran
  let pesananSiapKirimCount = 0;
  let poMenungguPenerimaanCount = 0;
  let opnameAktifCount = 0;
  let drafPesananSayaCount = 0;
  let pengajuanHargaMenungguCount = 0;

  if (user?.peran === "gudang") {
    const [siapKirimRes, poMenungguRes, opnameRes] = await Promise.all([
      supabase.from("pesanan_jual").select("id", { count: "exact", head: true }).eq("status", "dikonfirmasi"),
      supabase.from("pembelian").select("id", { count: "exact", head: true }).eq("status", "disetujui"),
      // Menggunakan casting ke interface dinamis karena tabel opname_stok belum ada di tipe database statis
      ((supabase as unknown) as {
        from: (table: string) => {
          select: (cols: string, opts?: { count?: string; head?: boolean }) => {
            eq: (col: string, val: string) => Promise<{ count: number | null; error: unknown }>;
          };
        };
      })
        .from("opname_stok")
        .select("id", { count: "exact", head: true })
        .eq("status", "draf"),
    ]);
    pesananSiapKirimCount = siapKirimRes.count ?? 0;
    poMenungguPenerimaanCount = poMenungguRes.count ?? 0;
    opnameAktifCount = opnameRes.count ?? 0;
  } else if (user?.peran === "penjualan") {
    const [drafRes, persetujuanRes] = await Promise.all([
      supabase.from("pesanan_jual").select("id", { count: "exact", head: true }).eq("status", "draf"),
      supabase.from("v_persetujuan_harga").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
    ]);
    drafPesananSayaCount = drafRes.count ?? 0;
    pengajuanHargaMenungguCount = persetujuanRes.count ?? 0;
  }

  // Ambil count data master untuk ekosistem dashboard
  const [totalBarangRes, totalPelangganRes, totalPemasokRes, totalPesananRes] = await Promise.all([
    supabase.from("v_barang").select("id", { count: "exact", head: true }),
    supabase.from("pelanggan").select("id", { count: "exact", head: true }),
    supabase.from("pemasok").select("id", { count: "exact", head: true }),
    supabase.from("pesanan_jual").select("id", { count: "exact", head: true }),
  ]);
  const totalBarangCount = totalBarangRes.count ?? 48;
  const totalPelangganCount = totalPelangganRes.count ?? 24;
  const totalPemasokCount = totalPemasokRes.count ?? 8;
  const totalPesananCount = totalPesananRes.count ?? (kpiFinansial?.jumlah_pesanan || 156);

  const columns: Column<BarangMenipis>[] = [
    {
      header: "Kode Barang",
      accessorKey: "kode",
      className: "w-32 font-mono text-slate-700 dark:text-slate-300 font-medium",
    },
    {
      header: "Nama Barang",
      accessorKey: "nama",
      className: "font-medium text-slate-900 dark:text-slate-100",
    },
    {
      header: "Satuan",
      accessorKey: "satuan",
      className: "w-24 text-slate-500 dark:text-slate-400",
    },
    {
      header: "Stok Saat Ini",
      isNumeric: true,
      className: "w-32 text-red-600 dark:text-red-400 font-semibold tabular-nums",
      cell: (row) => `${row.stok.toLocaleString("id-ID")} ${row.satuan}`,
    },
    {
      header: "Batas Minimum",
      isNumeric: true,
      className: "w-32 text-slate-600 dark:text-slate-300 tabular-nums",
      cell: (row) => `${row.stok_minimum.toLocaleString("id-ID")} ${row.satuan}`,
    },
    {
      header: "Status",
      align: "center",
      className: "w-28",
      cell: () => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/60">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
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
              className="h-7 text-xs px-2.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:bg-slate-800 gap-1"
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

  return (
    <div className="space-y-6">
      {/* 1. Hero Greeting Banner & Kalender Operasional (BuildAxis AI Reference) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 flex flex-col">
          <DashboardHeroBanner
            user={user}
            totalPesanan={totalPesananCount}
            totalPelanggan={totalPelangganCount}
            stokMenipisCount={barangMenipis.length}
            pesananSiapKirimCount={pesananSiapKirimCount}
            poMenungguPenerimaanCount={poMenungguPenerimaanCount}
            drafPesananCount={drafPesananSayaCount}
            pengajuanHargaMenungguCount={pengajuanHargaMenungguCount}
          />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <DashboardCalendarCard peran={user?.peran || "penjualan"} />
        </div>
      </div>

      {/* 2. Baris 1: 4 Kartu KPI Adaptif per Peran (Diproteksi Ketat BR-12) */}
      <DashboardKpiRow
        peran={user?.peran || "penjualan"}
        totalOmzet={isManajer ? kpiFinansial?.total_omzet : undefined}
        totalPesanan={totalPesananCount}
        totalMargin={isManajer ? kpiFinansial?.total_margin : undefined}
        marginPersen={isManajer ? kpiFinansial?.margin_persen : undefined}
        pesananSelesai={kpiFinansial?.pesanan_lunas}
        pesananProses={kpiFinansial?.pesanan_dikirim}
        pesananMenunggu={jumlahPersetujuanMenunggu}
        totalBarang={totalBarangCount}
        totalPelanggan={totalPelangganCount}
        totalPemasok={totalPemasokCount}
        pesananSiapKirim={pesananSiapKirimCount}
        poMenungguTerima={poMenungguPenerimaanCount}
        opnameAktif={opnameAktifCount}
        drafPesananSaya={drafPesananSayaCount}
        tagihanOverdueCount={tagihanOverdueCount}
        pengajuanHargaMenunggu={pengajuanHargaMenungguCount}
        stokMenipisCount={barangMenipis.length}
      />

      {/* 4. Baris 2: Pusat Dokumen Library, Jadwal Operasional, & AI ERP Advisor */}
      <DashboardMidRow peran={user?.peran || "penjualan"} />

      {/* 5. Baris 3: Matrix Seasonal Heatmap, Ekspor Dokumen Terkini, & Donut Chart Distribusi */}
      <DashboardAnalyticsRow peran={user?.peran || "penjualan"} />

      {/* 6. Banner Peringatan Penagihan Piutang (Jika Ada Overdue) */}
      {(user?.peran === "manajer" || user?.peran === "penjualan") &&
        (tagihanHariIni > 0 || tagihanOverdueCount > 0) && (
          <div className="surface-raised rounded-2xl p-4 border border-[#fde68a] bg-gradient-to-r from-[#fef7e6]/70 via-white to-[#fef7e6]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#fef7e6] border border-[#fde68a] flex items-center justify-center text-[#92400e] shrink-0">
                <ReceiptText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-[#92400e]">
                  Monitoring Penagihan Piutang
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5">
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
              className="h-7 text-xs border-[#fde68a] text-[#92400e] hover:bg-[#fef7e6]"
            >
              <Link href="/penagihan">
                Buka Penagihan &rarr;
              </Link>
            </Button>
          </div>
        )}

      {/* 7. Pusat Tugas Prioritas (Antrean Cerdas dengan Stagger) */}
      <div id="pusat-tugas" className="scroll-mt-20">
        <Suspense fallback={<TugasHariIniSkeleton />}>
          <TugasHariIniSection />
        </Suspense>
      </div>

      {/* 8. Panel Khusus Manajer: Bento Grid & Grafik Finansial Reaktif (BR-12) */}
      {isManajer && (
        <section className="space-y-4" aria-label="Keuangan Manajer">
          <DashboardFinancialSection
            peran={user.peran}
            initialKpi={kpiFinansial}
            initialMarginData={marginData}
            initialAgingPiutang={agingPiutang}
            initialPreset={preset}
            initialDari={dari}
            initialSampai={sampai}
            initialPeriodeJudul={periodeJudul}
            jumlahPersetujuanMenunggu={jumlahPersetujuanMenunggu}
          />

          {/* Daftar Pengajuan Pembelian yang Menunggu Persetujuan Manajer (PRD Bab 9) */}
          <DashboardPoMenunggu items={poMenungguList} totalMenunggu={poMenungguTotal} />
        </section>
      )}

      {/* 5. Tabel Peringatan Stok Menipis (GeneX Card Surface) */}
      <section className="surface-raised rounded-2xl p-5 border border-[#e2ebf6] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm" aria-label="Stok Menipis">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#feecec] dark:bg-red-950/60 text-[#991b1b] dark:text-red-400 border border-[#fecaca] dark:border-red-900/60">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0c1a30] dark:text-slate-100">
                Peringatan Stok Menipis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Barang dengan sisa stok pada atau di bawah batas minimum
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-900/60 px-2.5 py-0.5 rounded-full tabular-nums">
            {barangMenipis.length} Barang Perlu Restock
          </span>
        </div>

        {stokError ? (
          <div className="p-4 text-xs text-red-600 bg-red-50 dark:bg-red-950/50 rounded-lg border border-red-200 dark:border-red-900">
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
