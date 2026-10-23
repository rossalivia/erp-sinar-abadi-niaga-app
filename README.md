# ERP CV Sinar Abadi Niaga

Sistem Informasi Perencanaan Sumber Daya Perusahaan (Enterprise Resource Planning - ERP) terpadu untuk distributor barang konsumsi (FMCG/sembako) **CV Sinar Abadi Niaga**. Dibangun dengan arsitektur modern berstandar enterprise yang menitikberatkan pada integritas data, keamanan finansial multi-lapis, dan konsistensi transaksi stok real-time.

---

## 1. Ikhtisar Fitur Utama

- **Otentikasi & Otorisasi Peran (RBAC):** Pemisahan wewenang ketat antara tiga peran utama:
  - **Staf Penjualan:** Manajemen pelanggan, permohonan pesanan jual (SO) dengan batasan diskon maks. 10%, pemantauan limit kredit dan tagihan jatuh tempo.
  - **Staf Gudang:** Manajemen katalog barang non-harga, pemasok, pengajuan pesanan pembelian (PO), penerimaan barang fisik, opname stok, dan kartu mutasi stok otomatis.
  - **Manajer:** Otorisasi harga jual, persetujuan diskon hingga 25%, persetujuan pesanan di bawah HPP, penyesuaian limit kredit/termin, persetujuan/penolakan PO pembelian, pelunasan piutang, pembatalan pesanan terkonfirmasi, laporan laba rugi mingguan, rekapitulasi umur piutang, dan peninjauan riwayat audit log.
- **Integritas Stok & State Machine:**
  - Perubahan stok hanya terjadi melalui fungsi RPC mutasi resmi (`konfirmasi_pesanan`, `terima_pembelian`, `sesuaikan_stok`, `batalkan_pesanan`). Update langsung ke kolom stok diblokir di database.
  - Invarian kartu stok terjaga: `SUM(mutasi_stok.jumlah) = barang.stok`.
  - Penanganan race condition stok bersamaan dan transaksi multi-baris atomik bebas deadlock (`SELECT ... FOR UPDATE` terurut).
- **Kerahasiaan Nilai Finansial (Zero-Leak Security):**
  - Kolom sensitif (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, margin laba) dilindungi di level database melalui **Column-Level Grants** dan **Row-Level Security (RLS)**.
  - Nilai finansial rahasia tidak pernah diekspos ke klien non-Manajer, baik pada antarmuka web, respons payload jaringan, maupun log aplikasi.
- **Desain Enterprise/ERP Korporat:**
  - Antarmuka bersih, tenang, dan profesional menggunakan nuansa netral (Slate), tabel data padat (*dense data tables*), tipografi modern sans-serif, format angka moneter tabular rata kanan (`tabular-nums`), dan status badge berpewarnaan redup dengan kontras tinggi.
- **Proteksi Tertutup (Noindex):**
  - Aplikasi internal korporat yang kebal perayapan mesin pencari via header HTTP `X-Robots-Tag: noindex, nofollow`, `robots.txt` statis, dan meta robots HTML.

---

## 2. Arsitektur & Tumpukan Teknologi

