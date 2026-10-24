# Spesifikasi Teknis: Tautan Bayar Piutang lewat Mayar (Sandbox)

**Fitur:** Tautan Bayar Piutang lewat Payment Gateway Mayar Sandbox (PRD 11.3)  
**Status:** DRAFT USULAN SPESIFIKASI IMPLEMENTASI (Menunggu Persetujuan Pemilik Proyek)  
**Peran:** Tech Lead  
**Tanggal:** 23 Oktober 2026  
**Branch Rencana:** `fitur/tautan-bayar-mayar`  
**Rujukan Wajib:**
- [`AGENTS.md`](../AGENTS.md) (Aturan Fitur Baru, Aturan UI Enterprise, dan Pengecualian Terbatas Service-Role E5)
- [`docs/00-spesifikasi.md`](00-spesifikasi.md) (BR-05, BR-07)
- [`docs/02-matriks-akses.md`](02-matriks-akses.md)
- [`docs/03-test-plan.md`](03-test-plan.md) (Nomor TC terakhir: TC-172)
- [`docs/04-asumsi-dan-celah.md`](04-asumsi-dan-celah.md)
- [`docs/05-skema.md`](05-skema.md)
- [`docs/16-peta-sistem-saat-ini.md`](16-peta-sistem-saat-ini.md)
- [`docs/fitur-email-stok.md`](fitur-email-stok.md) (Pola Admin Client & Route Handler Cron)
- [`docs/fitur-penagihan.md`](fitur-penagihan.md) (Normalisasi Nomor Telepon & URL WhatsApp)

---

## 1. Audit Kondisi Saat Ini (Kebutuhan vs Lapangan)

Pemeriksaan mendalam telah dilakukan terhadap basis kode Next.js App Router (`src/`), modul database (`supabase/migrations/`), dan konfigurasi infrastruktur. Hasil perbandingan kondisi aktual dengan kebutuhan fitur tercantum dalam tabel berikut:

| Kebutuhan Fitur | Sudah Ada? | Lokasi Saat Ini | Kesenjangan & Tindakan yang Diperlukan |
|---|---|---|---|
| **RPC Pelunasan Pesanan** (`rpc_catat_pelunasan`) | **Sudah Ada** | `supabase/migrations/20261021120600_rpc.sql` (baris 571–616) | Mengubah status `pesanan_jual` menjadi `'lunas'`, mencatat `dilunasi_pada = now()`, dan menulis `audit_log`. **Kesenjangan (M9):** Belum otomatis menutup tagihan Mayar aktif jika pelunasan dilakukan manual. Perlu pembaruan RPC untuk menandai `tagihan_mayar.status = 'ditutup'` saat pesanan dilunasi manual. |
| **Nullability & FK `audit_log.pelaku_id`** | **Sudah Ada tetapi Terlalu Ketat** | `supabase/migrations/20261021120100_skema_inti.sql` (baris 240) | Kolom `pelaku_id` memiliki constraint `NOT NULL REFERENCES public.profiles(id)`. Pada eksekusi webhook latar belakang sistem (`service_role`), `auth.uid()` adalah `NULL`. **Kesenjangan (M8):** Perlu migrasi `ALTER TABLE public.audit_log ALTER COLUMN pelaku_id DROP NOT NULL;` agar aksi otomatis sistem dapat dicatat tanpa melanggar integritas referensial atau memalsukan akun pengguna. |
| **Pengecualian Rute Publik di Middleware** | **Sudah Ada Parsial** | `src/middleware.ts` (baris 18–26) | `pathname.startsWith('/api')` telah dilewati dari redirect login. Dengan demikian `/api/webhooks/mayar/[token]` otomatis lolos. **Kesenjangan (M12):** Halaman redirect pelanggan `/pembayaran/selesai` berada di luar `/api` sehingga saat ini akan di-redirect ke `/login`. Middleware wajib memperbolehkan akses publik anonim tanpa sesi ke `/pembayaran/selesai`. |
| **Klien Admin Berpembatasan Ketat (`admin.ts`)** | **Sudah Ada** | `src/lib/supabase/admin.ts` | Mengimpor `'server-only'`, membaca `SUPABASE_SERVICE_ROLE_KEY`, dan khusus untuk tugas sistem. **Kesenjangan:** Perlu penambahan pemanggilan fungsi sistem baru `rpc_sistem_lunaskan_dari_mayar` yang hak `EXECUTE`-nya dicabut dari publik/authenticated. |
| **Helper WhatsApp & Normalisasi Telepon** | **Sudah Ada** | `src/features/penagihan/utils.ts` | Tersedia fungsi murni `normalisasiNomorTelepon` (mengubah `08xx` & `+62` menjadi `628xx`, validasi digit 9–15) dan `buatUrlWhatsApp`. **Kesenjangan:** Siap digunakan langsung di panel Mayar tanpa menduplikasi kode logika sanitasi. |
| **Panel Aksi pada `/pesanan/[id]`** | **Sudah Ada** | `src/app/(dashboard)/pesanan/[id]/page.tsx` & `src/features/pesanan/components/pesanan-actions.tsx` | Menampilkan ringkasan tagihan, ketentuan kredit, timeline pesanan, dan tombol aksi sesuai peran. **Kesenjangan (M11):** Belum ada panel khusus "Pembayaran Mayar" untuk Manajer saat pesanan berstatus `dikirim`. Perlu komponen baru `MayarPaymentPanel`. |
| **Tabel Tagihan & Webhook Idempotensi** | **Belum Ada** | Katalog PostgreSQL | Belum ada tabel `tagihan_mayar` dan `mayar_webhook_event`. Perlu dibuat lewat migrasi baru. |
| **Klien HTTP Mayar (Sandbox)** | **Belum Ada** | `src/features/pembayaran/` | Perlu abstraksi antarmuka `MayarClient` dengan implementasi `HttpMayarClient` (timeout 8 detik, token masking) dan `MockMayarClient` untuk pengujian unit. |
| **Halaman `/pembayaran` Khusus Manajer** | **Belum Ada** | `src/app/(dashboard)/` | Perlu halaman baru untuk memonitor seluruh riwayat transaksi Mayar, filter status, dan penanda `perlu_tinjau`. |
| **Halaman `/pembayaran/selesai`** | **Belum Ada** | `src/app/` | Perlu halaman landing statis ber-`noindex`, ramah seluler, tanpa ketergantungan DB, dan tanpa pantulan parameter URL. |

---

## 2. Ringkasan Keputusan M1 s.d. M16 & Dampak Baseline

