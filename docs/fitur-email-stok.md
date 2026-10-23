# Spesifikasi Teknis: Notifikasi Email Stok Menipis Harian (PRD 11.1)

Dokumen ini mendefinisikan arsitektur teknis, aturan bisnis, skema database, proteksi keamanan, dan rencana pengujian untuk fitur pengiriman email notifikasi stok menipis harian otomatis menggunakan Resend dan Netlify Scheduled Functions.

---

## 1. Audit Kondisi Saat Ini & Analisis Kesenjangan

| Kebutuhan | Sudah Ada? | Lokasi Saat Ini | Kesenjangan / Pekerjaan yang Diperlukan |
|---|---|---|---|
| Klien Supabase Admin (Akses Sistem) | Belum | `src/lib/supabase/` | Baru tersedia `client.ts` dan `server.ts` berbasis anon key. Perlu modul `admin.ts` dengan impor `'server-only'` yang hanya membaca `SUPABASE_SERVICE_ROLE_KEY` dan hanya memanggil fungsi database `rpc_sistem_*`. |
| Pemicu Terjadwal Netlify (Scheduled Functions) | Belum | `netlify.toml` | `netlify.toml` ada, namun folder `netlify/functions/` dan file cron `notifikasi-stok.mts` belum ada. Perlu dibuat pemicu tipis dengan cron `0 0 * * *` (00.00 UTC = 07.00 WIB) yang memanggil `/api/cron/notifikasi-stok`. |
| Route Handler Endpoint Cron | Belum | `src/app/api/` | Belum ada handler `/api/cron/notifikasi-stok`. Perlu route handler `POST` terlindungi `CRON_SECRET` via `crypto.timingSafeEqual` dengan header `noindex`, `force-dynamic`, dan penolakan `GET` (405). |
| Kriteria Stok Menipis | Parsial | `supabase/migrations/20261021120300_views.sql` (`v_barang`) | Kriteria `b.stok <= b.stok_minimum` sudah ada di `v_barang`. Diperlukan fungsi RPC sistem `rpc_sistem_daftar_stok_menipis()` yang memfilter `b.aktif = true` dan tanpa kolom harga/uang. |
| Daftar Penerima Notifikasi | Parsial | `profiles` & `auth.users` | Profil memiliki kolom `peran` dan `aktif`. Diperlukan fungsi RPC sistem `rpc_sistem_penerima_notifikasi_stok()` yang menggabungkan `profiles` dengan `auth.users` untuk peran Manajer dan Gudang aktif. |
| Tabel Log & Idempotensi | Belum | Database | Belum ada tabel riwayat pengiriman email. Perlu tabel `notifikasi_email_log` dengan constraint unik `(jenis, tanggal_bisnis)` dan RPC klaim/selesaikan untuk mencegah pengiriman ganda. |
| Integrasi Pengirim Email (Resend) | Belum | - | Belum ada modul pengiriman email. Perlu antarmuka `EmailSender` dengan implementasi Resend (`fetch` ke `https://api.resend.com/emails`) dan `MockEmailSender` untuk pengujian unit. |
| Halaman Manajemen & Riwayat Notifikasi | Belum | `src/app/(dashboard)/` | Belum ada halaman `/notifikasi`. Perlu antarmuka tabel log riwayat, indikator mode (sandbox/live), dan tombol "Kirim uji sekarang" untuk Manajer. |

---

## 2. Aturan Bisnis & Keputusan Baku (E1 s.d. E12)

1. **E1 — Kriteria Barang**:
   - Menyaring barang dengan `aktif = true` AND `stok <= stok_minimum` (inklusif/sama dengan).
   - Barang nonaktif (`aktif = false`) dikeluarkan dari perhitungan.
   - Barang dengan `stok = 0` dan `stok_minimum = 0` disertakan (0 <= 0).
   - Jika daftar kosong: **TIDAK mengirim email**, catat log dengan status `'dilewati'`.

