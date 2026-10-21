# Catatan Pengerjaan Tahap 7 — Modul Pembelian (PO), Penerimaan Barang, dan Kartu Mutasi Stok

**Tanggal**: 21 Oktober 2026  
**Status**: Selesai (Lulus Semua Uji & Verifikasi)  
**Rujukan**: [AGENTS.md](../AGENTS.md), [docs/00-spesifikasi.md](00-spesifikasi.md) (BR-01, BR-09 s.d. BR-12), [docs/02-matriks-akses.md](02-matriks-akses.md), [docs/03-test-plan.md](03-test-plan.md), [docs/04-asumsi-dan-celah.md](04-asumsi-dan-celah.md).

---

## 1. Ringkasan Pekerjaan (Deliverables)

Tahap 7 mengimplementasikan modul **Pembelian (Purchase Order / PO)**, **Penerimaan Barang**, serta **Daftar Inventaris dan Kartu Mutasi Stok** (termasuk Penyesuaian Stok / Stock Opname). Seluruh perubahan status, mutasi stok, dan pembaharuan HPP dieksekusi secara atomik oleh fungsi RPC PostgreSQL (`SECURITY DEFINER`):

1. **Skema Validasi Zod & Unit Tests**:
   - `src/features/pembelian/schemas.ts`:
     - `ajukanPembelianSchema`: Validasi pemasok aktif, barang aktif, jumlah dipesan antara 1 s.d. 10.000 unit.
     - `setujuiPembelianSchema`: Validasi ID pembelian dan harga beli satuan $> 0$.
     - `tolakPembelianSchema`: Validasi ID pembelian dan alasan penolakan minimal 10 karakter bersih (*trimmed*).
     - `terimaPembelianSchema`: Validasi ID pembelian dan jumlah diterima ($1 \le \text{jumlah} \le \text{jumlah dipesan}$).
     - Unit test di `src/features/pembelian/__tests__/schemas.test.ts` (9 test cases lolos 100%).
   - `src/features/stok/schemas.ts`:
     - `penyesuaianStokSchema`: Validasi barang aktif, stok fisik baru $\ge 0$, dan alasan penyesuaian minimal 10 karakter bersih (*trimmed*).
     - Unit test di `src/features/stok/__tests__/schemas.test.ts` (3 test cases lolos 100%).
   - `src/features/stok/__tests__/invarian.test.ts`:
     - Validasi matematis invarian kartu stok: delta bertanda dan jaminan bahwa `stok_sesudah` baris mutasi terakhir sama persis dengan `stok` barang master (2 test cases lolos 100%).

2. **Server Actions (`src/features/pembelian/actions.ts` & `src/features/stok/actions.ts`)**:
   - `ajukanPembelianAction`: Memanggil `rpc_ajukan_pembelian(p_pemasok_id, p_barang_id, p_jumlah_dipesan)`.
   - `setujuiPembelianAction`: Memanggil `rpc_setujui_pembelian(p_pembelian_id, p_harga_beli_satuan)`.
   - `tolakPembelianAction`: Memanggil `rpc_tolak_pembelian(p_pembelian_id, p_alasan)`.
   - `terimaPembelianAction`: Memanggil `rpc_terima_pembelian(p_pembelian_id, p_jumlah_diterima)`.
   - `penyesuaianStokAction`: Memanggil `rpc_penyesuaian_stok(p_barang_id, p_stok_baru, p_alasan)`.

3. **Halaman & Komponen Frontend**:
   - `src/app/(dashboard)/pembelian/page.tsx`:
     - Daftar PO dengan filter status (`diajukan`, `disetujui`, `ditolak`, `diterima`), filter pemasok, filter rentang tanggal, pencarian nomor, dan paginasi 15 baris per halaman.
     - Sesuai RLS dan Matriks Akses: Gudang membaca view `v_pembelian` (tanpa kolom harga beli), Manajer membaca view `v_pembelian_manajer` (menampilkan kolom `harga_beli_satuan` dan `total_estimasi_beli`). Penjualan diblokir (`redirect('/tidak-berwenang')`).
   - `src/app/(dashboard)/pembelian/baru/page.tsx`:
     - Formulir pengajuan PO baru dengan dropdown pemasok aktif dan barang aktif.
     - Mendukung *prefill* otomatis via URL query parameter `?barang=<id>` (terintegrasi langsung dari peringatan stok kritis di dashboard).
   - `src/app/(dashboard)/pembelian/[id]/page.tsx`:
     - Detail lengkap PO, visualisasi *lifecycle timeline*, dan dialog aksi interaktif:
       - **Manajer**: Menyetujui PO dengan input harga beli satuan (Rp) atau Menolak PO dengan dialog input alasan minimal 10 karakter.
       - **Gudang / Manajer**: Menerima PO yang sudah disetujui dengan input jumlah diterima, disertai peringatan bahwa penerimaan bersifat final (hanya 1 kali).
   - `src/app/(dashboard)/stok/page.tsx`:
     - Daftar inventaris master barang lengkap dengan indikator stok kritis (badge merah bila $\le \text{stok minimum}$), tombol pintasan "Kartu Stok", tombol "Opname" (Penyesuaian Stok), dan tombol cepat "Ajukan PO".
   - `src/app/(dashboard)/stok/[barangId]/page.tsx`:
     - Buku besar kartu mutasi stok barang (`mutasi_stok`) dengan filter jenis mutasi (`masuk`, `keluar`, `penyesuaian`, `batal`), filter tanggal, ringkasan pergerakan (Total Masuk vs Total Keluar), kolom delta bertanda, stok sesudah, nomor referensi dokumen tertaut ke PO (`/pembelian/[id]`) atau SO (`/pesanan/[id]`), alasan, dan staf pencatat.
   - `src/app/(dashboard)/page.tsx`:
     - Memperbarui tabel peringatan stok menipis pada Dashboard untuk menyertakan tombol cepat "Ajukan PO" yang langsung membuka `/pembelian/baru?barang=<id>` bagi peran Gudang dan Manajer.
   - `src/lib/akses.ts` & `src/components/layout/sidebar.tsx`:
     - Menambahkan rute `/stok` ke `ROUTE_PERMISSIONS` (dapat diakses oleh Gudang dan Manajer) dan menambahkan menu navigasi "Kartu Stok" dengan ikon `Layers`.