| Kode | Keputusan yang Ditetapkan | Dampak ke Baseline & Aturan Eksisting |
|---|---|---|
| **M1** | Hanya Manajer yang membuat, melihat, memeriksa, dan menutup tagihan Mayar (3 lapis: middleware/akses.ts, Server Actions/Components, database RPC). Penjualan dan Gudang diblokir total. | Tidak mengubah visibilitas pesanan penjualan/gudang; hanya menambah proteksi ketat pada seluruh artefak Mayar. |
| **M2** | Tagihan HANYA untuk pesanan `dikirim` dengan `total > 0`. Nominal = `pesanan_jual.total` (integer rupiah). 1 item: `{ quantity: 1, rate: total, description: "Pesanan <nomor>" }`. Maksimal 1 tagihan aktif (`status = 'dibuat'`) per pesanan via partial unique index. Metadata `extraData`: `noCustomer = pelanggan.kode`, `idProd = pesanan.nomor`. **ZERO SECRET FINANCIAL LEAKAGE** (tanpa HPP/margin). | Konsisten dengan BR-07 (faktur terbit saat status dikirim) dan menjaga aturan kerahasiaan data Bagian 3 AGENTS.md. |
| **M3** | Tabel baru `tagihan_mayar` (id, pesanan_jual_id, mayar_invoice_id, mayar_transaction_id, tautan, jumlah, status, email_penerima, berlaku_sampai, dibuat_oleh, dibuat_pada, dibayar_pada, catatan_tinjau). Tabel baru `mayar_webhook_event` untuk idempotensi (kunci_unik, jenis_event, referensi_id, hasil, dibuat_pada) dengan kolom ter-whitelist tanpa menyimpan raw payload, email, atau telepon pelanggan. | Skema append-safe, tidak membebani kapasitas DB dengan blob JSON mentah, dan mematuhi kepatuhan privasi data. |
| **M4** | Email penerima diminta saat pembuatan tagihan (dialog Manajer), tervalidasi Zod, default dari `MAYAR_DEFAULT_CUSTOMER_EMAIL`. Nomor telepon dinormalisasi dari `pelanggan.telepon`. Skema `pelanggan` **TIDAK diubah**. Masa berlaku default 7 hari (UTC ISO 8601), opsi 1–30 hari. | Tidak merusak baseline data master pelanggan atau data seed. |
| **M5** | Alur pembuatan 2 fase RPC: (1) `rpc_siapkan_tagihan_mayar` (kunci pesanan, cek status dikirim, cek ketiadaan tagihan aktif), (2) panggil API Mayar via `MayarClient`, (3) simpan via `rpc_simpan_tagihan_mayar`. Bila API Mayar gagal $\to$ DB bersih; bila simpan DB gagal $\to$ best-effort close di Mayar. Rate limit: 1 pembuatan per pesanan per 10 detik. | Mencegah tagihan gantung (*orphan invoice*) di Mayar dan menjamin konsistensi ACID. |
| **M6** | Abstraksi `MayarClient`: implementasi nyata `HttpMayarClient` (fetch ke `MAYAR_BASE_URL`, timeout 8 detik, Authorization: Bearer `MAYAR_API_KEY`) dan `MockMayarClient` untuk pengujian otomatis. Dilarang mencatat API key atau header auth di log server. Base URL default `https://api.mayar.club/hl/v1`. | Mempermudah pengetesan unit 100% deterministik tanpa memanggil vendor pihak ketiga. |
| **M7** | Route Webhook `POST /api/webhooks/mayar/[token]`: periksa token timingSafeEqual vs `MAYAR_WEBHOOK_TOKEN` (salah $\to$ 404 tanpa detail). Batasi ukuran body $\le 100\text{ KB}$. Hanya event `payment.received` yang diproses. Tangguh terhadap pemetaan ID Mayar (mencocokkan `data.id`, `data.transactionId`, `data.paymentLinkId` ke `mayar_invoice_id` atau `mayar_transaction_id`). Idempotensi via `mayar_webhook_event`. **PEMERIKSAAN ULANG (Verifikasi Aktif)**: Wajib memanggil Mayar GET `/invoice/{id}` dan memverifikasi status `paid` serta kesamaan nominal sebelum pelunasan. | Mengeliminasi serangan webhook spoofing, replay attack, dan ketidakpastian skema payload Mayar. |
| **M8** | `rpc_sistem_lunaskan_dari_mayar`: `SECURITY DEFINER`, HANYA dapat dipanggil oleh `service_role`. Urutan penguncian baris: `pesanan_jual` lalu `tagihan_mayar`. Syarat ketat: pesanan `dikirim`, tagihan `dibuat`, nominal cocok. Efek identik dengan `rpc_catat_pelunasan` (status `lunas`, `dilunasi_pada = now()`), tagihan menjadi `dibayar` (`dibayar_pada = now()`), tulis `audit_log` dengan `pelaku_id = NULL`. Jika syarat gagal $\to$ tandai tagihan `perlu_tinjau` dengan catatan rinci, jangan ubah status pesanan. | Memenuhi asas least privilege dan urutan locking anti-deadlock. |
| **M9** | Pelunasan manual oleh Manajer via `rpc_catat_pelunasan` otomatis memperbarui tagihan Mayar aktif menjadi `ditutup`, dan Server Action berusaha menutupnya di API Mayar (best effort). Webhook pembayaran Mayar yang tiba belakangan untuk pesanan yang sudah lunas manual akan ditandai `perlu_tinjau` (potensi pembayaran ganda) tanpa mengubah status pesanan. | Melindungi bisnis dari anomali pembukuan dan mempermudah rekonsiliasi manual. |
| **M10** | Kedaluwarsa dihitung saat dibaca (*on-the-fly* status efektif) tanpa cron; tagihan kedaluwarsa tidak dapat dilunasi otomatis (namun jika webhook menyatakan paid dan verifikasi Mayar paid, sistem tetap melunasi sesuai M8). Manajer dapat membuat tagihan baru setelah tagihan lama kedaluwarsa atau ditutup. | Menjaga efisiensi sistem tanpa beban cron polling berkala. |
| **M11** | UI Manajer: Panel "Pembayaran Mayar" di `/pesanan/[id]` (status `dikirim`), status berbadge, tombol Salin, tombol "Kirim via WhatsApp" (format pesan resmi id-ID), tombol "Periksa Status" (rekonsiliasi on-demand), tombol "Tutup Tagihan". Halaman `/pembayaran` untuk daftar seluruh tagihan. Indikator tagihan pada `/penagihan`. | Sesuai sistem desain enterprise korporat di Bagian 6 AGENTS.md. |
| **M12** | Halaman publik `/pembayaran/selesai` sebagai `redirectUrl` Mayar: statis, noindex, tanpa kueri database, tanpa parameter pantulan (bebas Reflected XSS). Dikecualikan dari redirect login di middleware. | Keamanan penuh untuk halaman yang dapat diakses publik oleh pelanggan toko. |
| **M13** | Konfigurasi variabel lingkungan: `MAYAR_API_KEY`, `MAYAR_BASE_URL`, `MAYAR_WEBHOOK_TOKEN`, `MAYAR_DEFAULT_CUSTOMER_EMAIL`, `APP_URL`. Ditambahkan ke `.env.example`, `README.md`, dan daftar variabel Netlify. Pemindaian rahasia wajib bersih. | Menjamin kepatuhan repositori publik (Bagian 4 AGENTS.md). |
| **M14** | Katalog error baru: Menggunakan kode bebas berikutnya mulai dari `E0066` di `src/lib/errors.ts` dalam Bahasa Indonesia tanpa membocorkan kredensial. | Konsistensi penanganan galat lintas sistem. |
| **M15** | Skrip simulasi pengujian lokal `scripts/simulasi-webhook.ts`: mengirim payload `payment.received` ke endpoint lokal dengan opsi token valid/invalid, duplikat, dan nominal berbeda. | Mendukung pengetesan integrasi tanpa memerlukan koneksi langsung sandbox. |
| **M16** | **TIDAK ADA CICILAN ATAU PEMBAYARAN PARSIAL**. Efek pelunasan terhadap batas kredit, piutang berjalan, dan laporan omzet/margin identik 100% dengan pelunasan manual (BR-05 / BR-07). | Tidak menimbulkan *breaking changes* pada modul keuangan dan analitik yang ada. |

---

## 3. Aturan Bisnis Baru (Business Rules)

Modul integrasi pembayaran ini menambahkan aturan bisnis baru yang melanjutkan penomoran aturan bisnis resmi:

- **BR-19 (Penerbitan Tagihan Pembayaran Digital):**
  Tagihan pembayaran digital pihak ketiga (Mayar) hanya dapat diterbitkan untuk pesanan penjualan yang berstatus `dikirim` dengan nilai total lebih besar dari Rp0. Setiap pesanan penjualan hanya diperbolehkan memiliki tepat 1 (satu) tagihan aktif (`status = 'dibuat'`). Nominal tagihan harus sama persis dengan total tagihan pesanan penjualan dalam bilangan bulat Rupiah tanpa biaya tambahan yang dibebankan kepada pelanggan toko.
