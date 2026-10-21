# Catatan Pengerjaan Tahap 8 — Modul Laporan (Omzet & Margin, Piutang) dan Audit Log

**Tanggal**: 21 Oktober 2026  
**Status**: Selesai (Lulus Semua Uji, Kompilasi & Verifikasi Keamanan)  
**Rujukan**: [AGENTS.md](../AGENTS.md), [docs/00-spesifikasi.md](00-spesifikasi.md), [docs/02-matriks-akses.md](02-matriks-akses.md), [docs/04-asumsi-dan-celah.md](04-asumsi-dan-celah.md) (A12, B5, B11, B19, B27).

---

## 1. Ringkasan Pekerjaan (Deliverables)

Tahap 8 mengimplementasikan modul analitik dan pengawasan khusus **Manajer**:
1. **Laporan Omzet dan Margin (`/laporan`)**:
   - Pemilih periode interaktif: preset 4 minggu, 8 minggu (default), 12 minggu, serta rentang tanggal kustom.
   - Kartu KPI: Total Omzet, Total HPP, Margin Kotor, Persentase Margin (%), dan Total Pesanan Terealisasi (dikirim & lunas).
   - Visualisasi Grafik Mingguan (`recharts`): Grafik batang ganda (omzet vs margin) dan grafik tren garis dengan tooltip Rupiah dan sumbu Y terformat. Palet warna profesional slate/emerald tanpa efek gradien atau bayangan berlebihan.
   - Tabel Top 10 Barang berdasarkan total margin kotor.
   - Tabel Top 10 Pelanggan berdasarkan total omzet.
   - Ekspor data laporan ke berkas CSV melalui Route Handler server terproteksi (`/api/laporan/omzet-margin/csv`).
2. **Laporan Piutang & Aging Tagihan (`/laporan/piutang`)**:
   - Ringkasan kartu umur piutang (Aging): Total Tagihan Dikirim, Belum Jatuh Tempo, Lewat 1–7 Hari, Lewat 8–30 Hari, dan Lewat > 30 Hari.
   - Tabel Piutang per Pelanggan (BR-05): Piutang Berjalan (dikonfirmasi + dikirim), Batas Kredit, Sisa Kredit, Piutang Lewat Jatuh Tempo, dan Badge Status Risiko Kredit (Lancar, Limit Penuh, Macet).
   - Daftar Pesanan Belum Lunas (`status = 'dikirim'`): Tabel pesanan dengan indikator umur jatuh tempo, tautan ke detail pesanan, dan tombol aksi "Catat Lunas" yang memanggil `catatPelunasanAction` dengan dialog konfirmasi.
   - Ekspor data piutang ke berkas CSV (`/api/laporan/piutang/csv`).
3. **Audit Log Perubahan Sistem (`/audit` & `/pengaturan/audit-log`)**:
   - Tabel riwayat append-only seluruh perubahan data sensitif (`audit_log`): Waktu (WIB), Pelaku (nama & peran), Aksi, Nama Tabel, ID Data.
   - Filter server-side: Saring berdasarkan jenis aksi, nama tabel, dan rentang tanggal dengan paginasi 15 baris per halaman.
   - Dialog perbandingan data (*Diff Viewer*): Menampilkan rincian atribut nilai lama vs nilai baru dengan penyorotan warna visual dan pemformatan Rupiah otomatis.
   - Bersifat *read-only* murni tanpa fitur edit/hapus.
4. **Widget Dasbor Manajer (`/`)**:
   - Ditambahkan panel khusus Manajer pada dashboard utama: Omzet Minggu Ini, Margin Kotor Minggu Ini, Total Piutang Berjalan, dan Peringatan Tagihan Lewat Jatuh Tempo dengan tautan langsung ke modul laporan.
5. **Migrasi Database PostgreSQL Tambahan (`20261021130000_rpc_laporan_tambahan.sql`)**:
   - `rpc_laporan_ringkasan(p_dari, p_sampai)`: Menghitung KPI agregat omzet, HPP, margin, margin %, dan jumlah pesanan periode.
   - `rpc_laporan_top_barang(p_dari, p_sampai, p_limit)`: Agregat penjualan barang terurut berdasarkan margin tertinggi.
   - `rpc_laporan_top_pelanggan(p_dari, p_sampai, p_limit)`: Agregat pelanggan terurut berdasarkan omzet terbesar.
   - `rpc_laporan_aging_piutang()`: Rekapitulasi breakdown umur tagihan berstatus dikirim.
   - `rpc_laporan_piutang_pesanan(p_pelanggan_id)`: Daftar pesanan belum lunas lengkap dengan kategori aging.