2. **E2 — Penerima Email**:
   - Penerima adalah akun `profiles` dengan status `aktif = true` dan peran `manajer` atau `gudang`.
   - Staf Penjualan (`penjualan`) dan akun nonaktif (`aktif = false`) **TIDAK** menerima email.
   - Alamat email diambil melalui fungsi database `rpc_sistem_penerima_notifikasi_stok()`, bukan kueri langsung dari TypeScript.

3. **E3 — Jadwal & Netlify Scheduled Function**:
   - Waktu eksekusi: Setiap hari pukul **07.00 WIB** (ekuivalen dengan **00.00 UTC**).
   - Netlify Scheduled Function: Berkas `netlify/functions/notifikasi-stok.mts` dikonfigurasi dengan ekspresi cron `0 0 * * *`.
   - Timeout pemicu: 25 detik (batas maksimal Netlify Functions 30 detik).
   - Pemicu tipis: Mengirim permintaan HTTP `POST` ke `${URL}/api/cron/notifikasi-stok` dengan header `Authorization: Bearer CRON_SECRET` dan melempar error jika HTTP non-2xx agar tercatat di log Netlify.

4. **E4 — Perlindungan Route Handler `/api/cron/notifikasi-stok`**:
   - Metode `POST` wajib memverifikasi Bearer token terhadap `CRON_SECRET` menggunakan pembandingan constant-time (`crypto.timingSafeEqual`).
   - Token kosong, tidak cocok, atau salah format menghasilkan respon `401 Unauthorized` polos tanpa detail.
   - Metode `GET` ditolak dengan `405 Method Not Allowed`.
   - Rute dikecualikan dari middleware sesi pengguna (rute publik teknis), wajib menyertakan header keamanan `X-Robots-Tag: noindex, nofollow`, dan diekspor dengan `export const dynamic = 'force-dynamic'`.

5. **E5 — Pengecualian Terbatas Akses Sistem (`SUPABASE_SERVICE_ROLE_KEY`)**:
   - Kunci `SUPABASE_SERVICE_ROLE_KEY` disimpan di environment variable server, tidak pernah memiliki prefiks `NEXT_PUBLIC_`, dan dilarang masuk ke bundle klien.
   - Diisolasi secara eksklusif dalam satu berkas `src/lib/supabase/admin.ts` yang mengimpor package `'server-only'`.
   - Hanya digunakan oleh route handler sistem internal (cron email stok dan webhook Mayar).
   - Klien admin **DILARANG** melakukan kueri tabel langsung; hanya boleh memanggil fungsi database `rpc_sistem_*`.
   - Izin eksekusi seluruh fungsi `rpc_sistem_*` dicabut dari `PUBLIC`, `anon`, dan `authenticated`, dan hanya diberikan kepada `service_role`.

6. **E6 — Idempotensi & Tabel Log**:
   - Tabel `notifikasi_email_log` mencatat: `id`, `jenis` (`stok_menipis` | `uji`), `tanggal_bisnis` (date Asia/Jakarta), `status` (`diklaim` | `terkirim` | `dilewati` | `gagal`), `jumlah_barang`, `jumlah_penerima`, `galat_singkat`, `dibuat_pada`, `diperbarui_pada`.
   - Constraint unik `UNIQUE (jenis, tanggal_bisnis)` untuk jenis `'stok_menipis'` menjamin pencegahan pengiriman ganda pada hari yang sama.
   - `rpc_sistem_klaim_notifikasi()` mengembalikan `boleh_kirim = true` hanya jika belum ada baris atau baris sebelumnya berstatus `'gagal'` (mendukung retry).
   - Jenis `'uji'` dibatasi maksimal 1 kali per menit (`COALESCE(MAX(dibuat_pada), '1970-01-01'::timestamptz) < now() - INTERVAL '1 minute'`).
   - Log **TIDAK menyimpan** isi badan email maupun alamat email penerima.