- **BR-20 (Verifikasi Ganda Pelunasan Otomatis Webhook):**
  Sistem dilarang melunasi pesanan penjualan hanya berdasarkan muatan (*payload*) webhook masuk. Setiap peristiwa `payment.received` wajib diverifikasi ulang (*two-way handshake*) secara langsung ke server penyedia pembayaran melalui panggilan balik API dengan kredensial rahasia server. Pelunasan otomatis hanya dieksekusi jika:
  1. Status tagihan pada server penyedia pembayaran terkonfirmasi `paid`.
  2. Nominal pembayaran terverifikasi sama persis dengan nilai tagihan pada sistem.
  3. Status pesanan penjualan pada basis data masih berstatus `dikirim`.
- **BR-21 (Mitigasi Anomali & Pembayaran Ganda / Perlu Tinjau):**
  Jika terjadi ketidaksesuaian nominal, atau pembayaran tiba saat pesanan penjualan telah dilunasi melalui jalur manual (tunai/transfer bank langsung), atau status pesanan bukan lagi `dikirim`, sistem dilarang mengubah status pesanan penjualan dan dilarang mengembalikan dana secara otomatis. Tagihan wajib diberi tanda `perlu_tinjau` disertai catatan anomali di basis data agar Manajer dapat melakukan peninjauan dan rekonsiliasi manual.
- **BR-22 (Penutupan Tagihan Akibat Pelunasan Manual):**
  Pencatatan pelunasan manual atas pesanan penjualan yang memiliki tagihan pembayaran digital aktif secara otomatis membatalkan/menutup tagihan digital tersebut pada basis data lokal dan mengirimkan instruksi pembatalan (*close invoice*) ke penyedia pembayaran demi mencegah pelanggan membayar tagihan yang sudah tidak berlaku.

*Pernyataan Kompatibilitas:* Aturan BR-19 s.d. BR-22 tidak bertentangan dengan BR-01 s.d. BR-18. Logika pemotongan stok fisik, batas kredit, pemblokiran overdue faktur terkirim, serta penghitungan omzet dan margin kotor tetap berjalan persis sesuai baseline.

---

## 4. Perancangan Skema Basis Data

### 4.1 Tabel Baru: `public.tagihan_mayar`

```sql
CREATE TYPE public.status_tagihan_mayar AS ENUM (
  'dibuat',
  'dibayar',
  'kedaluwarsa',
  'ditutup',
  'perlu_tinjau'
);

CREATE TABLE public.tagihan_mayar (
  id                    uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_jual_id       uuid                      NOT NULL REFERENCES public.pesanan_jual(id) ON DELETE RESTRICT,
  mayar_invoice_id      text                      NOT NULL,
  mayar_transaction_id  text                      NULL,
  tautan                text                      NOT NULL,
  jumlah                numeric(15, 0)            NOT NULL CHECK (jumlah > 0),
  status                public.status_tagihan_mayar NOT NULL DEFAULT 'dibuat',
  email_penerima        text                      NOT NULL,
  berlaku_sampai        timestamptz               NOT NULL,
  dibuat_oleh           uuid                      NOT NULL REFERENCES public.profiles(id),
  dibuat_pada           timestamptz               NOT NULL DEFAULT now(),
  dibayar_pada          timestamptz               NULL,
  catatan_tinjau        text                      NULL,
  diperbarui_pada       timestamptz               NOT NULL DEFAULT now(),
  CONSTRAINT ck_tagihan_mayar_email CHECK (email_penerima ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indeks partial: Menjamin hanya ada 1 tagihan AKTIF ('dibuat') per pesanan jual (M2)
CREATE UNIQUE INDEX uq_tagihan_mayar_pesanan_aktif 
  ON public.tagihan_mayar (pesanan_jual_id) 
  WHERE (status = 'dibuat');

-- Indeks pencarian cepat untuk webhook matching (M7.4)
CREATE INDEX idx_tagihan_mayar_invoice_id ON public.tagihan_mayar (mayar_invoice_id);
CREATE INDEX idx_tagihan_mayar_transaction_id ON public.tagihan_mayar (mayar_transaction_id) WHERE mayar_transaction_id IS NOT NULL;
CREATE INDEX idx_tagihan_mayar_status ON public.tagihan_mayar (status);
```

### 4.2 Tabel Baru: `public.mayar_webhook_event` (Idempotensi Webhook)

```sql
CREATE TYPE public.hasil_webhook_mayar AS ENUM (
  'diproses',
  'diabaikan',
  'ditolak',
  'tidak_dikenal',
  'gagal_verifikasi'
);

CREATE TABLE public.mayar_webhook_event (
  id              uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  kunci_unik      text                      NOT NULL,
  jenis_event     text                      NOT NULL,
  referensi_id    text                      NULL,
  hasil           public.hasil_webhook_mayar NOT NULL,
  status_mayar    text                      NULL,
  jumlah_tercatat numeric(15, 0)            NULL,
  dibuat_pada     timestamptz               NOT NULL DEFAULT now()
);

-- Kunci unik untuk menjamin idempotensi eksekusi webhook (M3 / M7.4b)
CREATE UNIQUE INDEX uq_mayar_webhook_event_kunci ON public.mayar_webhook_event (kunci_unik);
CREATE INDEX idx_mayar_webhook_event_dibuat ON public.mayar_webhook_event (dibuat_pada DESC);
```

### 4.3 Relaksasi Constraint `audit_log.pelaku_id`

```sql
-- Mengubah kolom pelaku_id menjadi NULLABLE untuk mendukung aksi sistem latar belakang (M8)
ALTER TABLE public.audit_log ALTER COLUMN pelaku_id DROP NOT NULL;

COMMENT ON COLUMN public.audit_log.pelaku_id IS 
  'ID pengguna yang melakukan aksi. Bernilai NULL jika aksi dilakukan otomatis oleh sistem latar belakang (mis. Webhook Mayar)';
```

### 4.4 Fungsi Status Efektif On-the-Fly (`fn_status_efektif_tagihan_mayar`)

```sql
CREATE OR REPLACE FUNCTION public.fn_status_efektif_tagihan_mayar(
  p_status public.status_tagihan_mayar,
  p_berlaku_sampai timestamptz
)
RETURNS public.status_tagihan_mayar
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'dibuat' AND p_berlaku_sampai < now() THEN 'kedaluwarsa'::public.status_tagihan_mayar
    ELSE p_status
  END;
$$;
```

### 4.5 Kebijakan Keamanan Baris (RLS) & Hak Akses

```sql
ALTER TABLE public.tagihan_mayar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayar_webhook_event ENABLE ROW LEVEL SECURITY;

-- 1. tagihan_mayar: HANYA Manajer yang boleh membaca (M1)
CREATE POLICY "tagihan_mayar_select_manajer"
  ON public.tagihan_mayar FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer());

-- Blokir INSERT/UPDATE/DELETE langsung bagi seluruh authenticated user (wajib via RPC)
CREATE POLICY "tagihan_mayar_modify_block"
  ON public.tagihan_mayar FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 2. mayar_webhook_event: HANYA Manajer yang boleh membaca audit log webhook
CREATE POLICY "mayar_webhook_event_select_manajer"
  ON public.mayar_webhook_event FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer());

CREATE POLICY "mayar_webhook_event_modify_block"
  ON public.mayar_webhook_event FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Pencabutan dan Pemberian Izin (Least Privilege)
REVOKE ALL ON public.tagihan_mayar FROM PUBLIC, anon;
GRANT SELECT ON public.tagihan_mayar TO authenticated;

REVOKE ALL ON public.mayar_webhook_event FROM PUBLIC, anon;
GRANT SELECT ON public.mayar_webhook_event TO authenticated;
```

---

## 5. Rancangan Prosedur Tersimpan (RPC Database)

Setiap fungsi database dirancang dengan aturan penguncian baris eksplisit (`pesanan_jual` lalu `tagihan_mayar`) untuk mencegah kebuntuan (*deadlock*).

### 5.1 `rpc_siapkan_tagihan_mayar` (Fase 1 Pembuatan Tagihan)

