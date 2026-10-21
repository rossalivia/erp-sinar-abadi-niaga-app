# AGENTS.md — Aturan Kerja Proyek ERP CV Sinar Abadi Niaga

Dokumen ini wajib dibaca dan dipatuhi oleh setiap agen/sesi kerja sebelum menyentuh repo.

## 1. Sebelum Mulai Bekerja
1. Baca [`docs/00-spesifikasi.md`](docs/00-spesifikasi.md). Ini sumber kebenaran utama dan **tidak boleh diubah**.
2. Baca dokumen `docs/` yang relevan dengan tahap yang sedang dikerjakan:
   - [`docs/01-rencana-kerja.md`](docs/01-rencana-kerja.md): tujuan, deliverable, dan Definition of Done per tahap.
   - [`docs/02-matriks-akses.md`](docs/02-matriks-akses.md): hak akses per peran beserta lapisan penegaknya.
   - [`docs/03-test-plan.md`](docs/03-test-plan.md): 28 test case yang wajib lolos.
   - [`docs/04-asumsi-dan-celah.md`](docs/04-asumsi-dan-celah.md): keputusan default untuk hal yang tidak dijelaskan spesifikasi.
3. `PRD_ERP.md` hanya rujukan tambahan. Jika PRD bertentangan dengan `00-spesifikasi.md`, ikuti spesifikasi dan keputusan di `04-asumsi-dan-celah.md`.
4. Kerjakan **satu tahap per sesi** (T1–T9). Jangan mengerjakan tahap berikutnya tanpa instruksi.

## 2. Arsitektur & Logika Bisnis
- **Semua logika bisnis berada di fungsi database (RPC Postgres)**, bukan di Next.js. Next.js hanya memanggil RPC atau membaca view/tabel, lalu menampilkan hasilnya.
- Validasi di klien hanya untuk kenyamanan UX. Validasi yang berlaku adalah yang ada di database (constraint, trigger, RPC, RLS).
- Perubahan stok **hanya** lewat RPC mutasi (konfirmasi, pembatalan, penerimaan, penyesuaian). UPDATE langsung ke `barang.stok` harus diblokir di database.
- Pesan error bisnis berasal dari `RAISE EXCEPTION` di RPC, dalam Bahasa Indonesia. UI menampilkannya apa adanya lewat helper `getErrorMessage()` di [`src/lib/errors.ts`](src/lib/errors.ts).

## 3. Kerahasiaan Data
- Nilai rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, dan turunannya seperti margin/HPP total) **tidak boleh muncul** di respons API, log, pesan error, atau kode/bundle klien untuk peran non-Manajer.
- Dengan column-level grants, **`SELECT *` pada tabel yang punya kolom rahasia akan gagal**. Selalu sebut kolom secara eksplisit atau pakai view (`v_barang`, `v_*_manajer`, dan sejenisnya).
- Jangan menulis `console.log` yang berisi objek baris dari view manajer.
- Komponen yang menampilkan data rahasia harus server component atau hanya di-render jika peran = manajer. Data rahasia tidak boleh dikirim ke klien non-Manajer meskipun disembunyikan dengan CSS.

## 4. Keamanan Repo (Repo GitHub Publik)
- **Dilarang meng-commit** `.env`, `.env.local`, service-role key, password, token, atau kredensial apa pun.
- Sediakan `.env.example` yang hanya berisi nama variabel, tanpa nilai rahasia.
- **Aplikasi tidak memakai service-role key sama sekali**, termasuk di server/route handler. Semua akses memakai anon key + sesi pengguna sehingga RLS selalu berlaku.
- Data seed tidak boleh berisi password asli. Gunakan password latihan yang terdokumentasi saja.

## 5. Konvensi Struktur Folder & Kode
- **Struktur direktori frontend (`src/`)**:
  - `src/app/`: Halaman aplikasi (Next.js App Router).
    - `src/app/(dashboard)/`: Halaman terproteksi di dalam shell navigasi utama.
    - `src/app/login/`: Autentikasi dan aksi login/logout.
    - `src/app/tidak-berwenang/`: Halaman 403 saat akses diblokir route guard.
  - `src/lib/`: Utilitas dasar yang dapat digunakan kembali:
    - `supabase/`: Inisialisasi client (client browser, server, middleware).
    - `akses.ts`: Satu-satunya sumber kebenaran menu peran dan penjaga rute.
    - `format.ts`: Pemformat Rupiah, tanggal, dan waktu Indonesia.
    - `errors.ts`: Pemetaan kode error RPC Postgres (E0001..E0030) ke Bahasa Indonesia.
    - `profil.ts`: Pengambilan profil pengguna aktif (`getProfil`) ter-cache per request.
  - `src/components/ui/`: Komponen primitif atomik (button, input, table, badge, dll).
  - `src/components/layout/`: Komponen tata letak (AppShell, Sidebar, Header).
  - `src/components/shared/`: Komponen bersama tingkat lanjut (DataTable padat, FormField, BadgeStatus, EmptyState, PageHeader).
  - `src/features/<modul>/`: Komponen spesifik modul bisnis (pesanan, pembelian, pelanggan, laporan, pengaturan).