---

## 2. Bukti Uji Skenario Wajib & Test Plan

### (a) Skenario Wajib 1: PO Jumlah 0 & 10.001 Ditolak (TC-19)
- **Tindakan**: Pengguna mencoba mengajukan PO dengan jumlah $0$ atau $10.001$.
- **Hasil Klien**: Skema Zod `ajukanPembelianSchema` menolak dengan pesan validasi:
  ```
  Jumlah dipesan minimal 1 unit / Jumlah dipesan maksimal 10.000 unit
  ```
- **Hasil Server / Database**: Jika dipanggil langsung ke database via RPC `rpc_ajukan_pembelian`, constraint guard database menolak dengan exception `E0013` ("Jumlah dipesan harus antara 1 dan 10.000").
- **Status**: **LULUS**

### (b) Skenario Wajib 2: Kerahasiaan Harga Beli untuk Staf Gudang (TC-20)
- **Aktor**: `gudang@sinarabadi.test`
- **Tindakan**: Membuka daftar PO di `/pembelian` dan detail PO di `/pembelian/[id]`.
- **Hasil UI**:
  - Kolom "Harga Beli Satuan" dan "Total Estimasi Beli" sama sekali tidak dirender di antarmuka Gudang.
  - Gudang hanya melihat Nomor PO, Tanggal, Pemasok, Barang, Status, Jumlah Dipesan, dan Jumlah Diterima.
- **Hasil Respons Jaringan (RSC Payload)**:
  - Query dieksekusi ke view publik `v_pembelian` (bukan view manajer).
  - Objek data `harga_beli_satuan` dan `total_estimasi_beli` bernilai `null` / tidak dikirim dalam serialisasi RSC payload.
- **Status**: **LULUS**

### (c) Skenario Wajib 3: Tolak PO Alasan < 10 Karakter Ditolak, >= 10 Karakter Berhasil (TC-21)
- **Aktor**: `manajer@sinarabadi.test`
- **Kondisi**: PO berstatus `diajukan`.
- **Tindakan 1**: Manajer menolak dengan alasan `"batal"` (5 karakter).
  - **Hasil**: Ditolak oleh Zod dan Server Action dengan pesan: `"Alasan penolakan minimal 10 karakter"`.
- **Tindakan 2**: Manajer menolak dengan alasan `"Pemasok kehabisan stok bahan baku bulan ini"` (44 karakter).
  - **Hasil**: RPC `rpc_tolak_pembelian` berhasil dieksekusi. Status PO berubah menjadi `ditolak`, timestamp `diputuskan_pada` tercatat, dan alasan penolakan ditampilkan pada timeline detail PO.
- **Status**: **LULUS**

### (d) Skenario Wajib 4: PO Disetujui, Diterima, Penerimaan Kedua Ditolak (TC-22)
- **Aktor 1 (Manajer)**: Menyetujui PO dengan harga beli satuan Rp12.000. Status PO berubah menjadi `disetujui`.
- **Aktor 2 (Gudang)**:
  - Mengklik tombol "Terima Barang", memasukkan jumlah diterima (misal 50 unit).
  - Sistem mengeksekusi `rpc_terima_pembelian`. Status PO berubah menjadi `diterima` dan `jumlah_diterima` terisi 50.
- **Tindakan Penerimaan Kedua**:
  - Tombol terima barang di UI otomatis dinonaktifkan/hilang karena status sudah `diterima`.
  - Jika dicoba panggil ulang via RPC, database menolak dengan exception `E0016` ("Pembelian sudah pernah diterima atau tidak dalam status disetujui").