- **Tujuan:** Memvalidasi hak akses Manajer, status pesanan, ketiadaan tagihan aktif, serta mengunci baris sebelum memanggil Mayar.
- **Peran:** Khusus Manajer (`fn_is_manajer()`).
- **Signature:**
  ```sql
  CREATE OR REPLACE FUNCTION public.rpc_siapkan_tagihan_mayar(
    p_pesanan_id uuid
  )
  RETURNS TABLE (
    pesanan_id uuid,
    nomor_pesanan text,
    kode_pelanggan text,
    nama_toko text,
    telepon_pelanggan text,
    total_tagihan numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp;
  ```
- **Logika Eksekusi:**
  1. Cek peran pemanggil: jika `NOT public.fn_is_manajer()` $\to$ `RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001'`.
  2. Kunci pesanan:
     ```sql
     SELECT pj.id, pj.nomor, pj.status, pj.total, plg.kode, plg.nama_toko, plg.telepon
     INTO v_pesanan
     FROM public.pesanan_jual pj
     JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
     WHERE pj.id = p_pesanan_id
     FOR UPDATE OF pj;
     ```
  3. Validasi status pesanan: jika `v_pesanan.id IS NULL` $\to$ `E0002` (Data tidak ditemukan). Jika `v_pesanan.status <> 'dikirim'` $\to$ `RAISE EXCEPTION 'Tagihan Mayar hanya dapat dibuat untuk pesanan berstatus dikirim' USING ERRCODE = 'E0066'`.
  4. Validasi nominal pesanan: jika `v_pesanan.total <= 0` $\to$ `RAISE EXCEPTION 'Total pesanan harus lebih besar dari 0 untuk membuat tagihan' USING ERRCODE = 'E0068'`.
  5. Cek tagihan aktif:
     ```sql
     IF EXISTS (
       SELECT 1 FROM public.tagihan_mayar
       WHERE pesanan_jual_id = p_pesanan_id AND status = 'dibuat' AND berlaku_sampai > now()
     ) THEN
       RAISE EXCEPTION 'Pesanan sudah memiliki tagihan Mayar aktif' USING ERRCODE = 'E0067';
     END IF;
     ```
  6. Kembalikan detail pesanan yang siap dikirimkan ke Mayar API.

### 5.2 `rpc_simpan_tagihan_mayar` (Fase 2 Pembuatan Tagihan)

- **Tujuan:** Menyimpan rekaman tagihan baru setelah API Mayar sukses mengembalikan respon.
- **Peran:** Khusus Manajer (`fn_is_manajer()`).
- **Signature:**
  ```sql
  CREATE OR REPLACE FUNCTION public.rpc_simpan_tagihan_mayar(
    p_pesanan_id uuid,
    p_mayar_invoice_id text,
    p_mayar_transaction_id text,
    p_tautan text,
    p_jumlah numeric,
    p_email_penerima text,
    p_berlaku_sampai timestamptz
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp;
  ```
- **Logika Eksekusi:**
  1. Cek peran Manajer (`E0001`).
  2. Kunci baris `pesanan_jual` (`FOR UPDATE`).
  3. Pastikan pesanan masih berstatus `'dikirim'` dan `total = p_jumlah`.
  4. Jika ada tagihan lama berstatus `dibuat` tetapi sudah lewat waktu kedaluwarsa, tandai otomatis menjadi `'kedaluwarsa'`.
  5. `INSERT INTO public.tagihan_mayar (...) VALUES (...) RETURNING id INTO v_tagihan_id;`
  6. Catat `audit_log`: aksi `'buat_tagihan_mayar'`, nama_tabel `'tagihan_mayar'`, nilai_baru memuat `{ tagihan_id, pesanan_id, mayar_invoice_id, jumlah, berlaku_sampai }` (tanpa data sensitif pelanggan).
  7. Kembalikan `jsonb_build_object('id', v_tagihan_id, 'tautan', p_tautan, 'status', 'dibuat')`.

### 5.3 `rpc_tutup_tagihan_mayar` (Pembatalan Tagihan Manual oleh Manajer)

- **Tujuan:** Menutup tagihan Mayar yang masih aktif atas inisiatif Manajer.
- **Signature:**
  ```sql
  CREATE OR REPLACE FUNCTION public.rpc_tutup_tagihan_mayar(
    p_tagihan_id uuid,
    p_alasan text DEFAULT 'Dibatalkan oleh Manajer'
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp;
  ```
- **Logika:**
  1. Cek peran Manajer (`E0001`).
  2. Kunci baris `pesanan_jual` lalu `tagihan_mayar` (`FOR UPDATE`).
  3. Jika `tagihan_mayar.status <> 'dibuat'` $\to$ lempar galat `Tagihan Mayar tidak aktif` (`E0071`).
  4. Update `status = 'ditutup'`, `catatan_tinjau = p_alasan`, `diperbarui_pada = now()`.
  5. Catat `audit_log`.

### 5.4 `rpc_sistem_lunaskan_dari_mayar` (Pelunasan Otomatis Webhook / Tarik Status)

- **Tujuan:** Memvalidasi kondisi transaksi dan melunasi pesanan secara atomik dalam satu transaksi.
- **Hak Akses:** **HANYA `service_role`**. Seluruh izin `EXECUTE` dicabut dari `PUBLIC`, `anon`, dan `authenticated`.
- **Signature:**
  ```sql
  CREATE OR REPLACE FUNCTION public.rpc_sistem_lunaskan_dari_mayar(
    p_tagihan_id uuid,
    p_referensi_transaksi text,
    p_jumlah_terverifikasi numeric
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp;
  ```
- **Logika Eksekusi Transaksional:**
  1. Cek hak pemanggil: wajib `service_role` (`current_user = 'service_role'` atau dipanggil via admin client).
  2. Ambil data `tagihan_mayar` untuk mengetahui `pesanan_jual_id`.
  3. **URUTAN PENGUNCIAN BARIS ANTI-DEADLOCK (M8):**
     - Kunci `pesanan_jual` terlebih dahulu:
       ```sql
       SELECT * INTO v_pesanan FROM public.pesanan_jual WHERE id = v_pesanan_id FOR UPDATE;
       ```
     - Kunci `tagihan_mayar` kedua:
       ```sql
       SELECT * INTO v_tagihan FROM public.tagihan_mayar WHERE id = p_tagihan_id FOR UPDATE;
       ```
  4. **Pemeriksaan Syarat Validitas Pelunasan:**
     - Syarat A: Pesanan status wajib `'dikirim'`.
     - Syarat B: Tagihan status wajib `'dibuat'`.
     - Syarat C: Nominal terverifikasi (`p_jumlah_terverifikasi`) wajib sama persis dengan `v_tagihan.jumlah` dan `v_pesanan.total`.
  5. **Percabangan Hasil:**
     - **Kasus Sukses (Semua Syarat Terpenuhi):**
       - Update `pesanan_jual`: `status = 'lunas'`, `dilunasi_pada = now()`.
       - Update `tagihan_mayar`: `status = 'dibayar'`, `dibayar_pada = now()`, `mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi)`.
       - Tulis `audit_log`:
         ```sql
         INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
         VALUES (
           NULL, -- Pelaku sistem otomatis
           'lunasi_pesanan_mayar',
           'pesanan_jual',
           v_pesanan_id,
           jsonb_build_object('status', 'dikirim'),
           jsonb_build_object('status', 'lunas', 'metode', 'mayar', 'tagihan_id', p_tagihan_id, 'referensi', p_referensi_transaksi)
         );
         ```
       - Return `{ success: true, status: 'lunas', message: 'Pesanan berhasil dilunasi via Mayar' }`.
     - **Kasus Anomali (Syarat Gagal — Potensi Pembayaran Ganda / Beda Nominal):**
       - **JANGAN** ubah status `pesanan_jual`!
       - Update `tagihan_mayar`: `status = 'perlu_tinjau'`, `catatan_tinjau = v_catatan_anomali`, `diperbarui_pada = now()`.
       - Tulis `audit_log` anomali sistem.
       - Return `{ success: false, status: 'perlu_tinjau', message: v_catatan_anomali }`.