7. **E7 — Integrasi Pengirim Email (Resend)**:
   - Antarmuka `EmailSender`:
     ```ts
     export interface SendEmailParams {
       from: string;
       to: string[];
       subject: string;
       html: string;
       text: string;
       idempotencyKey?: string;
     }
     export interface EmailSender {
       send(params: SendEmailParams): Promise<{ id: string; success: boolean }>;
     }
     ```
   - Header HTTP: `Authorization: Bearer RESEND_API_KEY`, `Idempotency-Key: stok-menipis/<tanggal>/<penerima>`.
   - Nilai `RESEND_API_KEY` dilarang ditulis ke log atau konsol.

8. **E8 — Mode Pengiriman (Sandbox vs Live)**:
   - `EMAIL_MODE = "sandbox"` (default):
     - Pengirim: `onboarding@resend.dev`.
     - Penerima: Dikirim ke `EMAIL_SANDBOX_TO` (email pemilik akun Resend).
     - Badan email menyertakan banner jelas: *"MODE UJI: seharusnya dikirim ke: <daftar peran dan jumlah penerima>"* tanpa membocorkan alamat email asli penerima di badan pesan.
   - `EMAIL_MODE = "live"`:
     - Pengirim: `EMAIL_FROM` (domain terverifikasi di Resend).
     - Penerima: Dikirim ke masing-masing penerima asli secara terpisah.

9. **E9 — Tata Letak & Isi Email**:
   - Subjek: `[ERP Sinar Abadi] <N> barang stok menipis (<tanggal>)` (untuk uji berawalan `[UJI]`).
   - Format: Versi HTML rapi dan fallback Plain Text.
   - Tabel barang: No, Kode, Nama, Satuan, Stok Saat Ini, Stok Minimum, Selisih.
   - Pembatasan baris: Maksimal 100 baris pertama, jika lebih tambahkan keterangan *"dan <M> barang lainnya"*.
   - Sanitasi HTML: Seluruh data teks dari database di-escape (`&`, `<`, `>`, `"`, `'`).
   - **Zero Money**: Tanpa kolom harga pokok, harga jual, subtotal, total, HPP, atau margin.

10. **E10 — Halaman Antarmuka `/notifikasi` Khusus Manajer**:
    - Proteksi 3 lapis: `src/lib/akses.ts`, Server Component session check, dan RPC database.
    - Menampilkan tabel riwayat log (tanggal, jenis, status badge, jumlah barang, jumlah penerima, waktu, catatan galat).
    - Menampilkan kartu status sistem: Mode saat ini (`sandbox` / `live`), Jadwal pemicu (Setiap hari 07.00 WIB), dan alamat sandbox aktif.
    - Tombol "Kirim Uji Sekarang" memicu Server Action dengan batas 1 kali per menit.

11. **E11 — Pemindaian Keamanan Rahasia**:
    - `SUPABASE_SERVICE_ROLE_KEY` dan `RESEND_API_KEY` tidak ada di repo, bundle JavaScript klien, atau Next.js static output.
    - Menambahkan `.env.example` dengan template nama variabel lingkungan.

12. **E12 — Dokumentasi & Panduan Operasional**:
    - Dokumentasi lokal curl POST dengan `CRON_SECRET`.
    - Dokumentasi pemanggilan manual Netlify Functions.
    - Peringatan kebutuhan verifikasi domain Resend pada mode live.

---

## 3. Rancangan Skema Database & Migrasi SQL

