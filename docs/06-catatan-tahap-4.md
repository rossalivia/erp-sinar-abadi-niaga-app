# Catatan Tahap 4: Kerangka Aplikasi, Autentikasi, Penjaga Rute, & Sistem Desain

Dokumen ini mencatat deliverable, arsitektur frontend, sistem desain, hasil uji lint & build, serta verifikasi keamanan pada Tahap 4 pengembangan ERP CV Sinar Abadi Niaga.

---

## 1. Ringkasan Pekerjaan Selesai
1. **Inisialisasi Proyek Next.js**:
   - Next.js 16 (App Router, Turbopack, TypeScript strict, Tailwind CSS 4, ESLint 9) di root repo tanpa mengubah atau menimpa folder `docs/` dan `supabase/`.
   - Dependensi terpasang: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `date-fns`, `lucide-react`, `sonner`, serta pustaka komponen primitif Radix UI (`dialog`, `dropdown-menu`, `select`, `label`, `slot`), `clsx`, `tailwind-merge`, `class-variance-authority`.
2. **Kerahasiaan & Kredensial**:
   - Dibuat [`.env.example`](.env.example) (hanya variabel `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - Dibuat [`.env.local`](.env.local) untuk lingkungan lokal.
   - [`.gitignore`](.gitignore) memastikan seluruh `.env*` diabaikan kecuali `!.env.example`.
   - **Service-role key TIDAK digunakan di mana pun** dalam aplikasi klien maupun server.
3. **Klien Supabase Berbasis Cookie & Auth Aman**:
   - [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts): Klien browser (`createBrowserClient`).
   - [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts): Klien Server Components / Actions / Route Handlers (`createServerClient`) dengan manajemen cookies aman. Selalu menggunakan `supabase.auth.getUser()` untuk otorisasi.
   - [`src/middleware.ts`](src/middleware.ts): Penyegar token sesi dan penjaga rute berbasis matriks peran.
4. **Tipe Database & Autentikasi**:
   - [`src/types/database.ts`](src/types/database.ts): Hasil generate otomatis dari database PostgreSQL lokal. Ditambahkan skrip npm `"gen:types"`.
   - [`src/types/auth.ts`](src/types/auth.ts): Definisi tipe `Peran = 'penjualan' | 'gudang' | 'manajer'` dan `UserProfile`.
5. **Akses & Matriks Rute (Single Source of Truth)**:
   - [`src/lib/akses.ts`](src/lib/akses.ts): Sumber tunggal untuk pemetaan menu peran (`getMenuItemsForRole`) dan izin akses rute (`isRouteAuthorized`), selaras dengan `docs/02-matriks-akses.md`.
6. **Penjaga Rute (Route Guard & Middleware)**:
   - Sesi tidak ada -> redirect `/login?next=...` (divalidasi hanya path internal, cegah open redirect).
   - Profil tidak ada atau `aktif = false` -> sign out paksa dan redirect `/login?error=nonaktif`.
   - Peran tidak berhak membuka rute (misal Staf Penjualan membuka rute Manajer `/laporan` atau `/pengaturan`) -> redirect `/tidak-berwenang`.
   - Pengecualian otomatis untuk file statis, `/login`, `/robots.txt`, `/tidak-berwenang`.
7. **Halaman Autentikasi & Navigasi**:
   - [`src/app/login/page.tsx`](src/app/login/page.tsx) & [`src/app/login/actions.ts`](src/app/login/actions.ts): Form login profesional tanpa tautan daftar, Server Action dengan validasi Zod dan error Bahasa Indonesia, tombol submit reaktif dengan `useActionState`.
   - [`src/app/tidak-berwenang/page.tsx`](src/app/tidak-berwenang/page.tsx): Halaman status 403 Bahasa Indonesia dengan tombol kembali ke dashboard.
   - [`src/app/not-found.tsx`](src/app/not-found.tsx) & [`src/app/error.tsx`](src/app/error.tsx): Halaman 404 dan Error boundary berstandar enterprise.
8. **Layout Terautentikasi & Dasbor Awal**:
   - [`src/app/(dashboard)/layout.tsx`](src/app/(dashboard)/layout.tsx): AppShell terproteksi yang memuat profil pengguna aktif.
   - [`src/components/layout/sidebar.tsx`](src/components/layout/sidebar.tsx): Sidebar responsif (fixed di desktop, drawer di mobile) dengan menu yang disaring otomatis berdasarkan peran pengguna.
   - [`src/components/layout/header.tsx`](src/components/layout/header.tsx): Header tipis dengan nama pengguna, badge peran, dan tombol logout.
   - [`src/app/(dashboard)/page.tsx`](src/app/(dashboard)/page.tsx): Dasbor utama berisi kartu sambutan profil dan tabel **Stok Menipis** (`stok <= stok_minimum`) dari view `v_barang`. Belum memuat KPI keuangan (disiapkan untuk Tahap 8).
9. **Sistem Desain Enterprise & Komponen Bersama**:
   - [`src/app/globals.css`](src/app/globals.css): CSS variables tema slate netral, angka tabular (`tabular-nums`), radius konsisten (`rounded-md`).
   - Komponen UI: [`Button`](src/components/ui/button.tsx), [`Input`](src/components/ui/input.tsx), [`Label`](src/components/ui/label.tsx), [`Table`](src/components/ui/table.tsx), [`Badge`](src/components/ui/badge.tsx), [`Card`](src/components/ui/card.tsx), [`Dialog`](src/components/ui/dialog.tsx), [`Select`](src/components/ui/select.tsx), [`DropdownMenu`](src/components/ui/dropdown-menu.tsx), [`Sonner`](src/components/ui/sonner.tsx).
   - Komponen Bersama: [`DataTable`](src/components/shared/data-table.tsx) (header sticky, padat, angka rata kanan), [`BadgeStatus`](src/components/shared/badge-status.tsx), [`FormField`](src/components/shared/form-field.tsx), [`EmptyState`](src/components/shared/empty-state.tsx), [`PageHeader`](src/components/shared/page-header.tsx).
10. **Utilitas Aplikasi**:
    - [`src/lib/format.ts`](src/lib/format.ts): `formatRupiah` (Intl id-ID tanpa desimal), `formatTanggal`, `formatTanggalWaktu` (zona waktu Asia/Jakarta).
    - [`src/lib/errors.ts`](src/lib/errors.ts): Pemetaan kode error RPC Postgres (E0001–E0030) ke Bahasa Indonesia dengan preservasi persis pesan BR-04 (`"Harga di bawah batas, minta persetujuan Manajer"`).
    - [`src/lib/profil.ts`](src/lib/profil.ts): Helper `getProfil()` yang di-cache per request via React `cache()`.
11. **Perlindungan noindex & Keamanan HTTP**:
    - [`src/app/layout.tsx`](src/app/layout.tsx): `metadata.robots = { index: false, follow: false }`.
    - [`public/robots.txt`](public/robots.txt): `User-agent: *\nDisallow: /`.
    - [`next.config.ts`](next.config.ts): Security headers dasar (`X-Robots-Tag: noindex, nofollow`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`).