### 5.5 Pembaruan pada `rpc_catat_pelunasan` (M9)

- Modifikasi pada fungsi pelunasan manual eksisting:
  ```sql
  -- Sebelum commit pelunasan manual, jika terdapat tagihan Mayar aktif, tutup otomatis di DB
  UPDATE public.tagihan_mayar
  SET status = 'ditutup',
      catatan_tinjau = 'Ditutup otomatis karena pesanan telah dilunasi manual oleh Manajer',
      diperbarui_pada = now()
  WHERE pesanan_jual_id = p_pesanan_id AND status = 'dibuat';
  ```

---

## 6. Diagram Alur Transaksi

### 6.1 Alur 1: Pembuatan Tagihan Mayar oleh Manajer

```
[Manajer di UI]                     [Next.js Server Action]             [Postgres DB]               [Mayar API Sandbox]
       |                                       |                              |                              |
       |--- 1. Klik "Buat Tagihan Mayar" ----->|                              |                              |
       |    (isi email & masa berlaku)         |                              |                              |
       |                                       |--- 2. rpc_siapkan_tagihan -->|                              |
       |                                       |    (kunci baris, cek status) |                              |
       |                                       |<-- 3. Data pesanan & total --|                              |
       |                                       |                              |                              |
       |                                       |--- 4. POST /invoice/create -------------------------------->|
       |                                       |    (items, rate=total, extraData)                           |
       |                                       |<-- 5. 200 OK (data.id, data.link, data.expiredAt) ----------|
       |                                       |                              |                              |
       |                                       |--- 6. rpc_simpan_tagihan --->|                              |
       |                                       |    (insert tagihan_mayar)    |                              |
       |                                       |<-- 7. OK tagihan tersimpan --|                              |
       |                                       |                              |                              |
       |<-- 8. Tampilkan panel tagihan & link -|                              |                              |
       |    (Siap Salin / Kirim via WhatsApp)  |                              |                              |
```

### 6.2 Alur 2: Webhook `payment.received` & Verifikasi Ganda

```
[Pelanggan / Mayar]                 [Route Handler Webhook]             [Mayar API Sandbox]            [Postgres DB]
       |                                       |                              |                              |
       |--- 1. POST /api/webhooks/mayar/[token]|                              |                              |
       |    (event: payment.received)          |                              |                              |
       |                                       |--- 2. timingSafeEqual(token) |                              |
       |                                       |    (Token salah -> 404)      |                              |
       |                                       |                              |                              |
       |                                       |--- 3. Catat kunci_unik ke mayar_webhook_event (idempotensi)->|
       |                                       |    (Duplikat -> 200 OK langsung berhenti)                   |
       |                                       |                              |                              |
       |                                       |--- 4. GET /invoice/{mayar_invoice_id} --------------------->|
       |                                       |    (PEMERIKSAAN ULANG AKTIF)                                |
       |                                       |<-- 5. 200 OK (status: paid, amount: X) ---------------------|
       |                                       |                              |                              |
       |                                       |--- 6. rpc_sistem_lunaskan_dari_mayar ----------------------->|
       |                                       |    (Kunci pesanan -> Kunci tagihan -> Verifikasi nominal)    |
       |                                       |    [Sukses] -> pesanan 'lunas', tagihan 'dibayar', audit_log|
       |                                       |    [Gagal]  -> tagihan 'perlu_tinjau', pesanan tetap aman   |
       |                                       |<-- 7. Hasil transaksi DB ------------------------------------|
       |                                       |                              |                              |
       |<-- 8. 200 OK Response ----------------|                              |                              |
```

### 6.3 Alur 3: Pengecekan Status Manual ("Periksa Status") oleh Manajer

```
[Manajer di UI]                     [Next.js Server Action]             [Mayar API Sandbox]            [Postgres DB]
       |                                       |                              |                              |
       |--- 1. Klik "Periksa Status" --------->|                              |                              |
       |                                       |--- 2. Ambil invoice_id tagihan aktif ----------------------->|
       |                                       |<-- 3. Return invoice_id -------------------------------------|
       |                                       |                              |                              |
       |                                       |--- 4. GET /invoice/{id} ---->|                              |
       |                                       |<-- 5. Return data.status ----|                              |
       |                                       |                              |                              |
       |                                       |--- 6. Jika status = 'paid':                                 |
       |                                       |    Panggil rpc_sistem_lunaskan_dari_mayar ------------------>|
       |                                       |    Jika status = 'unpaid':                                  |
       |                                       |    Cek masa berlaku; jika lewat -> tandai kedaluwarsa        |
       |                                       |<-- 7. Hasil sinkronisasi ------------------------------------|
       |                                       |                              |                              |
       |<-- 8. Tampilkan Toast Notifikasi -----|                              |                              |
       |    (Status terupdate di UI)           |                              |                              |
```

---

## 7. Desain Antarmuka `MayarClient` & Strategi Pemetaan ID

### 7.1 Definisi Interface `MayarClient`

```typescript
export interface MayarInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface CreateInvoiceParams {
  name: string;
  email: string;
  mobile: string;
  redirectUrl: string;
  description: string;
  expiredAt: string; // ISO 8601 UTC
  items: MayarInvoiceItem[];
  extraData: {
    noCustomer: string;
    idProd: string;
  };
}

export interface CreateInvoiceResponse {
  id: string; // mayar_invoice_id
  transactionId?: string;
  link: string; // URL pembayaran
  expiredAt: string;
  amount: number;
}

export interface GetInvoiceResponse {
  id: string;
  status: 'paid' | 'unpaid' | 'closed';
  amount: number;
  transactionId?: string;
  paidAt?: string;
}

export interface MayarClient {
  createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResponse>;
  getInvoice(invoiceId: string): Promise<GetInvoiceResponse>;
  closeInvoice(invoiceId: string): Promise<boolean>;
}
```

### 7.2 Implementasi `HttpMayarClient` (Produksi/Sandbox Nyata)

- **Timeout:** 8.000 ms menggunakan `AbortSignal.timeout(8000)`.
- **Masking:** Dilarang melakukan `console.log` terhadap `MAYAR_API_KEY` atau header `Authorization`.
- **Penanganan Galat:** Menangkap status HTTP non-2xx dan mengubahnya menjadi galat deskriptif tanpa membocorkan rincian internal Mayar.

### 7.3 Implementasi `MockMayarClient` (Pengujian Deterministik)

- Memiliki konfigurasi state untuk mensimulasikan respon: `paid`, `unpaid`, `closed`, galat timeout jaringan, dan nominal yang tidak cocok.

### 7.4 Strategi Pemetaan ID Webhook Tahan Banting (M7.4)

Dalam dokumentasi dan implementasi lapangan Mayar Sandbox, terdapat potensi variasi penamaan atribut ID pada muatan webhook:
1. `data.id`: Sering kali berupa ID tagihan invoice (mis. `inv-xxxx`).
2. `data.transactionId`: ID transaksi unik Mayar (mis. `trx-xxxx`).
3. `data.paymentLinkId`: ID tautan pembayaran.
4. `data.extraData.idProd`: Nomor pesanan penjualan (mis. `SO-2026-000012`).

**Algoritma Pencocokan Tagihan di Handler Webhook:**
```typescript
// Ekstraksi seluruh kandidat ID yang mungkin dari payload webhook
const candidateIds = [
  payload.data?.id,
  payload.data?.invoiceId,
  payload.data?.transactionId,
  payload.data?.paymentLinkId,
].filter(Boolean) as string[];

// Kueri database mencari tagihan berstatus 'dibuat' yang cocok dengan salah satu kandidat
// Baik pada kolom mayar_invoice_id MAUPUN mayar_transaction_id
const tagihan = await findTagihanByCandidateIds(candidateIds);
```
Jika tidak ditemukan kecocokan, webhook segera membalas **HTTP 200 OK** dan mencatat status `tidak_dikenal` pada tabel `mayar_webhook_event`. Langkah ini mencegah Mayar melakukan percobaan kirim ulang tanpa akhir (*infinite retry*) untuk event yang tidak relevan bagi sistem.