- **Status**: **LULUS**

### (e) Skenario Wajib 5: Dampak Penerimaan Barang pada Stok, Kartu Stok, dan HPP (TC-22 & BR-01)
- **Kondisi Sebelum Penerimaan**:
  - Barang `BRG-001`: Stok = 10 unit, HPP = Rp10.000.
- **Penerimaan Barang**:
  - PO diterima sebanyak 10 unit dengan harga beli Rp12.000.
- **Hasil Setelah Penerimaan**:
  1. **Stok Barang**: Bertambah menjadi $10 + 10 = 20\text{ unit}$.
  2. **HPP (Moving Average Formula BR-01)**:
     $$\text{HPP Baru} = \text{round}\left(\frac{(10 \times 10.000) + (10 \times 12.000)}{10 + 10}\right) = \text{round}\left(\frac{100.000 + 120.000}{20}\right) = \text{Rp}11.000$$
     Tercatat otomatis di master `barang.harga_pokok`.
  3. **Buku Besar Kartu Mutasi Stok (`mutasi_stok`)**:
     - Jenis: `masuk`.
     - Jumlah: `+10`.
     - Stok Sebelum: `10`, Stok Sesudah: `20`.
     - Nomor Dokumen: Terhubung langsung ke nomor PO yang bersangkutan.
     - Dibuat Oleh: ID pengguna staf Gudang yang menerima barang.
- **Status**: **LULUS**

### (f) Skenario Wajib 6: Penyesuaian Stok (Stock Opname) (TC-24 & TC-25)
- **Aktor**: `gudang@sinarabadi.test` atau `manajer@sinarabadi.test`
- **Tindakan 1 (Validasi Alasan)**: Menginput alasan `"rusak"` (5 karakter).
  - **Hasil**: Ditolak dengan pesan `"Alasan penyesuaian minimal 10 karakter"`.
- **Tindakan 2 (Eksekusi Opname)**:
  - Stok awal: 50 unit. Stok fisik aktual: 47 unit (selisih $-3$ unit).
  - Alasan: `"Penyesuaian stok opname fisik triwulan: 3 unit pecah dalam gudang"`.
  - **Hasil**:
    1. Master `barang.stok` diperbarui menjadi `47`.
    2. Baris baru di `mutasi_stok`:
       - Jenis: `penyesuaian`.
       - Jumlah: `-3` (negatif).
       - Stok Sebelum: `50`, Stok Sesudah: `47`.
       - Keterangan: alasan tersimpan utuh di kolom keterangan.
       - Dibuat Oleh: ID staf yang melakukan penyesuaian.
- **Status**: **LULUS**

### (g) Skenario Wajib 7: Invarian Konsistensi Kartu Stok (TC-26)
- **Formula Konsistensi**:
  $$\text{stok\_sesudah}_n = \text{stok\_sebelum}_n + \Delta_n$$
  $$\text{stok\_sebelum}_{n+1} = \text{stok\_sesudah}_n$$
  $$\text{stok\_sesudah}_{\text{terakhir}} = \text{barang.stok}$$
- **Pembuktian**:
  - Divalidasi lewat unit test `src/features/stok/__tests__/invarian.test.ts`.
  - Seluruh deret mutasi berurutan menghasilkan nilai `stok_sesudah` yang identik dengan stok master barang.
- **Status**: **LULUS**

---

## 3. Hasil Pengujian & Verifikasi Kualitas

| Jenis Pengujian | Perintah | Target / Skenario | Hasil |
|---|---|---|---|
| **Unit Test Suite** | `npm run test` | 10 file pengujian (57 skenario uji Zod, perhitungan, invarian, format, error) | **57 Passed (100%)** |
| **Typecheck** | `npm run typecheck` | Strict TypeScript mode (`tsc --noEmit`) tanpa `any` | **Exit code 0 (0 error)** |
| **Linter** | `npm run lint` | ESLint Next.js & React 19 compiler rules | **Exit code 0 (0 error)** |
| **Production Build** | `npm run build` | Next.js 16 App Router build (25 rute statis & dinamis) | **Compiled successfully** |

---

## 4. Kepatuhan Sistem Desain & Konvensi
- **Tampilan ERP Korporat**: Menggunakan data table padat (`text-xs` / `text-sm`, padding ramping `py-2 px-3`), border netral `border-slate-200`, angka berformat tabular (`tabular-nums`), rata kanan untuk stok dan mata uang, tanpa gradien mencolok maupun dekorasi berlebihan.
- **Perlindungan Data Rahasia**: Sesuai `AGENTS.md`, staf non-Manajer tidak pernah menerima data `harga_beli_satuan`, `total_estimasi_beli`, maupun `harga_pokok`.
- **Integrasi Antarmuka**: Seluruh mutasi divalidasi dengan Zod, diproses via Server Actions, dan menampilkan pesan error ramah Bahasa Indonesia dari Postgres RPC.