- **Frontend:** [Next.js](https://nextjs.org/) (App Router), React 19, TypeScript (*strict mode*).
- **Gaya Visual:** [Tailwind CSS](https://tailwindcss.com/) dengan palet enterprise Slate/Neutral dan Radix UI primitives.
- **Visualisasi Data:** [Recharts](https://recharts.org/) (Grafik Omzet & Margin Mingguan).
- **Validasi Data:** [Zod](https://zod.dev/) pada Server Actions di frontend.
- **Database & Backend:** [Supabase](https://supabase.com/) PostgreSQL:
  - Seluruh logika bisnis berada di fungsi database Postgres (RPC dengan `SECURITY DEFINER`).
  - Row-Level Security (RLS) pada 100% tabel transaksi dan master.
  - Column-Level Privilege Grants (`REVOKE ALL` dari `anon` & `authenticated`, `GRANT SELECT` hanya pada kolom non-rahasia).
  - Database Trigger Guards untuk validasi integritas kolom.
  - **Tanpa Service-Role Key:** Aplikasi berjalan 100% menggunakan Anon Key + Sesi Pengguna terotentikasi.
- **Pengujian:**
  - Unit & Integration: [Vitest](https://vitest.dev/) (61 skenario pengujian skema, utilitas, dan invarian).
  - End-to-End (E2E): [Playwright](https://playwright.dev/) (Uji alur transaksi, pencegahan kebocoran data jaringan, dan route guard).
  - Uji Konkurensi: SQL/Bash scripts (20/20 paralel pass pada locking stok dan limit kredit).

---

## 3. Struktur Direktori Proyek

```text
├── .github/workflows/ci.yml       # GitHub Actions CI (lint, typecheck, test, build)
├── docs/                          # Dokumentasi spesifikasi, matriks akses, & test plan
│   ├── 00-spesifikasi.md          # Dokumen spesifikasi bisnis (sumber kebenaran)
│   ├── 01-rencana-kerja.md        # Rencana kerja & deliverable 9 tahap
│   ├── 02-matriks-akses.md        # Matriks hak akses per peran & penegakannya
│   ├── 03-test-plan.md            # Laporan verifikasi 28 Test Case (100% Lulus)
│   ├── 04-asumsi-dan-celah.md     # Resolusi asumsi teknis & arsitektur
│   ├── 05-skema.md                # Dokumentasi relasi dan skema database
│   └── 11-laporan-verifikasi-rilis.md # Laporan audit rilis v1.0.0
├── netlify.toml                   # Konfigurasi deployment produksi Netlify
├── playwright.config.ts           # Konfigurasi Playwright E2E
├── public/
│   └── robots.txt                 # Perlindungan perayapan mesin pencari (Disallow: /)
├── scripts/                       # Skrip verifikasi katalog, instalasi, dan test runner
├── src/
│   ├── app/                       # Next.js App Router (dashboard, login, guards)
│   ├── components/                # Komponen UI atomik & tata letak bersama (AppShell)
│   ├── features/                  # Modul bisnis (barang, pelanggan, pesanan, pembelian, stok, laporan, akun)
│   ├── lib/                       # Supabase client/server, akses RBAC, pemformat rupiah/tanggal, mapping error
│   └── types/                     # Tipe data TypeScript & skema database otomatis
├── supabase/
│   ├── migrations/                # 8 File migrasi SQL Postgres (skema, trigger, view, grants, rls, rpc)
│   ├── seed.sql                   # Data seed lingkungan pengujian lokal
│   ├── seed-demo.sql              # Data seed demo produksi awal (tanpa kredensial)
│   └── tests/                     # Skrip uji keamanan SQL & konkurensi database
└── vitest.config.ts               # Konfigurasi pengujian unit Vitest
```

---

## 4. Akun Uji & Data Awal

Untuk lingkungan pengujian lokal (`supabase/seed.sql`), tersedia 5 akun representatif:

| Peran | Email Akun Uji | Wewenang Utama |
|---|---|---|
| **Staf Penjualan 1** | `penjualan1@sinarabadi.test` | Pesanan Jual, Pelanggan, Diskon ≤ 10% |
| **Staf Penjualan 2** | `penjualan2@sinarabadi.test` | Pesanan Jual, Uji Kepemilikan Draf |
| **Staf Gudang** | `gudang@sinarabadi.test` | Katalog Barang (tanpa harga), Pembelian/PO, Stok Opname |
| **Manajer** | `manajer@sinarabadi.test` | Seluruh Modul, Approval, Diskon ≤ 25%, Laporan, Audit Log |
| **Akun Nonaktif** | `nonaktif@sinarabadi.test` | Uji Pemblokiran Login Akun Nonaktif (TC-02) |

---

## 5. Menjalankan Aplikasi Secara Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) v20.x atau v22.x LTS
- [npm](https://www.npmjs.com/) v10+

### Langkah Instalasi
1. **Clone repositori:**
   ```bash
   git clone https://github.com/rossalivia/erp-sinar-abadi-niaga-app.git
   cd erp-sinar-abadi-niaga-app
   ```

2. **Pasang dependensi:**
   ```bash
   npm ci
   ```

3. **Konfigurasi Environment Variables:**
   Salin berkas contoh:
   ```bash
   cp .env.example .env.local
   ```
   Isi konfigurasi pada berkas `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```
   > **PENTING:** Aplikasi ini HANYA membutuhkan Anon Key publik. Jangan pernah menambahkan `SUPABASE_SERVICE_ROLE_KEY` ke dalam berkas `.env` atau kode frontend.

4. **Jalankan Server Pengembangan:**
   ```bash
   npm run dev
   ```
   Buka peramban di `http://localhost:3000`.

---

## 6. Verifikasi & Pengujian

Aplikasi dilengkapi dengan rangkaian pengujian berlapis:

- **Typecheck & Linting:**
  ```bash
  npm run typecheck
  npm run lint
  ```
- **Unit & Integration Test (Vitest):**
  ```bash
  npm run test
  ```
  Menjalankan 61 pengujian otomatis pada skema Zod, invarian kartu stok, format angka Rupiah, dan kalkulasi diskon/margin.
- **End-to-End Test (Playwright):**
  Salin `.env.test.example` menjadi `.env.test.local`, isi kata sandi akun uji Anda, lalu jalankan:
  ```bash
  npm run test:e2e
  ```
- **Status 28 Test Case:**
  Seluruh 28 Test Case terverifikasi Lulus 100%. Rincian bukti pengujian dapat ditinjau di [docs/03-test-plan.md](docs/03-test-plan.md).

---

## 7. Panduan Deployment Produksi (Netlify)

Aplikasi telah disiapkan dengan konfigurasi [netlify.toml](netlify.toml) yang teroptimasi untuk Next.js App Router.

### Langkah Deploy Manual:
1. Masuk ke dasbor [Netlify](https://app.netlify.com/).
2. Pilih **"Add new site"** → **"Import an existing project"**.
3. Hubungkan repositori GitHub `erp-sinar-abadi-niaga-app`.
4. Netlify akan otomatis mendeteksi pengaturan dari `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Plugin:** `@netlify/plugin-nextjs`
5. Masuk ke tab **"Site configuration"** → **"Environment variables"**, lalu tambahkan:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<your-supabase-service-role-key>` (Akses sistem eksklusif server)
   - `CRON_SECRET` = `<string-acak-rahasia-cron>`
   - `RESEND_API_KEY` = `re_...`
   - `EMAIL_MODE` = `sandbox` atau `live`
   - `EMAIL_SANDBOX_TO` = `<email-anda-di-resend>` (wajib jika mode sandbox)
   - `EMAIL_FROM` = `Peringatan Stok <notifikasi@domain-anda.com>` (wajib jika mode live)
   - `APP_URL` = `https://erp-sinar-abadi.netlify.app`
6. Klik **"Deploy site"**.
7. Setelah deployment selesai, buka dasbor **Supabase Console** → **Authentication** → **URL Configuration**:
   - Tambahkan URL Netlify Anda (contoh: `https://erp-sinar-abadi.netlify.app`) ke dalam **Site URL** dan **Redirect URLs**.

---

## 8. Notifikasi Email Stok Menipis Harian (PRD 11.1)

Fitur pengiriman email peringatan stok barang menipis berjalan otomatis setiap hari pukul **07.00 WIB** (00.00 UTC) dipicu oleh Netlify Scheduled Functions ke endpoint route handler `/api/cron/notifikasi-stok`.

### Pengujian Lokal:
1. **Menggunakan cURL (Route Handler Langsung):**
   ```bash
   curl -X POST http://localhost:3000/api/cron/notifikasi-stok \
     -H "Authorization: Bearer <NILAI_CRON_SECRET>" \
     -H "Content-Type: application/json"
   ```
2. **Menggunakan Netlify CLI:**
   ```bash
   npx netlify functions:invoke notifikasi-stok
   ```
3. **Melalui Antarmuka Manajer:**
   Buka menu **Log Notifikasi** (`/notifikasi`) sebagai Manajer, lalu klik tombol **"Kirim Uji Sekarang"** (dibatasi 1 kali per menit).

> **PERINGATAN MODE LIVE:**
> Mode `EMAIL_MODE=live` membutuhkan domain yang telah terverifikasi DNS-nya (SPF, DKIM, DMARC) di dasbor Resend. Gunakan mode `EMAIL_MODE=sandbox` untuk pengujian aman ke alamat pemilik akun Resend (`EMAIL_SANDBOX_TO`).

---

## 9. Lisensi & Hak Cipta

Hak Cipta © 2026 CV Sinar Abadi Niaga. Seluruh hak cipta dilindungi undang-undang.
Dibuat untuk kebutuhan operasional distribusi internal perusahaan.