---

## 8. Desain Antarmuka Pengguna (UI)

Mengikuti Aturan Desain Enterprise Korporat di Bagian 6 `AGENTS.md` (Slate palette, tanpa gradien mencolok, border `border-slate-200`, padat dan jelas).

### 8.1 Panel Pembayaran Mayar di `/pesanan/[id]` (`MayarPaymentPanel`)

Panel ini diletakkan di bawah "Ringkasan Tagihan" dan **hanya di-render untuk Manajer** jika `pesanan.status === 'dikirim'`:

- **Kondisi Belum Ada Tagihan Aktif:**
  - Menampilkan ringkasan kesiapan tagihan (Total tagihan: RpX).
  - Tombol aksi utama: `[+ Buat Tagihan Mayar]` (`bg-slate-900 text-white`).
  - Mengklik tombol membuka Modal Dialog:
    - Input Email Pelanggan (wajib, validasi format email, default dari env).
    - Input Nomor Telepon WhatsApp (terisi otomatis dari `pelanggan.telepon` yang dinormalisasi).
    - Pilihan Masa Berlaku: 3 hari, 7 hari (default), 14 hari, 30 hari.
    - Tombol Submit: "Terbitkan Tautan Pembayaran" (dengan state loading).
- **Kondisi Tagihan Aktif (`dibuat`):**
  - Header: Badge `Status: Menunggu Pembayaran` (Badge Amber redup).
  - Tampilan masa berlaku: `"Berlaku hingga: DD MMMM YYYY, HH:mm WIB"`.
  - Input readonly tautan Mayar disertai tombol `[Salin Tautan]`.
  - Tombol `[Kirim via WhatsApp]`: Membuka `https://wa.me/{nomor}` dengan teks resmi:
    ```text
    Halo Toko Berkah Mandiri, kami dari CV Sinar Abadi Niaga ingin menginformasikan tautan pembayaran online untuk pesanan SO-2026-000012 sebesar Rp1.250.000:
    https://pay.mayar.club/p/inv-xxxx
    Tautan berlaku hingga 30 Oktober 2026, 07:00 WIB. Terima kasih.
    ```
  - Tombol `[Periksa Status]` (ikon refresh): Menjalankan Server Action sinkronisasi ke Mayar.
  - Tombol `[Tutup Tagihan]` (varian ghost merah): Membuka dialog konfirmasi sebelum membatalkan tagihan di Mayar.
- **Kondisi Tagihan Selesai / Anomali:**
  - Status `dibayar`: Badge Hijau emerald, tanggal lunas, tautan bukti transaksi.
  - Status `kedaluwarsa`: Badge Slate netral, keterangan waktu kedaluwarsa, tombol untuk membuat tagihan baru.
  - Status `ditutup`: Badge Abu-abu netral.
  - Status `perlu_tinjau`: Badge Merah terang dengan ikon peringatan bahaya, menampilkan catatan anomali (mis. *"Nominal transfer berbeda"* atau *"Pesanan sudah dilunasi manual"*).

### 8.2 Halaman Monitoring `/pembayaran` (Khusus Manajer)

- **Rute:** `/pembayaran` (terproteksi di middleware dan Server Component).
- **Komponen:**
  - `PageHeader`: Judul "Monitoring Pembayaran Digital Mayar", deskripsi "Daftar seluruh tautan pembayaran Mayar, status pelunasan online, dan rekonsiliasi transaksi".
  - Tab Filter Cepat: `Semua` | `Menunggu Pembayaran` | `Lunas Online` | `Perlu Tinjau` | `Kedaluwarsa / Ditutup`.
  - `DataTable` Padat:
    - Kolom: Tanggal | Nomor Pesanan (link ke detail) | Pelanggan | Nominal | Berlaku Hingga | Status (Badge) | Aksi (Periksa Status, Buka Tautan).
- **Navigasi Sidebar:**
  - Ditempatkan di section **Transaksi & Penjualan** atau **Keuangan & Laporan** pada menu khusus Manajer.

### 8.3 Halaman Publik `/pembayaran/selesai`

- **Karakter:** Halaman murni publik yang berdiri sendiri (*standalone* tanpa AppShell/Sidebar).
- **Header:** `X-Robots-Tag: noindex, nofollow`.
- **Konten:**
  - Logo resmi CV Sinar Abadi Niaga.
  - Ikon jam pasir / centang biru ramah.
  - Judul: "Pembayaran Sedang Diverifikasi".
  - Pesan teks: *"Terima kasih atas pembayaran Anda. Transaksi Anda sedang diverifikasi secara otomatis oleh sistem kami. Pembaruan status pelunasan akan tercatat dalam beberapa saat."*
  - Tombol kembali: "Tutup Halaman".
  - **Larangan Ketat:** Dilarang membaca parameter `searchParams` untuk dicetak kembali ke DOM (mencegah XSS).

---

## 9. Matriks Akses & Model Ancaman (*Threat Model*)

### 9.1 Matriks Hak Akses

| Operasi / Sumber Daya | Staf Penjualan | Staf Gudang | Manajer | Lapisan Penegak |
|---|:---:|:---:|:---:|---|
| Buka Halaman `/pembayaran` | ❌ (403) | ❌ (403) | ✅ Diizinkan | Middleware, Route Guard, RLS |
| Lihat Panel Mayar di `/pesanan/[id]` | ❌ Tidak tampil | ❌ Tidak tampil | ✅ Tampil | Server Component conditional render |
| Eksekusi Pembuatan Tagihan Mayar | ❌ Ditolak | ❌ Ditolak | ✅ Diizinkan | Server Action Zod + RPC `fn_is_manajer()` |
| Eksekusi Tutup Tagihan Mayar | ❌ Ditolak | ❌ Ditolak | ✅ Diizinkan | Server Action + RPC `fn_is_manajer()` |
| Sinkronisasi Status Manual ("Periksa") | ❌ Ditolak | ❌ Ditolak | ✅ Diizinkan | Server Action + RPC `fn_is_manajer()` |
| Akses Route Webhook `/api/webhooks/mayar/*`| ❌ Ditolak token | ❌ Ditolak token | ❌ Ditolak token | Bearer Token timingSafeEqual (`CRON/WEBHOOK_SECRET`) |
| Eksekusi `rpc_sistem_lunaskan_dari_mayar` | ❌ Ditolak DB | ❌ Ditolak DB | ❌ Ditolak DB | HANYA `service_role` (REVOKE dari authenticated) |
| Buka Halaman `/pembayaran/selesai` | ✅ Publik | ✅ Publik | ✅ Publik | Publik tanpa auth (dikecualikan di middleware) |

### 9.2 Model Ancaman & Strategi Mitigasi (*Threat Matrix*)