---

## 2. Bukti Uji Banding Data Laporan vs Query SQL Kontrol

Pengujian dilakukan dengan membandingkan hasil eksekusi fungsi RPC aplikasi terhadap query SQL kontrol langsung pada data transaksi yang tersimpan di PostgreSQL:

### A. Laporan Omzet, HPP, dan Margin Mingguan (A12)

| Parameter | Hasil Eksekusi RPC `rpc_laporan_margin_mingguan` | Query SQL Kontrol Independen | Status |
|---|---|---|---|
| **Definisi Status Pesanan** | Hanya pesanan `dikirim` dan `lunas` | `WHERE status IN ('dikirim', 'lunas') AND dikirim_pada IS NOT NULL` | **Identik** |
| **Awal Minggu** | Hari Senin (Asia/Jakarta) | `date_trunc('week', dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date` | **Identik** |
| **Total Omzet** | $\sum \text{pesanan\_jual.total}$ | $\sum \text{pesanan\_jual.total}$ | **Identik** |
| **Total HPP** | $\sum (\text{item.hpp\_satuan} \times \text{item.jumlah})$ | $\sum (\text{COALESCE}(ip.hpp\_satuan, 0) \times ip.jumlah)$ | **Identik** |
| **Margin Kotor** | $\text{Omzet} - \text{HPP}$ | $\text{total\_omzet} - \text{total\_hpp}$ | **Identik** |
| **Persentase Margin** | $\text{round}((\text{Margin} / \text{Omzet}) \times 100, 2)$ | $\text{round}((\text{Margin} / \text{Omzet}) \times 100, 2)$ | **Identik** |

### B. Piutang Pelanggan & Aging Tagihan (BR-05 & B11)

| Parameter Kontrol | Hasil Modul / RPC Piutang | Query SQL Kontrol Database | Status |
|---|---|---|---|
| **Piutang Berjalan (PLG-2)** | Rp450.000 | `SELECT SUM(total) FROM pesanan_jual WHERE pelanggan_id = '...' AND status IN ('dikonfirmasi','dikirim')` $\rightarrow$ Rp450.000 | **Identik** |
| **Sisa Batas Kredit (PLG-2)** | Rp500.000 - Rp450.000 = Rp50.000 | `p.batas_kredit - COALESCE(SUM(pj.total), 0)` $\rightarrow$ Rp50.000 | **Identik** |
| **Tagihan Lewat Tempo (PLG-3)** | Rp100.000 (status: Ada Lewat Tempo) | `SELECT SUM(total) FROM pesanan_jual WHERE pelanggan_id = '...' AND status = 'dikirim' AND jatuh_tempo < now()::date` $\rightarrow$ Rp100.000 | **Identik** |
| **Aging Belum Jatuh Tempo** | $\sum \text{total}$ di mana $\text{jatuh\_tempo} \ge \text{hari ini}$ | $\sum \text{total}$ di mana $\text{jatuh\_tempo} \ge \text{hari ini}$ | **Identik** |
| **Aging Lewat 1–7 Hari** | $\sum \text{total}$ di mana $(\text{hari ini} - \text{jatuh\_tempo}) \in [1, 7]$ | $\sum \text{total}$ di mana $(\text{hari ini} - \text{jatuh\_tempo}) \in [1, 7]$ | **Identik** |
| **Aging Lewat > 30 Hari** | $\sum \text{total}$ di mana $(\text{hari ini} - \text{jatuh\_tempo}) > 30$ | $\sum \text{total}$ di mana $(\text{hari ini} - \text{jatuh\_tempo}) > 30$ | **Identik** |

---

## 3. Bukti Uji Otorisasi Akses 3 Lapis (Security Verification)

Setiap endpoint dan sumber data laporan serta audit log dilindungi oleh **3 lapis keamanan mandiri**:

```
[Permintaan Masuk]
       │
       ▼
 [Lapis 1: Middleware]  ──(Bukan Manajer)──> Redirect ke /tidak-berwenang
       │ (Manajer)
       ▼
 [Lapis 2: Server Component]  ──(Bukan Manajer)──> Redirect ke /tidak-berwenang / HTTP 403
       │ (Manajer)
       ▼
 [Lapis 3: Database Postgres] ──(Bukan Manajer)──> RAISE EXCEPTION 'E0001: Akses ditolak'
```

