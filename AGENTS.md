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

## 8. Aturan Fitur Baru

Bagian ini wajib dipatuhi setiap kali menambah atau mengubah fitur apa pun. Baca bersama [`docs/04-asumsi-dan-celah.md`](docs/04-asumsi-dan-celah.md) dan [`docs/16-peta-sistem-saat-ini.md`](docs/16-peta-sistem-saat-ini.md) sebelum menulis kode atau SQL apa pun.

### 8.1 Database & Migrasi
- **Migrasi**: setiap perubahan skema hanya lewat file migrasi baru di `supabase/migrations/` dengan nama berprefix timestamp ISO (contoh: `20260101120000_nama_fitur.sql`). Dilarang mengedit file migrasi lama.
- **Logika bisnis di database**: semua logika bisnis (validasi, mutasi stok, kalkulasi) berada di fungsi RPC/Postgres, bukan di Next.js. Next.js hanya memanggil RPC atau membaca view/tabel.
- **Fungsi `SECURITY DEFINER`**: wajib menetapkan `SET search_path = public, pg_temp` secara eksplisit dan memeriksa peran pemanggil (`fn_is_manajer()`, `fn_is_penjualan()`, dst.) di baris pertama badan fungsi sebelum melakukan operasi apa pun.
- **Urutan penguncian baris** (untuk mencegah deadlock): selalu kunci baris dalam urutan ini:
  1. `pesanan_jual` (ORDER BY id)
  2. `persetujuan_harga` (jika ada, ORDER BY id)
  3. `pelanggan` (ORDER BY id)
  4. `barang` (ORDER BY id)

### 8.2 Kerahasiaan Data
Kolom rahasia: `harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, `margin`, dan semua turunannya (HPP total, dll.).
- Kolom-kolom ini **tidak boleh bocor** ke peran Penjualan atau Gudang melalui cara apa pun: respons HTTP/RSC, Server Component props, Server Action return value, log browser/server, pesan error, hasil ekspor CSV/Excel, atau bundle klien.
- **`SELECT *` dilarang** pada tabel/view yang mengandung kolom rahasia. Selalu sebutkan kolom secara eksplisit, atau gunakan view yang sudah menyaring kolom (contoh: `v_barang`, `v_*_manajer`).
- View atau RPC yang memuat nilai rahasia harus berjalan dengan hak pemilik (`SECURITY DEFINER`), wajib memuat `WHERE public.fn_is_manajer()` (atau setara), dan **wajib diuji dengan ketiga peran** (manajer, penjualan, gudang) — pastikan penjualan dan gudang menerima error atau baris tanpa kolom rahasia.
- Dilarang `console.log` objek baris dari view/RPC manajer.

### 8.3 Tanggal & Waktu Bisnis
- Gunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date` untuk tanggal bisnis; **jangan** memakai `CURRENT_DATE` mentah karena server database bisa berada di zona UTC.
- Minggu dimulai **Senin** (ISO week). Gunakan `date_trunc('week', ...) + INTERVAL '0'` dengan setting `SET datestyle = 'ISO'` jika perlu.

### 8.4 Kode Error
- Pakai kode bebas **berikutnya** dari katalog [`src/lib/errors.ts`](src/lib/errors.ts).
  - Kode terakhir yang terpakai saat dokumen ini ditulis: **E0038**.
  - Kode berikut yang tersedia: E0039, E0040, dst.
- **Periksa tabrakan** sebelum mendaftarkan kode baru: grep seluruh repo untuk kode yang dipilih.
- **Jangan mengubah arti kode lama**; jika perilaku berubah, daftarkan kode baru dan tandai kode lama sebagai deprecated dengan komentar.
- Setiap kode baru wajib ditambahkan ke `ERROR_MESSAGES` di `src/lib/errors.ts` dan ke katalog kode di `docs/04-asumsi-dan-celah.md`.

