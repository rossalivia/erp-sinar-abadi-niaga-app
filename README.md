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
  - Unit & Integration: [Vitest](https://vitest.dev/) (231 skenario pengujian pada 25 berkas uji mencakup skema Zod, invarian kartu stok, kalkulasi diskon, batas kredit, dan fitur tambahan).
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

## 4. Akun Uji Coba & Kredensial

Untuk kebutuhan evaluasi sistem, pengujian manual di browser, serta automasi pengujian lokal (`supabase/seed.sql` & `supabase/seed/seed_data_contoh.sql`), tersedia akun representatif untuk masing-masing peran. Seluruh akun menggunakan kata sandi standar yang sama:

> **Kata Sandi Standar Seluruh Akun Uji:** `Latihan#2026`

| Peran (*Role*) | Nama Petugas | Email Login Resmi | Email Alias Uji | Kata Sandi | Wewenang & Hak Akses Utama |
|---|---|---|---|---|---|
| **Manajer** | Hendra Wijaya | `hendra@sinarabadi.test` | `manajer@sinarabadi.test` | `Latihan#2026` | Akses penuh seluruh modul, otorisasi harga jual, approval PO, limit kredit, stock opname, penagihan, analitik, dan audit log. |
| **Staf Penjualan 1** | Rina Kartika | `rina@sinarabadi.test` | `penjualan1@sinarabadi.test` | `Latihan#2026` | Pembuatan draf pesanan penjualan, batas diskon maks 10%, penagihan piutang pelanggan pribadi (terisolasi). |
| **Staf Penjualan 2** | Dimas Prasetyo | `dimas@sinarabadi.test` | `penjualan2@sinarabadi.test` | `Latihan#2026` | Akun pembanding untuk uji isolasi draf antar-sales dan uji konkurensi limit kredit/stok. |
| **Staf Gudang** | Joko Susanto | `joko@sinarabadi.test` | `gudang@sinarabadi.test` | `Latihan#2026` | Pengajuan PO pembelian barang, penerimaan barang fisik, penyesuaian stok, picking list, surat jalan (tanpa akses harga). |
| **Akun Nonaktif** | Agus Salim | `agus@sinarabadi.test` | `nonaktif@sinarabadi.test` | `Latihan#2026` | Akun berstatus `aktif = false` untuk verifikasi penolakan login otomatis (`E30`). |

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
  Menjalankan 231 pengujian otomatis (25 berkas) pada skema Zod, invarian kartu stok, format angka Rupiah, kalkulasi diskon/margin, skoring kredit, dan pencegahan formula injection.
- **End-to-End Test (Playwright):**
  Salin `.env.test.example` menjadi `.env.test.local`, isi kata sandi akun uji Anda, lalu jalankan:
  ```bash
  npm run test:e2e
  ```
- **Status Test Case (TC):**
  28 Baseline Test Case (TC-01 s.d. TC-28) dan seluruh Test Case Peningkatan Fitur Baru (TC-29 s.d. TC-245) terverifikasi **Lulus 100%**. Rincian bukti pengujian dapat ditinjau di [docs/03-test-plan.md](docs/03-test-plan.md).

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

## 9. Catatan Keputusan Arsitektur (Architecture Decision Records - ADR)

Dokumentasi keputusan strategis arsitektur yang melandasi implementasi sistem ERP CV Sinar Abadi Niaga:

### ADR-01: Logika Bisnis Terpusat pada Basis Data (PostgreSQL RPC & `SECURITY DEFINER`)
- **Konteks:** Sistem ERP menuntut konsistensi tinggi pada pergerakan stok, kalkulasi diskon, batasan kredit, dan pencatatan piutang yang tidak boleh rentan terhadap manipulasi API client.
- **Keputusan:** Seluruh aturan bisnis inti (BR-01 s.d. BR-14) diimplementasikan secara mutlak di dalam fungsi basis data PostgreSQL (RPC) berstatus `SECURITY DEFINER` dengan parameter eksplisit `SET search_path = public, pg_temp`. Next.js App Router hanya bertindak sebagai presentation layer pemanggil RPC.
- **Konsekuensi:** Logika bisnis 100% kebal dari bypass klien/REST, atomisitas transaksi ACID terjamin, dan tidak ada inkonsistensi kalkulasi antara UI dan database.

### ADR-02: Kerahasiaan Finansial Mutlak (*Zero-Price-Leakage*) via Column-Level Grants
- **Konteks:** Spesifikasi PRD melarang keras bocornya harga pokok (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, serta margin) kepada peran non-Manajer (Penjualan dan Gudang).
- **Keputusan:** Menggunakan **PostgreSQL Column-Level Grants** (`REVOKE ALL` dari role `authenticated`, `GRANT SELECT` hanya pada kolom non-rahasia) dipadukan dengan Row Level Security (RLS). Query `SELECT *` langsung ditolak engine database bagi peran selain Manajer.
- **Konsekuensi:** Data finansial sensitif tidak akan pernah terkirim ke klien non-Manajer, baik pada payload respons JSON, network traffic DevTools, maupun bundel JavaScript statis.

### ADR-03: Kontrol Konkurensi Stok & Anti-Deadlock Transaksi Multi-Baris
- **Konteks:** Transaksi penjualan simultan oleh banyak staf sales berpotensi menimbulkan *race condition* (stok minus) atau kebuntuan transaksi (*deadlock*).
- **Keputusan:** Mengimplementasikan penguncian baris `SELECT ... FOR UPDATE` dengan urutan deterministik baku: `pesanan_jual` $\to$ `persetujuan_harga` $\to$ `pelanggan` $\to$ `barang (ORDER BY barang_id ASC)`.
- **Konsekuensi:** Mengeliminasi error *deadlock detected* (`SQLSTATE 40P01`), menjamin stok tidak pernah bernilai negatif, dan memastikan konsistensi saldo mutasi kartu stok $\sum \text{mutasi} = \text{stok}$.

### ADR-04: Sistem Desain Enterprise & Proteksi Noindex Tiga Lapis
- **Konteks:** Aplikasi internal korporat membutuhkan antarmuka yang padat informasi, bebas dekorasi berlebihan, dan terlindung dari pengindeksan publik.
- **Keputusan:** Menerapkan sistem desain Tailwind CSS bernuansa enterprise (palet Slate/Navy, dense data tables, `tabular-nums`), dipadukan dengan proteksi *noindex* 3 lapis: `public/robots.txt` (`Disallow: /`), metadata layout React (`robots: { index: false, follow: false }`), serta header HTTP `X-Robots-Tag: noindex, nofollow` di Next.js middleware dan `netlify.toml`.
- **Konsekuensi:** Pengalaman pengguna efisien untuk entri data cepat dan aplikasi terlindung dari perayapan mesin pencari publik.

### ADR-05: Integrasi Payment Gateway Mayar & Handshake Dua Arah Webhook
- **Konteks:** Pembayaran piutang melalui payment gateway Mayar membutuhkan verifikasi yang aman dari serangan pemalsuan payload (*tampering* dan *replay attack*).
- **Keputusan:** Rute webhook `/api/webhooks/mayar/[token]` memvalidasi secret token menggunakan perbandingan *constant-time* (`crypto.timingSafeEqual`), membatasi ukuran payload maksimal 100 KB, melakukan verifikasi status invoice secara aktif ke API Mayar (*two-way handshake*), dan mencatat `event_id` unik untuk menjamin idempotensi.
- **Konsekuensi:** Mencegah terjadinya pelunasan palsu, pembayaran ganda (*double-settlement*), dan *timing attack*.

### ADR-06: Notifikasi Email Stok Menipis Harian (Resend + Cron Token)
- **Konteks:** Notifikasi stok menipis harian dikirim setiap pukul 07.00 WIB kepada Manajer dan Gudang aktif tanpa membebani sesi pengguna.
- **Keputusan:** Pemanggilan trigger cron `/api/cron/notifikasi-stok` diamankan dengan Secret Bearer Token, fungsi basis data `rpc_sistem_klaim_notifikasi()` menjamin idempotensi harian (hanya 1 pengiriman sukses per tanggal bisnis), serta pengujian manual dibatasi *rate limiting* 1 kali per menit.
- **Konsekuensi:** Eksekusi background andal, kuota pihak ketiga (Resend) terjaga, dan kebal dari spam pengiriman.

---

## 10. Lisensi & Hak Cipta

Hak Cipta © 2026 CV Sinar Abadi Niaga. Seluruh hak cipta dilindungi undang-undang.  
Dibuat untuk kebutuhan operasional distribusi internal perusahaan.

