# Fitur: Penyesuaian Dashboard & Laporan Manajer Sesuai PRD Bab 9

Dokumen ini mendokumentasikan spesifikasi, keputusan arsitektur, aturan bisnis, dan hasil verifikasi penyesuaian Dashboard Manajer dan modul Laporan sesuai PRD Bab 9.

## 1. Ringkasan Fitur
Penyesuaian ini menyelaraskan tampilan metrik finansial, aging piutang, kontrol stok menipis, dan pengadaan barang pada Dashboard Manajer dan menu `/laporan` dengan ketentuan PRD Bab 9:
1. **Dashboard Manajer: Bulan Berjalan**:
   - Omzet dihitung dari pesanan berstatus `dikirim` dan `lunas` berdasarkan tanggal `dikirim_pada` dalam rentang bulan berjalan (zona waktu `Asia/Jakarta`).
   - Margin kotor dihitung dengan formula `margin baris = subtotal - (hpp_satuan x jumlah)` untuk pesanan `dikirim` dan `lunas` (pesanan draf dan dibatalkan tidak dihitung). Tampil dalam rupiah dan persentase margin rasio terhadap omzet.
   - Piutang Berjalan menghitung total piutang pesanan `dikonfirmasi` (belum kirim) dan pesanan `dikirim` (belum lunas).
   - Indikator barang stok menipis disaring ketat hanya untuk barang berstatus aktif (`aktif = true`) dengan `stok <= stok_minimum`.
   - Grafik batang tren keuangan menampilkan omzet dan margin selama **8 minggu terakhir**.
   - Daftar pengajuan pembelian (`PO`) yang berstatus `diajukan` ditampilkan pada panel Manajer untuk memudahkan persetujuan harga beli.
2. **Laporan Margin Produk (`/laporan`)**:
   - Menambahkan tabel **5 Barang Margin Terkecil** berdampingan dengan 10 Barang Margin Terbesar melalui RPC `rpc_laporan_bottom_barang`.
3. **Aging Piutang Tepat 3 Kelompok**:
   - Tepat 3 kelompok aging:
     1. `Belum Jatuh Tempo`: pesanan `dikonfirmasi` + pesanan `dikirim` dengan `jatuh_tempo >= hari_ini (WIB)`.
     2. `Lewat 1-30 Hari`: pesanan `dikirim` dengan selisih `hari_ini - jatuh_tempo` antara 1 s.d. 30 hari.
     3. `Lewat >30 Hari`: pesanan `dikirim` dengan selisih `hari_ini - jatuh_tempo > 30` hari.
   - Invarian terjaga 100%: `Total Aging = Belum Jatuh Tempo + Lewat 1-30 Hari + Lewat >30 Hari = Piutang Berjalan`.
4. **Format Rupiah Baku**:
   - Seluruh angka uang diformat baku `Rp1.250.000` tanpa spasi atau singkatan ambigu melalui utilitas `@/lib/format`.
5. **Zero-Leakage Kerahasiaan Data**:
   - Penjualan dan Gudang diblokir pada tingkat fungsi database (`IF NOT fn_is_manajer() THEN RAISE EXCEPTION 'E0002...'`).
   - Dashboard Penjualan dan Gudang tidak memuat komponen finansial, harga pokok, maupun margin kotor.

## 2. Peta Perubahan Komponen & Database

### 2.1 Database (PostgreSQL RPC & View)
- File Migrasi: `supabase/migrations/20261026160000_dashboard_laporan_prd_bab_9.sql`
- **`rpc_laporan_bottom_barang(p_dari, p_sampai, p_limit DEFAULT 5)`**:
  - Mengagregasi `v_margin_penjualan_manajer` dengan `ORDER BY total_margin ASC LIMIT p_limit`.
  - Dilindungi `SECURITY DEFINER` dan verifikasi hak Manajer `fn_is_manajer()`.
- **`rpc_laporan_aging_piutang()`**:
  - Menghasilkan tepat 3 bucket: `belum_jatuh_tempo`, `lewat_1_30_hari`, `lewat_gt_30_hari`.
  - Mengembalikan `total_piutang_berjalan` dan `total_pesanan` yang konsisten dengan jumlah ketiga bucket tersebut.
- **`rpc_laporan_piutang()` & `rpc_laporan_piutang_pesanan()`**:
  - Diperbarui untuk mengembalikan `piutang_lewat_1_30` dan `piutang_lewat_gt_30`.

### 2.2 Frontend & Server Components
- `src/features/laporan/types.ts`: Memperbarui tipe `LaporanAgingPiutang`, `BottomBarangItem`, dan `LaporanPiutangPelangganItem`.
- `src/features/laporan/components/bottom-barang-table.tsx`: Komponen tabel 5 barang margin terendah dengan badge peringkat dan warna adaptif.
- `src/app/(dashboard)/laporan/page.tsx`: Menampilkan Top 10 dan Bottom 5 berdampingan dalam grid responsif.
- `src/features/laporan/components/piutang-aging-cards.tsx`: Kartu ringkasan 3 kelompok aging piutang.
- `src/features/laporan/components/piutang-pelanggan-table.tsx`: Breakdown 3 kelompok aging per pelanggan.
- `src/features/laporan/components/piutang-pesanan-table.tsx`: Filter dan badge 3 kelompok aging per faktur.
- `src/features/dashboard/components/dashboard-po-menunggu.tsx`: Komponen daftar pengajuan PO menunggu persetujuan Manajer.
- `src/app/(dashboard)/page.tsx`:
  - Default preset diubah menjadi `bulan_ini` ("Bulan Berjalan").
  - Menghitung rentang 8 minggu terakhir (`dari8Minggu`) untuk `rpc_laporan_margin_mingguan`.
  - Menyaring stok menipis dengan `.eq("aktif", true)`.
  - Mengambil data pengajuan pembelian berstatus `diajukan` dan menampilkannya melalui `DashboardPoMenunggu`.
  - Bento Card 2 menampilkan `Piutang Berjalan` (`total_piutang_berjalan`).

## 3. Rencana Pengujian (Test Plan)
Pengujian didokumentasikan di `docs/03-test-plan.md` dengan penomoran **TC-234 s.d. TC-238**:
- **TC-234**: Agregasi 5 barang margin terendah pada pesanan dikirim & lunas.
- **TC-235**: Tepat 3 kelompok aging piutang pada `rpc_laporan_aging_piutang`.
- **TC-236**: Invarian matematis total aging tepat sama dengan piutang berjalan.
- **TC-237**: Omzet dan margin kotor bulan berjalan dihitung berdasarkan tanggal `dikirim_pada` (Asia/Jakarta).
- **TC-238**: Zero-leakage data finansial rahasia untuk staf non-Manajer.

## 4. Hasil Verifikasi
1. **Vitest Unit & Integration**:
   - `src/features/laporan/__tests__/laporan.test.ts`: 7 tes lulus 100%.
   - Seluruh tes suite: 23 test files, 176 tes lulus tanpa kegagalan.
2. **TypeScript Strict**:
   - `npx tsc --noEmit` lulus dengan 0 kesalahan tipe (exit code 0).
3. **ESLint**:
   - `npm run lint` lulus tanpa warning atau error.
4. **Next.js Production Build**:
   - `npm run build` sukses melakukan kompilasi seluruh rute aplikasi tanpa kendala.