### 8.5 Pengujian (TC)
- Setiap fitur baru **menambah TC baru** dengan melanjutkan penomoran terakhir di [`docs/03-test-plan.md`](docs/03-test-plan.md) (format TC-29, TC-30, dst.) menggunakan SQL, vitest, atau Playwright sesuai jenis pengujian.
- **28 TC baseline (TC-01 s.d. TC-28) tidak boleh diubah** selain memperbarui kolom "Bukti" jika tes ulang dijalankan.
- Jika perubahan fitur mengubah perilaku TC lama, catat di [`docs/15-catatan-perbaikan.md`](docs/15-catatan-perbaikan.md) dengan penjelasan: TC mana, mengapa perilaku berubah, dan TC pengganti (jika ada).

### 8.6 Dokumentasi per Fitur
Setiap fitur baru wajib disertai pembaruan dokumen berikut sebelum commit:
| Dokumen | Yang diperbarui |
|---|---|
| `docs/fitur-<slug>.md` | Dibuat baru: deskripsi, alur, aturan bisnis, TC, keputusan desain |
| [`docs/02-matriks-akses.md`](docs/02-matriks-akses.md) | Tambah baris/kolom hak akses baru |
| [`docs/03-test-plan.md`](docs/03-test-plan.md) | Tambah TC baru (lanjut nomor terakhir) |
| [`docs/05-skema.md`](docs/05-skema.md) | Perbarui skema tabel/view/fungsi |
| [`docs/16-peta-sistem-saat-ini.md`](docs/16-peta-sistem-saat-ini.md) | Perbarui peta komponen & alur |
| [`src/lib/akses.ts`](src/lib/akses.ts) | Tambah menu/rute baru beserta peran yang diizinkan |

### 8.7 UI & Navigasi
- Gunakan Tailwind CSS yang bersih bergaya **enterprise/ERP profesional** (lihat Bagian 6 untuk token warna dan komponen).
- Komponen navigasi Sidebar ([`src/components/layout/Sidebar.tsx`](src/components/layout/Sidebar.tsx)) **wajib** mengelompokkan menu ke dalam 5 kategori section:
  - **Menu Utama** — Dashboard
  - **Inventory & Gudang** — Barang & Stok, Kartu Stok, Stock Opname
  - **Transaksi & Penjualan** — Pelanggan, Pesanan Jual, Pembelian, Pemasok
  - **Keuangan & Laporan** — Laporan
  - **Administrasi Sistem** — Akun & Peran, Profil Saya, Audit Log
- Gunakan komponen dan token yang sudah ada: `DataTable`, `BadgeStatus`, `ConfirmDialog`, `FormField`, `EmptyState`. **Jangan membuat gaya baru per halaman.**
- Halaman yang bisa dicetak (struk, laporan) menggunakan CSS `@media print` — sembunyikan sidebar/header, atur ukuran font dan margin kertas.

### 8.8 Regresi Wajib Setelah Setiap Fitur
Jalankan seluruh suite ini sebelum membuat PR. Laporkan jumlah **lulus/gagal per jenis tes** dan sertakan **output asli** untuk setiap yang gagal.

```
1. supabase db reset                  # reset + migrasi dari nol
2. tes SQL (semua, termasuk konkurensi)
3. npm run lint                       # ESLint
4. npx tsc --noEmit                   # TypeScript strict
5. npx vitest run                     # unit & integrasi
6. npm run build                      # Next.js production build
7. npx playwright test                # E2E (bila tersedia)
8. pemeriksaan jaringan:              # Penjualan & Gudang tidak menerima kolom rahasia
   - buka DevTools Network tab, login sebagai penjualan/gudang,
     verifikasi respons JSON tidak mengandung harga_pokok/harga_beli_satuan/hpp_satuan/margin
```

### 8.9 Git
- Satu fitur → satu branch: `fitur/<slug>` (contoh: `fitur/diskon-bertingkat`).
- Satu langkah logis → satu commit dengan format Conventional Commits.
- Jangan menggabungkan perubahan skema, logika bisnis, dan UI dalam satu commit.

### 8.10 Hal yang Tidak Terdefinisi atau Bertentangan
- **Jangan menebak.** Jika menemukan hal yang belum terdefinisi atau bertentangan antar dokumen:
  1. Catat di bagian "Pertanyaan Terbuka" di `docs/fitur-<slug>.md`.
  2. Pilih **opsi paling konservatif** (izin lebih ketat, validasi lebih strict, tidak ada perubahan default).
  3. Laporkan di penutup sesi agar Tech Lead/Manajer dapat memutuskan.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