### 3.1 Tabel `notifikasi_email_log`
```sql
CREATE TABLE IF NOT EXISTS public.notifikasi_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis text NOT NULL CHECK (jenis IN ('stok_menipis', 'uji')),
  tanggal_bisnis date NOT NULL,
  status text NOT NULL CHECK (status IN ('diklaim', 'terkirim', 'dilewati', 'gagal')),
  jumlah_barang integer NOT NULL DEFAULT 0 CHECK (jumlah_barang >= 0),
  jumlah_penerima integer NOT NULL DEFAULT 0 CHECK (jumlah_penerima >= 0),
  galat_singkat text,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

-- Indeks Unik Idempotensi Stok Menipis
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifikasi_stok_harian
  ON public.notifikasi_email_log (jenis, tanggal_bisnis)
  WHERE jenis = 'stok_menipis';

-- Indeks Riwayat Manajer
CREATE INDEX IF NOT EXISTS idx_notifikasi_log_dibuat ON public.notifikasi_email_log (dibuat_pada DESC);
```

### 3.2 Fungsi Database Sistem (`service_role` Only)
1. `public.rpc_sistem_daftar_stok_menipis()`:
   - Mengembalikan daftar barang aktif dengan `stok <= stok_minimum`.
   - Kolom: `kode`, `nama`, `satuan`, `stok`, `stok_minimum`, `selisih`.
2. `public.rpc_sistem_penerima_notifikasi_stok()`:
   - Mengembalikan penerima: `email`, `nama_lengkap`, `peran`.
   - Mengambil dari `profiles` join `auth.users` dengan peran `'manajer'` atau `'gudang'` dan `aktif = true`.
3. `public.rpc_sistem_klaim_notifikasi(p_jenis text, p_tanggal date)`:
   - Mengembalikan `boleh_kirim boolean`, `log_id uuid`.
   - Untuk `'stok_menipis'`: boleh jika belum ada atau baris lama berstatus `'gagal'`.
   - Untuk `'uji'`: boleh jika pemanggilan terakhir $\ge 1$ menit yang lalu.
4. `public.rpc_sistem_selesaikan_notifikasi(p_log_id uuid, p_status text, p_jumlah_barang int, p_jumlah_penerima int, p_galat text)`:
   - Memperbarui status log ke `'terkirim'`, `'dilewati'`, atau `'gagal'`.
5. `public.rpc_riwayat_notifikasi_manajer()`:
   - Mengembalikan daftar 50 log terakhir untuk tampilan halaman `/notifikasi`.
   - Diberikan izin untuk peran Manajer saja.

---

## 4. Perubahan AGENTS.md (Pengecualian Terbatas E5)

Bagian 4 pada `AGENTS.md` diperbarui dengan klausul:
> **Pengecualian Terbatas Service-Role Key**:
> Penggunaan `SUPABASE_SERVICE_ROLE_KEY` diperbolehkan HANYA untuk:
> 1. Diletakkan pada variabel lingkungan server (tanpa prefiks `NEXT_PUBLIC_`).
> 2. Diimpor eksklusif pada berkas `src/lib/supabase/admin.ts` yang memuat `import 'server-only'`.
> 3. Digunakan HANYA oleh route handler sistem internal (cron notifikasi stok menipis dan webhook transaksi).
> 4. Hanya memanggil fungsi database dengan nama berawalan `rpc_sistem_*` yang hak `EXECUTE`-nya dicabut dari `PUBLIC`, `anon`, dan `authenticated`, dan hanya diberikan kepada `service_role`. Dilarang melakukan kueri tabel langsung.

---

## 5. Rencana Pengujian (TC-156 s.d. TC-172)