| No | Potensi Ancaman / Serangan | Vektor Risiko | Strategi Mitigasi Terverifikasi |
|---|---|---|---|
| **T1** | **Webhook Palsu (Spoofing)** | Penyerang menebak URL webhook dan mengirim muatan palsu berstatus `paid`. | **Constant-time Token Check:** URL dilindungi token rahasia acak 32 karakter. Jika token salah $\to$ HTTP 404 polos tanpa pesan galat.<br>**Verifikasi Ulang Aktif (Two-Way):** Sistem tidak mempercayai isi webhook; sistem selalu memanggil balik API Mayar GET `/invoice/{id}` dengan `MAYAR_API_KEY`. |
| **T2** | **Serangan Replay (Replay Attack)** | Penyerang mengirim ulang paket webhook yang sah berkali-kali untuk memicu galat. | **Tabel Idempotensi:** Kunci unik `kunci_unik = event + id_transaksi` disisipkan ke `mayar_webhook_event` sebelum pemrosesan. Duplikat langsung dijawab 200 OK dan dihentikan. |
| **T3** | **Manipulasi Nominal Pembayaran** | Pembeli membayar sebagian atau nominal berbeda dari total tagihan pesanan. | **Validasi Ketat di Database:** `rpc_sistem_lunaskan_dari_mayar` menolak pelunasan jika nominal Mayar $\ne$ nominal pesanan. Status dialihkan ke `perlu_tinjau` dan pesanan tetap belum lunas. |
| **T4** | **Pembayaran Ganda (Race Condition)** | Pelanggan membayar via Mayar tepat saat Manajer mencatat pelunasan manual secara tunai. | **Urutan Penguncian Baris (`FOR UPDATE`):** Transaksi mengunci `pesanan_jual` lebih dulu. Jika status pesanan sudah lunas, sistem tidak mengubah pesanan dan menandai tagihan Mayar `perlu_tinjau`. |
| **T5** | **Tagihan Kedaluwarsa Dibayar** | Pelanggan membuka tautan lama yang sudah lewat batas waktu. | **Evaluasi Dinamis:** Jika Mayar menerima pembayaran dan mengonfirmasi `paid`, sistem tetap memproses pelunasan (dana toko terselamatkan). Jika Mayar menyatakan unpaid/closed, status lokal tetap kedaluwarsa. |
| **T6** | **Kebocoran Kunci Rahasia di Bundel Klien** | `MAYAR_API_KEY` atau `MAYAR_WEBHOOK_TOKEN` terikutsertakan ke browser. | **Audit Bundel & Linting:** Kunci tidak pernah berawalan `NEXT_PUBLIC_`, hanya dibaca di Server Component/Route Handler, dan dipindai secara otomatis saat build. |
| **T7** | **Layanan Mayar Tidak Terjangkau (Downtime)** | Server Mayar timeout atau error 5xx saat verifikasi webhook. | **Respon HTTP 500 Terkontrol:** Webhook mengembalikan HTTP 500 agar webhook scheduler Mayar menjadwalkan percobaan ulang (*retry*), sementara tombol "Periksa Status" manual siap digunakan Manajer setelah jaringan pulih. |

---

## 10. Rencana Pengujian (Test Case Baru: TC-173 s.d. TC-192)

Melanjutkan penomoran terakhir dari `TC-172` pada [`docs/03-test-plan.md`](03-test-plan.md):

| ID Test | Fokus Skenario Uji | Media Uji | Harapan Hasil & Verifikasi |
|---|---|---|---|
| **TC-173** | Webhook token salah atau tidak ada menghasilkan 404 | Route Handler | Permintaan POST tanpa token atau token acak ditolak HTTP 404 tanpa detail informasi sistem. |
| **TC-174** | Webhook token benar dengan payload ID tidak dikenal menghasilkan 200 tanpa efek | Route Handler | Respon 200 OK diterima, `mayar_webhook_event` mencatat `hasil = 'tidak_dikenal'`, status DB tidak berubah. |
| **TC-175** | `payment.received` valid + verifikasi ulang Mayar `paid` sukses melunasi pesanan | Integrasi / Mock | Pesanan berubah `status = 'lunas'`, `tagihan_mayar` berstatus `'dibayar'`, dan `audit_log` tercatat dengan `pelaku_id = NULL`. |
| **TC-176** | Webhook palsu (verifikasi ulang Mayar menyatakan `unpaid`) ditolak | Integrasi / Mock | Pesanan tidak dilunasi, respon 200 OK, event dicatat `gagal_verifikasi`. |
| **TC-177** | Nominal pembayaran Mayar berbeda dengan total pesanan | Integrasi / Mock | Pesanan tidak dilunasi, `tagihan_mayar` beralih ke `status = 'perlu_tinjau'` dengan pesan catatan anomali. |
| **TC-178** | Webhook duplikat (Idempotensi teruji) | Integrasi / Mock | Pengiriman muatan yang sama dua kali hanya memicu 1 kali eksekusi database; pengiriman kedua langsung dibalas 200 OK. |
| **TC-179** | Webhook tiba untuk pesanan yang sudah lunas manual oleh Manajer | Integrasi / Mock | Status pesanan tetap `lunas`, tagihan Mayar diberi tanda `status = 'perlu_tinjau'` (indikasi pembayaran ganda). |
| **TC-180** | Webhook tiba untuk pesanan berstatus bukan `dikirim` (mis. dibatalkan) | Integrasi / Mock | Pesanan tidak berubah, tagihan Mayar diberi tanda `perlu_tinjau`. |
| **TC-181** | Mayar API tidak terjangkau (Network Timeout) saat webhook masuk | Integrasi / Mock | Route webhook mengembalikan status HTTP 500 agar Mayar melakukan pengiriman ulang (*retry*); DB tidak berubah. |
| **TC-182** | Tombol "Periksa Status" manual berhasil memulihkan pelunasan setelah downtime | Server Action / UI | Saat Mayar pulih, klik "Periksa Status" oleh Manajer berhasil memverifikasi status `paid` dan melunasi pesanan. |
| **TC-183** | Penanganan tagihan kedaluwarsa dan penerbitan tagihan baru | SQL + UI | Tagihan yang melewati batas waktu dievaluasi sebagai `'kedaluwarsa'`; Manajer diizinkan membuat tagihan baru. |
| **TC-184** | Constraint unik satu tagihan aktif (`dibuat`) per pesanan | SQL / DB | Upaya pembuatan tagihan kedua saat tagihan pertama masih aktif ditolak oleh database constraint (`E0067`). |
| **TC-185** | Pelunasan manual via `rpc_catat_pelunasan` otomatis menutup tagihan Mayar aktif | SQL / Integrasi | Memanggil pelunasan manual mengubah `tagihan_mayar.status = 'ditutup'` secara atomik. |
| **TC-186** | Penolakan hak akses Penjualan dan Gudang pada seluruh artefak Mayar | RBAC / Route Guard | Penjualan dan Gudang ditolak di halaman `/pembayaran` (403), ditolak Server Action, dan ditolak RPC (`E0001`). |
| **TC-187** | Fungsi `rpc_sistem_lunaskan_dari_mayar` tidak dapat dipanggil `authenticated` / `anon` | SQL Security | Pemanggilan fungsi sistem oleh user biasa menghasilkan error `permission denied for function`. |
| **TC-188** | Zero-Leakage: Tidak ada API key, token, email, atau telepon pelanggan di log | Pemeriksaan Log / Build | String `MAYAR_API_KEY` dan token tidak muncul di keluaran build, bundle `.next`, log webhook, atau tabel event. |
| **TC-189** | Muatan non-JSON, berukuran $> 100\text{ KB}$, atau event non-`payment.received` | Route Handler | Muatan rusak ditolak 400 Bad Request; event selain `payment.received` dijawab 200 dan dicatat `diabaikan`. |
| **TC-190** | Halaman `/pembayaran/selesai` statis dan bebas Reflected XSS | UI Inspection | Parameter query `?invoice=...` atau skrip jahat di URL tidak pernah dirender ke HTML/DOM. |
| **TC-191** | Uji Konkurensi: Dua webhook bersamaan untuk tagihan yang sama bebas deadlock | PowerShell Concurrency | 10 iterasi konkurensi paralel mengeksekusi urutan kunci baris tanpa mengalami `SQLSTATE 40P01` (Deadlock). |
| **TC-192** | Pembuatan tagihan untuk pesanan bukan `dikirim` (mis. `draf` / `dikonfirmasi`) ditolak | SQL / Server Action | Pemanggilan `rpc_siapkan_tagihan_mayar` pada draf atau pesanan belum kirim ditolak dengan kode `E0066`. |