- **Pola Server Action + Validasi Zod**:
  - Setiap mutasi data di frontend diproses melalui Server Action (`'use server'`).
  - Input divalidasi terlebih dahulu dengan skema Zod di awal Server Action.
  - Error validasi dikembalikan dalam bentuk `fieldErrors`, error database dipetakan via `getErrorMessage(err)`.
- **Konvensi Penamaan**:
  - Tabel dan kolom memakai **snake_case Bahasa Indonesia** (contoh: `pesanan_jual`, `batas_kredit`).
  - Fungsi RPC memakai snake_case dengan kata kerja di depan (contoh: `konfirmasi_pesanan`, `terima_pembelian`).
  - TypeScript dalam mode **strict**. Hindari `any`. Tipe database dihasilkan lewat `npm run gen:types`.
  - Seluruh teks UI dalam **Bahasa Indonesia**. Format uang `Rp1.250.000`, tanggal zona Asia/Jakarta.
  - Semua halaman memakai `noindex` (meta robots, header `X-Robots-Tag`, dan `public/robots.txt`).

## 6. Aturan UI & Sistem Desain (Wajib Dipatuhi Seluruh Modul)
Gunakan styling Tailwind CSS yang bersih, bergaya aplikasi **enterprise/ERP profesional** seperti sistem internal korporat:
- **Karakter Visual**: Clean, data-table yang padat, border minimalis (`border-slate-200`), warna profesional yang kalem (slate/gray dengan satu aksen), **tanpa glassmorphism berlebihan, tanpa gradien mencolok, tanpa animasi dekoratif**.
- **Palet Warna**:
  - Latar belakang: `bg-slate-50` / card `bg-white`.
  - Teks: primer `text-slate-900`, sekunder `text-slate-500`, border `border-slate-200`.
  - Aksi utama: `bg-slate-900 text-white hover:bg-slate-800`.
  - Status/Badge: warna redup dengan kontras teks tinggi (`success`: emerald-50/text-emerald-800, `warning`: amber-50/text-amber-800, `danger`: red-50/text-red-800, `neutral`: slate-100/text-slate-700, `info`: blue-50/text-blue-800).
- **Tabel Data (DataTable)**:
  - Padat (`text-xs` atau `text-sm`, padding vertikal kecil `py-1.5 px-2.5`).
  - Header menempel (`sticky top-0 bg-slate-100 font-medium text-slate-700`).
  - Garis pemisah tipis `border-slate-200`, baris zebra opsional sangat halus (`bg-slate-50/50`).
  - Kolom angka/rupiah dan stok rata kanan dengan angka tabular (`tabular-nums text-right`).
  - Kolom aksi rata kanan. Status kosong dan loading skeleton rapi.
- **Komponen Form & Input**:
  - Sudut konsisten kecil (`rounded-md`), bayangan minimal/tanpa bayangan (`shadow-none`).
  - Form dalam grid yang rapi, label di atas input, pesan error di bawah input.
- **Tata Letak Konsisten**:
  - Sidebar tetap (lebar 56 / `w-56` di desktop) + header tipis (`h-14`) + area konten dengan lebar maksimum `max-w-7xl mx-auto`.
  - Tombol aksi utama berada di slot kanan atas `PageHeader` di setiap halaman modul.
- **Gunakan Komponen Bersama**:
  - Selalu gunakan `AppShell`, `PageHeader`, `DataTable`, `BadgeStatus`, `FormField`, `EmptyState` dari `@/components/shared/` atau `@/components/ui/`. Jangan membuat variasi styling baru per halaman.

## 7. Penutup Setiap Tahap
Setiap sesi/tahap **wajib diakhiri dengan ringkasan** yang memuat:
1. **Apa yang selesai**: daftar deliverable beserta tautan ke file.
2. **Bukti uji**: perintah yang dijalankan, hasil query/test, atau screenshot, serta TC mana yang sudah dijalankan.
3. **Hal yang belum**: sisa pekerjaan, risiko, dan pertanyaan terbuka.

Commit memakai format Conventional Commits (lihat `docs/01-rencana-kerja.md`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