| ID | Fokus Pengujian | Aktor | Media | Kriteria Lulus |
|---|---|---|---|---|
| **TC-156** | Barang Stok Sama Dengan Minimum Disertakan (`stok = stok_minimum`) | Sistem | SQL / Vitest | Barang dengan `stok = 10` dan `stok_minimum = 10` muncul di daftar. |
| **TC-157** | Barang Stok Di Atas Minimum Dieksklusi (`stok > stok_minimum`) | Sistem | SQL / Vitest | Barang dengan `stok = 11` dan `stok_minimum = 10` tidak disertakan. |
| **TC-158** | Barang Nonaktif Dieksklusi | Sistem | SQL / Vitest | Barang dengan `aktif = false` tidak disertakan meskipun `stok <= stok_minimum`. |
| **TC-159** | Barang Stok Nol dan Minimum Nol Disertakan (`0 <= 0`) | Sistem | SQL / Vitest | Barang aktif dengan stok 0 dan minimum 0 tetap masuk daftar. |
| **TC-160** | Penerima Notifikasi Hanya Manajer dan Gudang Aktif | Sistem | SQL / Vitest | Staf Penjualan dan profil nonaktif tidak muncul dalam daftar penerima. |
| **TC-161** | Daftar Barang Kosong: Tidak Mengirim Email & Status `dilewati` | Sistem | Vitest / Route | Jika tidak ada barang menipis, pengirim email tidak dipanggil, log bertatus `dilewati`. |
| **TC-162** | Idempotensi Harian: Panggilan Ganda Hanya Mengirim Sekali | Sistem | Vitest / SQL | Panggilan kedua pada tanggal bisnis yang sama ditolak oleh RPC klaim (`boleh_kirim = false`). |
| **TC-163** | Retry pada Status `gagal` Diizinkan | Sistem | Vitest / SQL | Jika log sebelumnya berstatus `gagal`, panggilan berikutnya diizinkan mengklaim ulang. |
| **TC-164** | Otentikasi Token Cron: Token Hilang atau Salah Menghasilkan 401 | Publik | Route Handler | Request tanpa Bearer token atau token keliru menghasilkan HTTP 401 polos. |
| **TC-165** | Penolakan Metode HTTP GET pada Route Cron (405) | Publik | Route Handler | Permintaan GET ke `/api/cron/notifikasi-stok` menghasilkan HTTP 405 Method Not Allowed. |
| **TC-166** | Mode Sandbox: Mengirim 1 Email ke `EMAIL_SANDBOX_TO` dengan Banner | Sistem | Vitest | Pengiriman menggunakan `onboarding@resend.dev`, banner mode uji muncul, email penerima asli tidak ada di isi. |
| **TC-167** | Mode Live: Mengirim Email Terpisah per Penerima | Sistem | Vitest | Pengiriman memanggil API per penerima dengan idempotency key unik per penerima. |
| **TC-168** | Sanitasi HTML & Pembatasan 100 Baris pada Isi Email | Sistem | Vitest | Karakter khusus (`<`, `>`, `&`, `"`) ter-escape, daftar dipotong pada baris 100 dengan catatan tambahan. |
| **TC-169** | Zero-Leakage: Tidak Ada Kolom Nilai Uang pada Email & RPC | Sistem / Net | Vitest / Inspection | Payload email dan RPC sistem tidak mengandung `harga_pokok`, `harga_jual`, `subtotal`, `margin`, `hpp`. |
| **TC-170** | Hak Akses Database: `rpc_sistem_*` Diblokir dari `authenticated` & `anon` | User / Anon | SQL | Eksekusi `rpc_sistem_*` oleh peran non-service_role menghasilkan `permission denied`. |
| **TC-171** | Otorisasi Halaman `/notifikasi` Khusus Manajer (Penjualan & Gudang Ditolak) | P, G | Route Guard | Akses non-Manajer dialihkan ke `/tidak-berwenang` (403). |
| **TC-172** | Rate Limiting Tombol Uji Kirim (1 Kali per Menit) | M | Vitest / Action | Percobaan uji kirim kedua dalam kurun waktu kurang dari 60 detik ditolak. |

---

## 6. Analisis Risiko & Mitigasi

1. **Risiko Kebocoran Service Role Key:**
   - *Mitigasi:* Menggunakan modul `admin.ts` berfitur `import 'server-only'`. Jika berkas ini terimpor secara tidak sengaja di komponen klien, build Next.js akan langsung gagal secara otomatis.