### Regresi Test Case Lama yang Wajib Dijalankan Ulang:
1. **TC-16 s.d. TC-18:** Batas kredit dan deteksi tagihan overdue (memastikan pelunasan Mayar mengembalikan limit kredit dan membuka blokir overdue).
2. **TC-21 s.d. TC-23:** Alur status pesanan dan pelunasan manual `rpc_catat_pelunasan`.
3. **TC-28:** Integritas tabel `audit_log` (memastikan relaksasi `pelaku_id DROP NOT NULL` tidak merusak pencatatan audit manual pengguna).
4. **TC-88:** Dampak pelunasan terhadap view penagihan `v_tagihan` (faktur langsung hilang seketika setelah dilunasi via Mayar).

---

## 11. Analisis Risiko & Pertanyaan Terbuka

### 11.1 Analisis Risiko Teknis & Mitigasi
1. **Perubahan Format Payload Mayar Sandbox:**
   - *Risiko:* Struktur JSON webhook sandbox dapat diperbarui oleh Mayar tanpa pemberitahuan sebelumnya.
   - *Mitigasi:* Menggunakan ekstraksi kandidat ID multilapis (`candidateIds`) dan selalu melakukan verifikasi ulang langsung via endpoint GET `/invoice/{id}` resmi.
2. **Ketergantungan Eksternal saat Deploy Produksi:**
   - *Risiko:* Sandbox Mayar memiliki batasan kuota atau mengalami masa pemeliharaan (*maintenance*).
   - *Mitigasi:* Seluruh test otomatis dibangun di atas `MockMayarClient` sehingga CI/CD build dan pengujian lokal tidak bergantung pada konektivitas internet sandbox Mayar.

### 11.2 Keputusan Desain & Pertanyaan Terbuka (Tech Lead Recommendations)

Sesuai aturan kerja, opsi paling konservatif dipilih sebagai keputusan default:

| No | Keputusan Desain | Keputusan Konservatif Terpilih (Default) | Alternatif Terbuka |
|---|---|---|---|
| **K1** | **Penanganan Biaya Transaksi (*Payment Fee*):** | **Biaya ditanggung perusahaan (CV Sinar Abadi Niaga).** Nominal tagihan Mayar sama persis 100% dengan total pesanan (`pesanan_jual.total`), tanpa biaya tambahan ke pelanggan. | Menambahkan biaya admin gerbang pembayaran ke tagihan toko. |
| **K2** | **Alamat Email Pelanggan Default:** | Jika tidak diset di form dialog, sistem menggunakan fallback ke `MAYAR_DEFAULT_CUSTOMER_EMAIL` (mis. email admin keuangan kantor). | Menolak pembuatan tagihan jika email pelanggan tidak diisi manual oleh sales/manajer. |
| **K3** | **Masa Berlaku Tagihan Pembayaran:** | Default **7 hari (168 jam)** sejak dibuat. Manajer dapat memilih 1–30 hari. | Tagihan tidak memiliki batas waktu (tetap aktif sampai dibayar/ditutup). |
| **K4** | **Aksi saat Pesanan Telah Lunas Manual tetapi Pembayaran Mayar Masuk:** | **Tandai `perlu_tinjau` dan tahan.** Sistem tidak melakukan pengembalian dana (*refund*) otomatis dan tidak mengubah status pesanan. | Mengabaikan webhook pembayaran yang datang belakangan. |

---

## 12. Perkiraan Ukuran Pengerjaan (Effort Estimation)

| Komponen Deliverable | Estimasi Jam |
|---|---|
| Skema Database: Tabel `tagihan_mayar`, `mayar_webhook_event`, Partial Indexes, Relaksasi `audit_log` | 2–3 jam |
| Prosedur Tersimpan (RPC): `rpc_siapkan`, `rpc_simpan`, `rpc_tutup`, `rpc_sistem_lunaskan`, modifikasi `rpc_catat_pelunasan` | 4–5 jam |
| Abstraksi Klien: `MayarClient`, `HttpMayarClient`, `MockMayarClient`, penanganan error & timeout | 2–3 jam |
| Route Handler Webhook: `/api/webhooks/mayar/[token]`, timingSafeEqual, verifikasi ganda, idempotensi | 3–4 jam |
| Frontend Detail Pesanan: Komponen `MayarPaymentPanel`, modal dialog pembuatan tagihan, tombol WhatsApp | 3–4 jam |
| Frontend Monitoring: Halaman `/pembayaran` (DataTable Manajer) & integrasi menu Sidebar | 2–3 jam |
| Frontend Publik: Halaman statis `/pembayaran/selesai` & bypass middleware | 1–2 jam |
| Skrip Simulasi Webhook: `scripts/simulasi-webhook.ts` | 1–2 jam |
| Test Suite: SQL Tests (`TC-173` s.d. `TC-192`), Vitest Mock Tests, dan Regresi Penuh | 4–5 jam |
| **Total Estimasi Pengerjaan** | **22–31 jam (~3–4 hari kerja)** |

---

---

## 13. Hasil Implementasi & Bukti Uji

Fitur Tautan Bayar Piutang lewat Mayar (PRD 11.3) telah selesai diimplementasikan 100% dengan status:

| Komponen | Deliverable | Status | Bukti / Catatan |
|---|---|---|---|
| **Database Migrations** | `20261023080000_tautan_bayar_mayar.sql` & `pending_features_cloud.sql` | **Selesai** | Tabel `tagihan_mayar`, `mayar_webhook_event`, index `uq_tagihan_mayar_pesanan_aktif`, 7 RPCs, relaksasi `audit_log.pelaku_id`. |
| **SQL Test Suite 13** | `supabase/tests/13_tautan_bayar_mayar.sql` | **Lulus 100%** | TC-192, TC-186, TC-184, TC-178, TC-177, TC-175, TC-179, TC-185 seluruhnya terverifikasi via PostgreSQL runner. |
| **Mayar Client Abstraction** | `src/features/pembayaran/mayar-client.ts` | **Selesai** | `MockMayarClient` (default aktif tanpa API key) & `HttpMayarClient` (real sandbox fetch, 8s timeout, Bearer auth). |
| **Route Handler Webhook** | `src/app/api/webhooks/mayar/[token]/route.ts` | **Selesai** | POST only (GET/PUT 405), token constant-time `timingSafeEqual` (404), max 100 KB (413), idempotensi & 2-way verification. |
| **Server Actions & Service** | `src/features/pembayaran/service.ts` & `actions.ts` | **Selesai** | `buatTagihanMayarAction`, `periksaStatusMayarAction`, `tutupTagihanMayarAction`, Zod validation & translation error catalog. |
| **UI Panel Detail Pesanan** | `src/features/pembayaran/components/MayarPaymentPanel.tsx` | **Selesai** | Panel Manajer di `/pesanan/[id]`: buat tagihan, salin link, bagikan WhatsApp resmi, periksa status, tutup tagihan. |
| **UI Halaman Monitoring** | `src/app/(dashboard)/pembayaran/page.tsx` | **Selesai** | DataTable Manajer memantau seluruh riwayat tagihan, filter status, indikator sandbox/live gateway. |
| **Halaman Publik Landing** | `src/app/pembayaran/selesai/page.tsx` | **Selesai** | Statis, noindex, tanpa query database, bebas login (diizinkan di `src/middleware.ts` & `src/lib/akses.ts`). |
| **Skrip Simulasi Webhook** | `scripts/simulasi-webhook.ts` | **Selesai** | Skrip CLI lokal untuk menguji pengiriman webhook valid, invalid token, duplicate, dan broken json. |
| **Unit & Integration Tests** | `src/features/pembayaran/__tests__/mayar.test.ts` | **Lulus (10/10)** | Seluruh skenario mock, http client, timingSafeEqual, bad json, oversized payload lolos 100%. |
| **Full Regression Suite** | `tsc`, `lint`, `vitest`, `build` | **Lulus 100%** | 21 test files (164 tests passed), 0 lint errors, build Next.js 37/37 static/dynamic pages compiled, 0 secret leak. |

*Implementasi selesai sesuai aturan kerja AGENTS.md.*