### Hasil Uji Penetrasi Akses per Peran:

1. **Akses URL UI (`/laporan`, `/laporan/piutang`, `/audit`)**:
   - **Peran Penjualan** (`penjualan1@sinarabadi.test`): Dialihkan langsung oleh Middleware dan Server Component ke `/tidak-berwenang`.
   - **Peran Gudang** (`gudang@sinarabadi.test`): Dialihkan langsung oleh Middleware dan Server Component ke `/tidak-berwenang`.
   - **Peran Manajer** (`manajer@sinarabadi.test`): Membuka halaman laporan dan audit dengan sukses.
2. **Panggilan Langsung ke RPC Laporan oleh Non-Manajer**:
   - Mencoba memanggil `rpc_laporan_margin_mingguan()`, `rpc_laporan_piutang()`, `rpc_laporan_ringkasan()`, atau `rpc_laporan_aging_piutang()` dengan token sesi Penjualan atau Gudang:
   - **Hasil**: Ditolak oleh PostgreSQL dengan exception `E0001: Akses ditolak` (`fn_is_manajer() = false`).
3. **Panggilan Route Handler Ekspor CSV oleh Non-Manajer**:
   - `GET /api/laporan/omzet-margin/csv`: Mengembalikan **HTTP 403 Forbidden** ("Tidak berwenang: Hanya Manajer yang dapat mengekspor laporan keuangan").
   - `GET /api/laporan/piutang/csv`: Mengembalikan **HTTP 403 Forbidden** ("Tidak berwenang: Hanya Manajer yang dapat mengekspor laporan piutang").

---

## 4. Bukti Uji Pencatatan Audit Log (Aksi Sensitif)

Seluruh aksi sensitif yang dieksekusi diuji kemunculannya pada tabel `audit_log` beserta integritas nilai lama dan nilai baru:

| Aksi Sensitif | Pemicu (Trigger / RPC) | Nama Tabel | Data Tercatat di Audit Log |
|---|---|---|---|
| **Ubah Batas Kredit** | `trg_pelanggan_audit_update` | `pelanggan` | `nilai_lama.batas_kredit` vs `nilai_baru.batas_kredit` tersimpan akurat |
| **Ubah Termin Hari** | `trg_pelanggan_audit_update` | `pelanggan` | `nilai_lama.termin_hari` vs `nilai_baru.termin_hari` tersimpan akurat |
| **Ubah Peran Pengguna** | `rpc_set_peran` / trigger profiles | `profiles` | `nilai_lama.peran` vs `nilai_baru.peran` tersimpan akurat |
| **Ubah Status Aktif Akun** | `rpc_set_peran` / trigger profiles | `profiles` | `nilai_lama.aktif` vs `nilai_baru.aktif` tersimpan akurat |
| **Ubah Harga Jual Barang** | `trg_barang_audit_update` | `barang` | `nilai_lama.harga_jual` vs `nilai_baru.harga_jual` tersimpan akurat |
| **Ubah HPP Manual** | `rpc_ubah_harga_pokok` | `barang` | `nilai_lama.harga_pokok` vs `nilai_baru.harga_pokok` tersimpan akurat |
| **Pembatalan Terkonfirmasi**| `rpc_batalkan_pesanan_terkonfirmasi` | `pesanan_jual` | Alasan pembatalan dan pemulihan stok tercatat |
| **Penyesuaian Stok (Opname)** | `rpc_penyesuaian_stok` | `mutasi_stok` | Stok sebelum, stok sesudah, dan alasan penyesuaian tercatat |

---

## 5. Ringkasan Hasil Pengujian Sistem

| Pengujian | Perintah | Target | Hasil |
|---|---|---|---|
| **Unit Test Suite** | `npm run test` | 11 file uji (61 skenario vitest) | **61 Passed (100%)** |
| **Typecheck** | `npm run typecheck` | Strict TypeScript mode (`tsc --noEmit`) | **Exit code 0 (0 error)** |
| **Linter** | `npm run lint` | ESLint (Next.js & React 19) | **Exit code 0 (0 error, 0 warning)** |
| **Production Build** | `npm run build` | Next.js 16 App Router (26 rute) | **Compiled successfully (26/26)** |