2. **Risiko Email Masuk Spam atau Ditolak Resend:**
   - *Mitigasi:* Menyediakan mode `sandbox` sebagai bawaan yang aman menggunakan `onboarding@resend.dev` dan alamat terdaftar pemilik Resend. Dokumentasi lengkap ditambahkan untuk konfigurasi domain terverifikasi pada mode `live`.
3. **Risiko Eksekusi Cron Berulang (Double Send):**
   - *Mitigasi:* Idempotensi tingkat basis data menggunakan constraint unik pada tabel log `(jenis, tanggal_bisnis)`. Panggilan ulang dalam hari yang sama otomatis diabaikan.

---

## 7. Hasil Implementasi

Fitur Notifikasi Email Stok Menipis Harian (PRD 11.1) telah selesai diimplementasikan secara komprehensif dengan deliverable sebagai berikut:

1. **Migrasi Database (`supabase/migrations/20261023060000_notifikasi_email_stok.sql`)**:
   - Tabel `public.notifikasi_email_log` dengan constraint unik `(jenis, tanggal_bisnis)` untuk jenis `stok_menipis`.
   - RPC sistem `rpc_sistem_daftar_stok_menipis()`, `rpc_sistem_penerima_notifikasi_stok()`, `rpc_sistem_klaim_notifikasi()`, dan `rpc_sistem_selesaikan_notifikasi()` yang hak `EXECUTE`-nya dicabut dari `PUBLIC`, `anon`, dan `authenticated`, serta diberikan eksklusif ke `service_role`.
   - RPC baca `rpc_riwayat_notifikasi_manajer()` terproteksi otorisasi Manajer (`fn_is_manajer()`).
2. **Klien Admin & Akses Sistem Terbatas (`src/lib/supabase/admin.ts`)**:
   - Dilindungi package `'server-only'`. Build langsung gagal jika terimpor di klien.
   - Menggunakan `SUPABASE_SERVICE_ROLE_KEY` secara terisolasi untuk endpoint sistem internal.
3. **Layanan Email & Abstraksi (`src/features/notifikasi/`)**:
   - `email-sender.ts`: Abstraksi `EmailSender` dengan implementasi `ResendEmailSender` (`https://api.resend.com/emails`) dan `MockEmailSender` untuk pengujian unit.
   - `templates.ts`: Generator email HTML dan Plain Text dengan sanitasi `escapeHtml`, batasan 100 baris, banner mode sandbox, dan zero-money guarantee.
   - `service.ts`: Orkestrasi alur klaim database, penarikan data, pengiriman email, penanganan mode sandbox/live, serta penyelesaian status log.
   - `actions.ts`: Server Action `kirimNotifikasiUjiAction()` dengan pengecekan sesi Manajer dan rate limiting.
4. **Endpoint Cron & Scheduled Function**:
   - Route handler `POST /api/cron/notifikasi-stok` dengan validasi constant-time `crypto.timingSafeEqual`, penolakan `GET` (405), dan header `noindex`.
   - Netlify Scheduled Function `netlify/functions/notifikasi-stok.mts` dengan jadwal harian `0 0 * * *` (00.00 UTC = 07.00 WIB) dan timeout 25 detik.
5. **Antarmuka Manajer (`src/app/(dashboard)/notifikasi/page.tsx`)**:
   - Halaman khusus Manajer dengan kartu status mode/jadwal, tombol "Kirim Uji Sekarang", dan tabel log riwayat.
   - Terdaftar di menu sidebar "Administrasi Sistem" dan `src/lib/akses.ts`.
6. **Verifikasi & Rangkaian Uji**:
   - Suite SQL `supabase/tests/12_notifikasi_email.sql`: **9/9 test cases Lulus (100%)**.
   - Suite Vitest `src/features/notifikasi/__tests__/email-stok.test.ts`: **6/6 test cases Lulus (100%)**.
   - Total pengujian unit proyek kini: **20 test files, 152 tests passed (100%)**.