12. **Dokumentasi & Standar Panduan Tim**:
    - [`AGENTS.md`](AGENTS.md): Diperbarui dengan konvensi folder (`src/app`, `src/lib`, `src/components`, `src/features/<modul>`), pola Server Action + Zod, serta Aturan UI enterprise yang wajib ditaati sesi berikutnya.

---

## 2. Bukti Uji & Verifikasi Teknis

### A. Kompilasi & Linting
- **`npm run typecheck`**: Lolos tanpa kesalahan tipe (`tsc --noEmit` exit code 0).
- **`npm run lint`**: Lolos tanpa kesalahan atau peringatan (`eslint` exit code 0).
- **`npm run build`**: Berhasil mengompilasi dan mengoptimasi bundle produksi (`next build` exit code 0). Semua rute terdaftar dengan benar:
  - `ƒ /` (Server-rendered dinamis via App Router & Supabase Server Client)
  - `○ /_not-found` (Static prerendered)
  - `○ /login` (Static prerendered dengan Suspense boundary)
  - `○ /tidak-berwenang` (Static prerendered)
  - `ƒ Proxy (Middleware)` (Penyegar sesi & penjaga rute)

### B. Pemeriksaan Keamanan Kode
1. **Pemeriksaan `service_role`**:
   - Perintah: Pencarian kata kunci `"service_role"` di seluruh direktori `src/`.
   - Hasil: **0 temuan**. Tidak ada service-role key yang tersimpan atau dipanggil.
2. **Pemeriksaan Kolom Rahasia di Kode Klien/Umum**:
   - Perintah: Pencarian kata kunci regex `(harga_pokok|harga_beli_satuan|hpp_satuan)` di seluruh `src/` (di luar file tipe skema database hasil generate).
   - Hasil: **0 temuan**. Nilai rahasia tidak bocor ke komponen umum.

### C. Matriks Hak Akses & Penjaga Rute (Manual & Middleware)
Berdasarkan aturan `src/lib/akses.ts` dan `src/middleware.ts`:
- **Pengguna Tanpa Sesi**:
  - Mengakses `/` atau rute terproteksi apa pun -> dialihkan langsung ke `/login?next=<rute>`.
- **Pengguna Nonaktif**:
  - Jika `profiles.aktif = false` -> sesi otomatis di-sign out dan dialihkan ke `/login?error=nonaktif`.
- **Peran Penjualan**:
  - Menu yang tampil di Sidebar: Dashboard (`/`), Barang & Stok (`/barang`), Pelanggan (`/pelanggan`), Pesanan Jual (`/pesanan`).
  - Mengakses `/laporan`, `/pengaturan/*`, atau `/pembelian` -> dicegat Middleware dan dialihkan ke `/tidak-berwenang`.
- **Peran Gudang**:
  - Menu yang tampil di Sidebar: Dashboard (`/`), Barang & Stok (`/barang`), Pesanan Jual (`/pesanan`), Pembelian (`/pembelian`).
  - Mengakses `/pelanggan`, `/laporan`, atau `/pengaturan/*` -> dicegat Middleware dan dialihkan ke `/tidak-berwenang`.
- **Peran Manajer**:
  - Menu yang tampil di Sidebar: Seluruh menu lengkap (Dashboard, Barang & Stok, Pelanggan, Pesanan Jual, Pembelian, Laporan, Akun & Peran, Audit Log).
  - Berhak membuka semua rute aplikasi.

---

## 3. Hal yang Belum / Langkah Berikutnya (Tahap 5)
- Tahap 4 membatasi pengerjaan pada kerangka, layout, autentikasi, dan sistem desain dasar.
- Modul bisnis akan dibangun secara bertahap pada sesi selanjutnya:
  - **Tahap 5**: Modul Barang & Stok (katalog barang, kartu stok, penyesuaian stok, serta kolom rahasia modal khusus Manajer).
  - **Tahap 6**: Modul Pelanggan & Pesanan Jual (alur draf, diskon, approval harga di bawah HPP, pelunasan).
  - **Tahap 7**: Modul Pembelian & Pemasok (PO, approval pembelian, penerimaan barang).
  - **Tahap 8**: Modul Laporan Keuangan, Pengaturan Akun, & Audit Log.
