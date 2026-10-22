# Spesifikasi Teknis: Modul Penagihan Piutang dan Pengingat Jatuh Tempo

**Fitur:** Penagihan Piutang, Klasifikasi Umur Tagihan, Kartu Piutang Cetak, Pengingat WhatsApp, dan Catatan Penagihan Append-Only  
**Status:** DRAFT USULAN SPESIFIKASI (Menunggu Persetujuan Pemilik Proyek)  
**Peran:** Tech Lead  
**Tanggal:** 22 Oktober 2026  
**Branch Rencana:** `fitur/penagihan-piutang`  
**Rujukan Wajib:**
- [`AGENTS.md`](../AGENTS.md) (Aturan Fitur Baru & Aturan UI)
- [`docs/00-spesifikasi.md`](00-spesifikasi.md) (BR-05, BR-07)
- [`docs/02-matriks-akses.md`](02-matriks-akses.md)
- [`docs/03-test-plan.md`](03-test-plan.md) (Nomor TC terakhir: TC-70)
- [`docs/04-asumsi-dan-celah.md`](04-asumsi-dan-celah.md) (Kode error terakhir: E0045)
- [`docs/05-skema.md`](05-skema.md)
- [`docs/16-peta-sistem-saat-ini.md`](16-peta-sistem-saat-ini.md)

---

## 1. Audit Kondisi Saat Ini (Kebutuhan vs Lapangan)

Berdasarkan inspeksi langsung pada kode sumber (`src/`), katalog basis data PostgreSQL, dan file migrasi (`supabase/migrations/`), berikut adalah perbandingan antara kebutuhan fitur penagihan dengan komponen yang sudah ada:

| Kebutuhan Fitur | Sudah Ada? | Lokasi Saat Ini | Kesenjangan & Tindakan yang Diperlukan |
|---|---|---|---|
| **Cakupan Faktur Tagihan** (`status = 'dikirim'`) | **Sudah Ada Parsial** | `public.pesanan_jual`, `supabase/migrations/20261021140000_kredit_overdue.sql` | `fn_hitung_kredit_pelanggan` menghitung total piutang terkirim dan overdue, tetapi belum ada view/fungsi yang mengembalikan seluruh faktur terkirim belum lunas (mencakup belum jatuh tempo & jatuh tempo hari ini). |
| **Klasifikasi Umur Tagihan 6 Kategori** (Asia/Jakarta) | **Belum Ada** | Hanya ada `hari_lewat` di RPC laporan piutang (`rpc_laporan_piutang_pesanan`) | Kategori laporan lama hanya 4 kelompok (`belum_jatuh_tempo`, `lewat_1_7_hari`, `lewat_8_30_hari`, `lewat_gt_30_hari`). Belum memisahkan kategori penting penagihan: `hari_ini` ($= 0$) dan `segera` (1–3 hari ke depan). Perlu dibuat fungsi database klasifikasi tunggal `fn_klasifikasi_tagihan`. |
| **View Tagihan Terbuka** (`v_tagihan`) | **Belum Ada** | Tidak ada view khusus faktur terkirim belum lunas | Perlu view baru `public.v_tagihan` (`security_invoker = true`) yang membungkus `pesanan_jual` `status = 'dikirim'`, terhubung dengan data pelanggan, menghitung kategori umur, serta memuat janji bayar aktif terakhir. |
| **Tabel Catatan Penagihan & Janji Bayar** | **Belum Ada** | Katalog tabel PostgreSQL | Perlu tabel baru `public.catatan_penagihan` bersifat **append-only** (trigger guard menolak UPDATE/DELETE) dengan validasi tanggal janji bayar $\ge$ tanggal bisnis hari ini. |
| **RPC Pencatatan Penagihan** (`rpc_catat_penagihan`) | **Belum Ada** | Katalog RPC PostgreSQL | Perlu RPC baru `SECURITY DEFINER` dengan pengecekan peran (Gudang ditolak `E0001`, Penjualan hanya untuk pelanggan berfaktur miliknya `E0050`, Manajer untuk semua). |
| **Halaman Antarmuka Penagihan** (`/penagihan`) | **Belum Ada** | `src/app/(dashboard)/penagihan/` | Perlu halaman baru terproteksi (Manajer & Penjualan) dengan 4 kartu metrik ringkasan, filter klasifikasi, pencarian, dan DataTable padat. |
| **Kartu Piutang Cetak** (`/pelanggan/[id]/piutang`) | **Belum Ada** | `src/app/(dashboard)/pelanggan/[id]/` | Perlu halaman khusus cetak kartu piutang dengan `@media print`, kop surat resmi, tabel umur faktur, dan rekapitulasi penagihan. |
| **Pengingat WhatsApp Siap Kirim** | **Belum Ada** | Frontend components | Perlu modul murni normalisasi nomor telepon Indonesia (mengubah `08xx` $\to$ `628xx`, membersihkan karakter non-digit) dan 3 templat pesan siap kirim ter-encode URL. |
| **Pencatatan Otomatis saat Buka WA** | **Belum Ada** | Frontend Server Actions | Perlu alur Server Action yang mencatat `catatan_penagihan` jenis `pengingat_wa` sebelum membuka tautan `https://wa.me/...`. |
| **Format Telepon Pelanggan Lapangan** | **Sudah Teridentifikasi** | `supabase/seed.sql`, `src/features/pelanggan/schemas.ts` | Data seed tersimpan sebagai string `081234567891` s.d. `081234567895`. Form input menerima string bebas hingga 20 karakter. Diperlukan sanitasi & normalisasi tangguh di frontend. |
| **Pelunasan Faktur** | **Sudah Ada** | `rpc_catat_pelunasan` di `src/features/pesanan/actions.ts` | Sudah tersedia via `catatPelunasanAction` khusus Manajer. Tombol tinggal dihubungkan pada daftar tagihan tanpa mengubah alur database. |
| **Aturan Batas Kredit & Overdue (BR-05)** | **Sudah Ada & Wajib Dipertahankan** | `rpc_konfirmasi_pesanan`, `fn_hitung_kredit_pelanggan` | Fitur penagihan **sama sekali tidak mengubah** logika atau constraint BR-05, BR-13, dan BR-14. |

---

## 2. Keputusan Desain yang Ditetapkan (A1 s.d. A11)

Seluruh keputusan di bawah ini bersifat mengikat dan menjadi fondasi utama arsitektur fitur penagihan:

1. **A1 (Cakupan Tagihan):** Faktur yang ditagih HANYA `pesanan_jual` berstatus `dikirim` (barang fisik sudah keluar dan tanggal jatuh tempo sudah terbit). Pesanan berstatus `dikonfirmasi` belum memiliki tanggal `jatuh_tempo` definitif sehingga TIDAK masuk dalam daftar penagihan. Pesanan `lunas` dan `dibatalkan` dikecualikan.
2. **A2 (Klasifikasi Tanggal Bisnis Asia/Jakarta):** Seluruh perbandingan tanggal wajib menggunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date`.
   - **`belum_jatuh_tempo`**: `jatuh_tempo > v_today + 3` (lebih dari 3 hari ke depan).
   - **`segera`**: `jatuh_tempo BETWEEN (v_today + 1) AND (v_today + 3)` (1 s.d. 3 hari lagi).
   - **`hari_ini`**: `jatuh_tempo = v_today` (jatuh tempo tepat hari ini, **BELUM overdue**).
   - **`overdue_1_7`**: `(v_today - jatuh_tempo) BETWEEN 1 AND 7` (terlambat 1–7 hari).
   - **`overdue_8_30`**: `(v_today - jatuh_tempo) BETWEEN 8 AND 30` (terlambat 8–30 hari).
   - **`overdue_lebih_30`**: `(v_today - jatuh_tempo) > 30` (terlambat lebih dari 30 hari).
   - Urutan default daftar faktur: `jatuh_tempo ASC, dibuat_pada ASC` (overdue terlama tampil paling atas).
3. **A3 (Matriks Visibilitas & Pelunasan):**
   - **Manajer**: melihat seluruh tagihan semua pelanggan, dapat mencatat penagihan untuk semua pelanggan, dan memiliki tombol "Catat Pelunasan".
   - **Staf Penjualan**: HANYA melihat tagihan dari pesanan yang dibuat oleh dirinya sendiri (`pesanan_jual.dibuat_oleh = auth.uid()`), hanya boleh mencatat penagihan pada pelanggan yang memiliki tagihan aktif buatannya, dan TIDAK memiliki tombol pelunasan.
   - **Gudang**: DIBLOKIR TOTAL (0 baris di view, ditolak di RPC `E0001`, dan dialihkan di UI ke `/tidak-berwenang`).
4. **A4 (Tabel `catatan_penagihan` Append-Only):**
   - Struktur: `id`, `pelanggan_id`, `pesanan_jual_id` (opsional), `jenis`, `isi`, `janji_bayar_tanggal`, `dibuat_oleh`, `dibuat_pada`.
   - Dilarang UPDATE/DELETE (ditegakkan via trigger `trg_catatan_penagihan_append_only`).
   - Penulisan hanya melalui RPC `rpc_catat_penagihan`.
   - Panjang `isi` wajib 3 s.d. 500 karakter setelah `btrim()`.
   - Bila `jenis = 'janji_bayar'`, `janji_bayar_tanggal` WAJIB diisi dan $\ge$ tanggal bisnis hari ini; bila jenis lain, wajib `NULL`.
5. **A5 (Janji Bayar & Janji Terlewat):**
   - Mengambil rekaman janji bayar aktif terakhir per faktur atau per pelanggan.
   - Jika `janji_bayar_tanggal < v_today` sementara pesanan masih belum lunas (`status = 'dikirim'`), status janji bayar dievaluasi secara dinamis saat dibaca (*on-the-fly*) sebagai `"terlewat"` tanpa memerlukan cron job atau worker background.
6. **A6 (Integrasi WhatsApp Siap Kirim Tanpa Vendor Eksternal):**
   - Tautan langsung: `https://wa.me/<nomor_bersih>?text=<teks_terencode>`.
   - Normalisasi nomor telepon: buang spasi, tanda hubung (`-`), titik (`.`), tanda kurung; ubah awalan `08` menjadi `628`; nomor valid jika 9 s.d. 15 digit. Nomor tidak valid menonaktifkan tombol kirim dengan pesan peringatan jelas.
   - Tersedia 3 templat pesan (Menjelang Tempo, Tempo Hari Ini, Terlambat) yang dapat diedit di dialog modal sebelum tautan dibuka.
   - Mengklik tombol "Buka WhatsApp" otomatis mencatat rekaman `catatan_penagihan` jenis `pengingat_wa` via Server Action sebelum tab baru terbuka.
7. **A7 (Kartu Piutang Cetak `/pelanggan/[id]/piutang`):**
   - Halaman siap cetak (`@media print`): kop surat resmi CV Sinar Abadi Niaga, tanggal cetak hari ini (Asia/Jakarta), daftar faktur belum lunas, breakdown umur tagihan, total nilai tertagih, dan kolom pengesahan tanda tangan.
   - Zero-leakage: tanpa data HPP, margin, atau harga pokok.
8. **A8 (Halaman Antarmuka `/penagihan` & Dasbor):**
   - Halaman utama `/penagihan` memuat 4 kartu metrik KPI, filter klasifikasi & pelanggan, pencarian faktur/toko, tabel data faktur, tombol aksi WhatsApp, catatan penagihan, kartu piutang, dan pelunasan (khusus Manajer).
   - Widget ringkasan penagihan yang sama disematkan pada Dashboard Manajer dan Penjualan (sesuai cakupan visibilitas A3).
9. **A9 (Sumber Data View `v_tagihan`):**
   - Dibuat dengan `security_invoker = true` sehingga RLS pada tabel `pesanan_jual` otomatis membatasi baris untuk Staf Penjualan.
   - Menyertakan fungsi pembantu klasifikasi `fn_klasifikasi_tagihan`.
10. **A10 (Audit Log Efisien):**
    - Tabel `catatan_penagihan` sudah memuat `dibuat_oleh` dan `dibuat_pada` serta berkarakter append-only, sehingga tidak perlu dicatat ganda ke tabel `audit_log`.
    - Jika terjadi kegagalan/exception pada RPC, seluruh transaksi di-rollback secara otomatis.
11. **A11 (Integritas Sistem Transaksi):**
    - Tidak mengubah status pesanan (`draf`, `dikonfirmasi`, `dikirim`, `lunas`, `dibatalkan`).
    - Tidak mengubah alur kredit BR-05 / BR-13 / BR-14.
    - Tidak menyediakan pembayaran sebagian/parsial (pelunasan tetap 100% penuh via `rpc_catat_pelunasan`).

---

## 3. Aturan Bisnis Baru (Business Rules)

Modul ini melanjutkan katalog aturan bisnis resmi:

- **BR-15 (Klasifikasi Umur Tagihan):**
  Setiap faktur berstatus `dikirim` yang belum lunas wajib dikelompokkan ke dalam satu dari 6 kategori umur berdasarkan selisih hari antara tanggal bisnis Asia/Jakarta dengan `pesanan_jual.jatuh_tempo`. Faktur dengan `jatuh_tempo = (now() AT TIME ZONE 'Asia/Jakarta')::date` diklasifikasikan sebagai `hari_ini` dan ditegaskan belum berstatus menunggak (overdue).
- **BR-16 (Kerahasiaan & Otorisasi Penagihan):**
  Staf Gudang dilarang mengakses data penagihan, catatan penagihan, dan kartu piutang. Staf Penjualan hanya berhak mengakses tagihan dan mencatat penagihan atas pesanan yang dibuat oleh dirinya sendiri. Seluruh data penagihan bebas dari informasi finansial rahasia (HPP, margin, dan harga pokok).
- **BR-17 (Integritas Catatan Penagihan & Janji Bayar):**
  Catatan aktivitas penagihan bersifat permanen (*append-only*). Setiap entri jenis `janji_bayar` wajib menyertakan tanggal janji bayar yang valid dan tidak boleh bertanggal di masa lalu (sebelum hari ini). Jika tanggal janji bayar terlewati dan tagihan belum lunas, sistem wajib menampilkan indikator "Janji Terlewat".
- **BR-18 (Prosedur Pengingat WhatsApp):**
  Pengiriman pengingat WhatsApp dilakukan melalui aplikasi resmi WhatsApp Web/Mobile pengguna via skema URL standar `wa.me`. Setiap pembukaan tautan WhatsApp wajib direkam secara otomatis ke dalam riwayat penagihan dengan jenis `pengingat_wa`.

*Pernyataan Kompatibilitas:* Aturan BR-15 s.d. BR-18 tidak bertentangan dengan BR-01 s.d. BR-14. Transaksi pesanan, pembatasan diskon, batas kredit, blokir overdue, dan pelunasan tetap berjalan persis seperti spesifikasi dasar.

---

## 4. Perancangan Skema Basis Data

### 4.1 Tabel Baru: `public.catatan_penagihan`

```sql
CREATE TABLE public.catatan_penagihan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelanggan_id uuid NOT NULL REFERENCES public.pelanggan(id) ON DELETE RESTRICT,
  pesanan_jual_id uuid NULL REFERENCES public.pesanan_jual(id) ON DELETE SET NULL,
  jenis text NOT NULL CHECK (jenis IN ('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan')),
  isi text NOT NULL,
  janji_bayar_tanggal date NULL,
  dibuat_oleh uuid NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_catatan_penagihan_isi_length CHECK (length(btrim(isi)) BETWEEN 3 AND 500),
  CONSTRAINT ck_catatan_penagihan_janji_bayar CHECK (
    (jenis = 'janji_bayar' AND janji_bayar_tanggal IS NOT NULL) OR
    (jenis <> 'janji_bayar' AND janji_bayar_tanggal IS NULL)
  )
);

CREATE INDEX idx_catatan_penagihan_pelanggan ON public.catatan_penagihan(pelanggan_id, dibuat_pada DESC);
CREATE INDEX idx_catatan_penagihan_pesanan ON public.catatan_penagihan(pesanan_jual_id, dibuat_pada DESC);
CREATE INDEX idx_catatan_penagihan_janji ON public.catatan_penagihan(janji_bayar_tanggal) WHERE jenis = 'janji_bayar';
```

### 4.2 Trigger Guard Append-Only: `trg_catatan_penagihan_append_only`

```sql
CREATE OR REPLACE FUNCTION public.fn_guard_catatan_penagihan()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catatan penagihan bersifat permanen dan tidak dapat diubah atau dihapus'
    USING ERRCODE = 'E0001';
END;
$$;

CREATE TRIGGER trg_catatan_penagihan_guard
  BEFORE UPDATE OR DELETE ON public.catatan_penagihan
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_catatan_penagihan();
```

### 4.3 Fungsi Klasifikasi Umur: `fn_klasifikasi_tagihan`

```sql
CREATE OR REPLACE FUNCTION public.fn_klasifikasi_tagihan(
  p_jatuh_tempo date,
  p_today date DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_jatuh_tempo < p_today THEN
      CASE
        WHEN (p_today - p_jatuh_tempo) BETWEEN 1 AND 7 THEN 'overdue_1_7'
        WHEN (p_today - p_jatuh_tempo) BETWEEN 8 AND 30 THEN 'overdue_8_30'
        ELSE 'overdue_lebih_30'
      END
    WHEN p_jatuh_tempo = p_today THEN 'hari_ini'
    WHEN p_jatuh_tempo <= (p_today + 3) THEN 'segera'
    ELSE 'belum_jatuh_tempo'
  END;
$$;
```

### 4.4 View Tagihan: `public.v_tagihan`

```sql
CREATE OR REPLACE VIEW public.v_tagihan AS
WITH latest_janji AS (
  SELECT DISTINCT ON (COALESCE(pesanan_jual_id, '00000000-0000-0000-0000-000000000000'::uuid), pelanggan_id)
    id AS janji_id,
    pelanggan_id,
    pesanan_jual_id,
    janji_bayar_tanggal,
    isi AS janji_catatan,
    dibuat_pada AS janji_dibuat_pada
  FROM public.catatan_penagihan
  WHERE jenis = 'janji_bayar'
  ORDER BY COALESCE(pesanan_jual_id, '00000000-0000-0000-0000-000000000000'::uuid), pelanggan_id, dibuat_pada DESC
)
SELECT
  pj.id AS pesanan_id,
  pj.nomor AS nomor_pesanan,
  pj.pelanggan_id,
  plg.kode AS kode_pelanggan,
  plg.nama_toko,
  plg.telepon,
  plg.alamat,
  plg.termin_hari,
  plg.batas_kredit,
  pj.total,
  pj.dibuat_oleh,
  prof.nama_lengkap AS nama_sales,
  pj.dibuat_pada,
  pj.dikirim_pada,
  pj.jatuh_tempo,
  -- Perhitungan selisih hari
  CASE
    WHEN pj.jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN ((now() AT TIME ZONE 'Asia/Jakarta')::date - pj.jatuh_tempo)::integer
    ELSE 0
  END AS hari_terlambat,
  CASE
    WHEN pj.jatuh_tempo >= (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN (pj.jatuh_tempo - (now() AT TIME ZONE 'Asia/Jakarta')::date)::integer
    ELSE 0
  END AS hari_menuju,
  -- Klasifikasi umur resmi
  public.fn_klasifikasi_tagihan(pj.jatuh_tempo, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS klasifikasi,
  -- Janji bayar aktif terkait
  lj.janji_bayar_tanggal,
  lj.janji_catatan,
  CASE
    WHEN lj.janji_bayar_tanggal IS NOT NULL AND lj.janji_bayar_tanggal < (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN 'terlewat'
    WHEN lj.janji_bayar_tanggal IS NOT NULL
      THEN 'aktif'
    ELSE 'tidak_ada'
  END AS status_janji
FROM public.pesanan_jual pj
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = pj.dibuat_oleh
LEFT JOIN latest_janji lj ON (lj.pesanan_jual_id = pj.id OR (lj.pesanan_jual_id IS NULL AND lj.pelanggan_id = pj.pelanggan_id))
WHERE pj.status = 'dikirim';

-- RLS & Grants untuk v_tagihan
REVOKE ALL ON public.v_tagihan FROM anon, PUBLIC;
GRANT SELECT ON public.v_tagihan TO authenticated;
```

*Catatan Keserasian Mesin Database:* Pada Postgres 13 lokal, view secara default beroperasi dengan hak pemanggil (*security invoker*). Karena tabel sumbernya adalah `pesanan_jual`, maka RLS `pesanan_jual_select` yang sudah terpasang otomatis menyaring baris sehingga Staf Penjualan hanya menerima pesanan buatannya sendiri (`dibuat_oleh = auth.uid()`).

### 4.5 Kebijakan RLS Tabel `catatan_penagihan`

```sql
ALTER TABLE public.catatan_penagihan ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Manajer membaca semua, Penjualan membaca catatan pada pelanggan yang memiliki tagihan miliknya
CREATE POLICY "catatan_penagihan_select"
  ON public.catatan_penagihan FOR SELECT
  TO authenticated
  USING (
    public.fn_is_manajer()
    OR (
      public.fn_peran() = 'penjualan'
      AND (
        dibuat_oleh = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.pesanan_jual pj
          WHERE pj.pelanggan_id = catatan_penagihan.pelanggan_id
            AND pj.status = 'dikirim'
            AND pj.dibuat_oleh = auth.uid()
        )
      )
    )
  );

-- 2. INSERT/UPDATE/DELETE langsung ditutup (seluruh penulisan via RPC)
CREATE POLICY "catatan_penagihan_modify_block"
  ON public.catatan_penagihan FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.catatan_penagihan FROM anon, PUBLIC;
GRANT SELECT ON public.catatan_penagihan TO authenticated;
```

---

## 5. Rancangan RPC Database Baru

### 5.1 `rpc_catat_penagihan`

- **Tujuan:** Mencatat log interaksi penagihan (telepon, WhatsApp, kunjungan, janji bayar, atau catatan umum).
- **Peran yang Diizinkan:** Penjualan dan Manajer (Gudang ditolak `E0001`).
- **Signature:**
  ```sql
  CREATE OR REPLACE FUNCTION public.rpc_catat_penagihan(
    p_pelanggan_id uuid,
    p_pesanan_jual_id uuid DEFAULT NULL,
    p_jenis text DEFAULT 'catatan',
    p_isi text DEFAULT '',
    p_janji_bayar_tanggal date DEFAULT NULL
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp;
  ```
- **Urutan Validasi & Logika Eksekusi:**
  1. Cek peran pemanggil: jika `NOT IN ('penjualan', 'manajer')` $\to$ `RAISE EXCEPTION` `Akses ditolak` (`E0001`).
  2. Periksa keberadaan pelanggan: jika pelanggan tidak ditemukan $\to$ `RAISE EXCEPTION` `Pelanggan tidak ditemukan` (`E0002`).
  3. Jika pemanggil adalah `penjualan`:
     - Verifikasi apakah pelanggan memiliki minimal satu pesanan berstatus `dikirim` yang dibuat oleh staf pemanggil:
       ```sql
       IF NOT EXISTS (
         SELECT 1 FROM public.pesanan_jual
         WHERE pelanggan_id = p_pelanggan_id
           AND status = 'dikirim'
           AND dibuat_oleh = auth.uid()
       ) THEN
         RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki faktur tagihan aktif pada pelanggan ini' USING ERRCODE = 'E0050';
       END IF;
       ```
  4. Jika `p_pesanan_jual_id` diisi:
     - Verifikasi pesanan: harus berstatus `dikirim`, milik `p_pelanggan_id`.
     - Jika pemanggil `penjualan`, `dibuat_oleh` wajib `= auth.uid()`.
     - Bila tidak cocok $\to$ `RAISE EXCEPTION` `Faktur pesanan tidak valid untuk penagihan pelanggan ini` (`E0051`).
  5. Validasi `p_jenis`: harus salah satu dari `('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan')`.
  6. Validasi `p_isi`: panjang `length(btrim(p_isi))` harus antara 3 sampai 500 karakter. Jika tidak $\to$ `RAISE EXCEPTION` `Catatan penagihan minimal 3 karakter dan maksimal 500 karakter` (`E0047`).
  7. Validasi `p_janji_bayar_tanggal`:
     - Jika `p_jenis = 'janji_bayar'`:
       - Jika `p_janji_bayar_tanggal IS NULL` $\to$ `RAISE EXCEPTION` `Tanggal janji bayar wajib diisi untuk jenis janji bayar` (`E0048`).
       - Jika `p_janji_bayar_tanggal < (now() AT TIME ZONE 'Asia/Jakarta')::date` $\to$ `RAISE EXCEPTION` `Tanggal janji bayar tidak boleh di masa lalu` (`E0049`).
     - Jika `p_jenis <> 'janji_bayar'`: paksa `p_janji_bayar_tanggal := NULL`.
  8. Lakukan `INSERT INTO public.catatan_penagihan`.
  9. Kembalikan `jsonb` berisi `{ id, pelanggan_id, jenis, dibuat_pada }`.

---

## 6. Kode Error Baru

Melanjutkan katalog error sistem (kode bebas berikutnya setelah `E0045`):

| Kode Error | Pesan Resmi (Bahasa Indonesia) | Sumber Pelempar |
|---|---|---|
| **E0046** | Pelanggan tidak memiliki tagihan aktif yang dapat ditagih | `rpc_catat_penagihan` / UI |
| **E0047** | Catatan penagihan minimal 3 karakter dan maksimal 500 karakter | `rpc_catat_penagihan`, Zod schema |
| **E0048** | Tanggal janji bayar wajib diisi untuk jenis penagihan janji bayar | `rpc_catat_penagihan`, Zod schema |
| **E0049** | Tanggal janji bayar tidak boleh di masa lalu | `rpc_catat_penagihan`, Zod schema |
| **E0050** | Anda tidak memiliki wewenang menagih pelanggan ini | `rpc_catat_penagihan` |
| **E0051** | Faktur tidak valid untuk penagihan pelanggan ini | `rpc_catat_penagihan` |

*Kode berikutnya yang tersedia setelah modul ini: **E0052**.*

---

## 7. Rancangan Frontend & Antarmuka Pengguna (UI)

Sesuai Aturan Desain di `AGENTS.md` (Enterprise / Clean / Slate / Tanpa Glassmorphism):

### 7.1 Helper Murni & Utilitas WhatsApp (`src/features/penagihan/utils.ts`)

Modul fungsi murni (*pure functions*) yang dapat diuji mandiri via Vitest:

1. **`normalisasiNomorTelepon(telepon: string | null | undefined): { valid: boolean; nomor: string; pesanError?: string }`**:
   - Menghilangkan seluruh spasi, strip (`-`), titik (`.`), tanda kurung, dan karakter non-digit kecuali tanda `+` di awal.
   - Mengubah `+62` menjadi `62`.
   - Mengubah awalan `08` menjadi `628`.
   - Memastikan panjang digit antara 9 hingga 15 karakter dan seluruhnya numerik.
   - Jika valid: `{ valid: true, nomor: '6281234567891' }`.
   - Jika tidak valid / kosong: `{ valid: false, nomor: '', pesanError: 'Nomor telepon tidak valid untuk WhatsApp (wajib 9-15 digit)' }`.
2. **`buatPesanWhatsApp(jenis: 'menjelang' | 'hari_ini' | 'terlambat', params: TemplatWaParams): string`**:
   - Menghasilkan draf pesan sopan & profesional mengatasnamakan CV Sinar Abadi Niaga.
   - Format:
     ```text
     Halo Toko Berkah Mandiri, kami dari CV Sinar Abadi Niaga ingin menginformasikan tagihan pesanan Anda:
     - SO-2026-000012: Rp1.250.000 (Jatuh tempo: 22/10/2026)
     Total tertagih: Rp1.250.000.
     Mohon kesediaannya untuk melakukan pembayaran tepat waktu. Terima kasih.
     ```
3. **`buatUrlWhatsApp(nomor: string, teks: string): string`**:
   - Menghasilkan `https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`.

### 7.2 Halaman `/penagihan` (Daftar & Monitoring Penagihan)

- **Header:** `PageHeader` dengan judul "Penagihan Piutang & Monitoring Tagihan", deskripsi "Daftar seluruh faktur terkirim yang belum lunas, pengingat WhatsApp, dan catatan janji bayar pelanggan".
- **Kartu Metrik KPI (4 Kolom Grid):**
  1. *Total Piutang Tertagih* (Nominal Rupiah dari seluruh faktur berstatus `dikirim`).
  2. *Total Tagihan Overdue* (Nominal Rupiah faktur yang sudah melewati jatuh tempo).
  3. *Jatuh Tempo Hari Ini* (Jumlah faktur dengan `klasifikasi = 'hari_ini'`).
  4. *Segera Jatuh Tempo (1-3 Hari)* (Jumlah faktur dengan `klasifikasi = 'segera'`).
- **Filter Bar:**
  - Tab Filter Klasifikasi: `Semua` | `Overdue (>30, 8-30, 1-7)` | `Hari Ini` | `Segera (1-3 Hari)` | `Belum Tempo (>3 Hari)`.
  - Dropdown Filter Pelanggan.
  - Input Pencarian Cepat (Nomor Pesanan / Nama Toko).
- **DataTable Padat:**
  - *Kolom:* Nomor SO (link ke detail pesanan) | Pelanggan | Sales Pembuat | Tanggal Kirim | Jatuh Tempo | Total Nilai | Klasifikasi Umur (BadgeStatus) | Janji Bayar Terakhir | Aksi.
  - *Varian Badge Umur:*
    - `hari_ini`: Badge Amber berkedip/kontras tinggi ("Jatuh Tempo Hari Ini").
    - `segera`: Badge Amber redup ("Segera: X hari lagi").
    - `overdue_1_7`: Badge Rose/Red ("Terlambat X hari").
    - `overdue_8_30`: Badge Red bold ("Terlambat X hari").
    - `overdue_lebih_30`: Badge Red solid ("Kritis: >30 hari").
    - `belum_jatuh_tempo`: Badge Slate ("X hari lagi").
  - *Kolom Janji Bayar:* Menampilkan tanggal & catatan ringkas; jika terlewat, muncul tag merah kecil `Janji Terlewat`.
  - *Menu Aksi (Dropdown/Buttons):*
    - Tombol WhatsApp (ikon hijau, nonaktif bila nomor tidak valid).
    - Tombol Catat Penagihan (membuka dialog modal).
    - Tombol Kartu Piutang (menuju `/pelanggan/[id]/piutang`).
    - Tombol Catat Pelunasan (khusus Manajer).

### 7.3 Dialog Modal Interaktif

1. **Dialog Pengingat WhatsApp:**
   - Menampilkan pilihan 3 templat radio button.
   - Textarea pratinjau teks pesan yang dapat disesuaikan pengguna.
   - Peringatan nomor tujuan (mis. `+62 812-3456-7891` $\to$ `6281234567891`).
   - Tombol utama: "Kirim & Catat Riwayat WhatsApp" (otomatis memicu Server Action pencatatan lalu membuka tab baru).
2. **Dialog Catat Penagihan & Janji Bayar:**
   - Pilihan jenis: Telepon, Kunjungan Langsung, Janji Bayar, Catatan Khusus.
   - Input tanggal `janji_bayar_tanggal` (muncul kondisional saat jenis = `janji_bayar`, min date = hari ini).
   - Textarea isi catatan (3–500 karakter, counter karakter live).
   - Tombol "Simpan Catatan".

### 7.4 Halaman Kartu Piutang Siap Cetak (`/pelanggan/[id]/piutang`)

- **Akses:** Manajer dan Penjualan (sesuai kepemilikan pesanan).
- **Layout Cetak (`@media print`):**
  - Menyembunyikan sidebar navigasi, header sistem, tombol aksi cetak, dan elemen dekoratif.
  - Kop Perusahaan: **CV SINAR ABADI NIAGA**, Alamat Operasional, Kontak.
  - Judul Dokumen: **KARTU PIUTANG PELANGGAN** per Tanggal Cetak (Asia/Jakarta).
  - Profil Pelanggan: Kode Toko, Nama Toko, Alamat, Telepon, Plafon Kredit, Termin Pembayaran.
  - Tabel Daftar Tagihan Belum Lunas: Nomor SO, Tanggal Kirim, Tanggal Jatuh Tempo, Nilai Faktur, Umur Piutang, Status.
  - Kotak Rekapitulasi: Total Belum Tempo, Total Jatuh Tempo Hari Ini, Total Menunggak (Overdue), Grand Total Piutang.
  - Kolom Tanda Tangan: Dibuat Oleh (Sales/Admin), Disetujui (Manajer Keuangan), Diterima/Mengetahui (Pihak Toko).

### 7.5 Widget Dasbor (Ringkasan Penagihan)

- Ditambahkan pada Dashboard Utama (`src/app/(dashboard)/page.tsx`):
  - Bagian atas kartu ringkasan penagihan jika terdapat tagihan `hari_ini` atau `overdue`.
  - Tautan langsung `Lihat Semua Tagihan (X faktur) &rarr;` menuju `/penagihan`.
  - Staf Penjualan hanya melihat angka dari pesanan miliknya; Manajer melihat total perusahaan.

---

## 8. Rencana Pengujian (Test Plan TC-71 s.d. TC-88)

Melanjutkan penomoran dari `TC-70` di [`docs/03-test-plan.md`](03-test-plan.md):

| ID Test | Fokus Skenario Uji | Media Uji | Harapan Hasil |
|---|---|---|---|
| **TC-71** | Klasifikasi `hari_ini` (jatuh tempo = hari ini Asia/Jakarta) | SQL / Unit | Mengembalikan status `hari_ini`, `hari_terlambat = 0`, dan diverifikasi **belum** berstatus overdue. |
| **TC-72** | Klasifikasi `segera` (jatuh tempo 1 s.d. 3 hari ke depan) | SQL / Unit | Tanggal `v_today + 1`, `+2`, dan `+3` diklasifikasikan konsisten sebagai `segera`. |
| **TC-73** | Klasifikasi `belum_jatuh_tempo` (jatuh tempo > 3 hari ke depan) | SQL / Unit | Tanggal `v_today + 4` hari diklasifikasikan sebagai `belum_jatuh_tempo`. |
| **TC-74** | Klasifikasi `overdue_1_7` (terlambat 1 s.d. 7 hari) | SQL / Unit | Tanggal `v_today - 1` s.d. `v_today - 7` hari menghasilkan `overdue_1_7` dengan nilai `hari_terlambat` tepat. |
| **TC-75** | Klasifikasi `overdue_8_30` (terlambat 8 s.d. 30 hari) | SQL / Unit | Tanggal `v_today - 8` s.d. `v_today - 30` hari menghasilkan `overdue_8_30`. |
| **TC-76** | Klasifikasi `overdue_lebih_30` (terlambat > 30 hari) | SQL / Unit | Tanggal `v_today - 31` hari menghasilkan kategori `overdue_lebih_30`. |
| **TC-77** | Isolasi Visibilitas Penjualan pada `v_tagihan` (RLS) | SQL / Integrasi | Staf Penjualan 1 hanya menerima faktur dari pesanan miliknya; faktur staf lain tidak muncul. |
| **TC-78** | Pemblokiran Total Akses Gudang (RBAC & RLS) | SQL / Integrasi | Gudang yang memanggil `v_tagihan` atau `rpc_catat_penagihan` ditolak bersih (`E0001` / 0 baris). |
| **TC-79** | Hak Akses Penuh Manajer pada `v_tagihan` | SQL / Integrasi | Manajer membaca seluruh faktur terkirim belum lunas lintas seluruh staf penjualan. |
| **TC-80** | Sifat Append-Only Tabel `catatan_penagihan` | SQL | Perintah UPDATE atau DELETE langsung pada `catatan_penagihan` ditolak oleh trigger guard. |
| **TC-81** | Validasi Panjang Isi Catatan Penagihan (3–500 Char) | SQL / Vitest | Isi catatan < 3 karakter atau > 500 karakter setelah trim ditolak dengan error `E0047`. |
| **TC-82** | Validasi Tanggal Janji Bayar Wajib & Larangan Masa Lalu | SQL / Vitest | `jenis = 'janji_bayar'` tanpa tanggal ditolak `E0048`; tanggal sebelum hari ini ditolak `E0049`. |
| **TC-83** | Deteksi Dinamis "Janji Terlewat" | SQL / View | Catatan janji bayar bertanggal kemarin pada faktur belum lunas otomatis berstatus `status_janji = 'terlewat'`. |
| **TC-84** | Normalisasi Nomor Telepon Indonesia (Fungsi Murni) | Vitest | Format `0812...`, `+62 812-...`, `0812-3456-7890`, dan spasi berhasil diubah ke format standar `62812...`. |
| **TC-85** | Validasi Nomor Telepon Tidak Valid untuk WhatsApp | Vitest | Nomor kantor kabel `021...`, nomor pendek `< 9` digit, atau nomor kosong dideteksi tidak valid (`valid = false`). |
| **TC-86** | Encoding Karakter Khusus & Baris Baru Templat WhatsApp | Vitest | Pesan WhatsApp ter-encode sempurna (`encodeURIComponent`) tanpa karakter rusak di URL `wa.me`. |
| **TC-87** | Otomatisasi Pencatatan Riwayat saat Buka WhatsApp | Server Action | Aksi klik kirim WhatsApp berhasil menyisipkan rekaman `catatan_penagihan` berjenis `pengingat_wa`. |
| **TC-88** | Dampak Pelunasan Manajer terhadap Daftar Tagihan | SQL / Integrasi | Pemanggilan `rpc_catat_pelunasan` mengubah status pesanan ke `lunas`; faktur seketika hilang dari `v_tagihan`. |

---

## 9. Analisis Risiko & Mitigasi

1. **Risiko Penumpukan Catatan Penagihan (Tabel Append-Only):**
   - *Mitigasi:* Indexing komposit pada `(pelanggan_id, dibuat_pada DESC)` dan `(pesanan_jual_id, dibuat_pada DESC)`. Operasi baca riwayat selalu dibatasi per halaman (*pagination*).
2. **Risiko Nomor WhatsApp Salah Kirim ke Pelanggan Lain:**
   - *Mitigasi:* Dialog modal selalu menampilkan pratinjau nomor hasil normalisasi dan nama toko tujuan sebelum tombol buka tautan ditekan.
3. **Risiko Kebocoran Data Piutang Antar Staf Penjualan:**
   - *Mitigasi:* RLS pada tabel inti `pesanan_jual` menjadi penjaga utama view `v_tagihan`, didukung verifikasi kepemilikan faktur di dalam `rpc_catat_penagihan`.
4. **Risiko Drift Tanggal Server UTC vs Asia/Jakarta:**
   - *Mitigasi:* Seluruh perbandingan dan default function menggunakan `(now() AT TIME ZONE 'Asia/Jakarta')::date` sesuai Bagian 8.3 `AGENTS.md`.

---

## 10. Pertanyaan Terbuka untuk Pemilik Proyek (Tech Lead Interview)

Sebelum memulai pengerjaan kode (implementasi), berikut 4 keputusan desain yang diajukan ke Pemilik Proyek:

| No | Pertanyaan Desain | Opsi A (Rekomendasi Konservatif) | Opsi B (Alternatif) |
|---|---|---|---|
| **D1** | **Hak Catat Penagihan Umum pada Pelanggan yang Belum Pernah Bertransaksi dengan Sales Terkait:** | **(A) Dibatasi:** Staf Penjualan hanya boleh mencatat penagihan jika pelanggan memiliki tagihan aktif dari pesanan buatannya. | **(B) Terbuka:** Staf Penjualan boleh mencatat pada seluruh pelanggan yang terdaftar. |
| **D2** | **Ketersediaan Tombol WhatsApp pada Kartu Piutang Cetak:** | **(A) Khusus di Halaman Web:** Pada mode cetak fisik kertas (`@media print`), tombol aksi WhatsApp disembunyikan. | **(B) Sertakan QR Code:** Menampilkan QR Code WhatsApp toko pada lembar cetak. |
| **D3** | **Tampilan Faktur Terkirim yang Belum Jatuh Tempo di Halaman Detail Pelanggan (`/pelanggan/[id]`):** | **(A) Tambah Tab / Seksi Tagihan Berjalan:** Menampilkan daftar seluruh tagihan terkirim di samping tabel faktur overdue. | **(B) Tautan ke Kartu Piutang Saja:** Cukup sediakan tombol pintas "Buka Kartu Piutang". |
| **D4** | **Pencatatan Penagihan tanpa Nomor Faktur Spesifik (Tingkat Toko):** | **(A) Diizinkan:** `pesanan_jual_id` boleh `NULL` jika penagihan membicarakan seluruh total piutang toko. | **(B) Wajib per Faktur:** Setiap catatan penagihan wajib memilih salah satu nomor pesanan. |

---

## 11. Perkiraan Ukuran Pekerjaan (Effort Estimation)

| Komponen Deliverable | Estimasi Jam |
|---|---|
| Skema Database: Tabel `catatan_penagihan`, Trigger Guard, Fungsi Klasifikasi, View `v_tagihan`, RLS | 3–4 jam |
| RPC Database: `rpc_catat_penagihan` dengan validasi otorisasi & janji bayar | 2–3 jam |
| Helper Utilitas: Normalisasi Nomor Telepon & Templat WA murni + Vitest | 2–3 jam |
| Server Actions: Aksi catat penagihan, aksi ambil riwayat, integrasi WA | 2–3 jam |
| Halaman `/penagihan`: KPI Cards, Filter Klasifikasi, DataTable, Dialog Modals | 4–5 jam |
| Halaman `/pelanggan/[id]/piutang`: Kartu Piutang Siap Cetak (`@media print`) | 3–4 jam |
| Widget Dasbor: Indikator & ringkasan tagihan pada Dasbor Manajer & Penjualan | 1–2 jam |
| Test Suite: SQL Tests (`TC-71` s.d. `TC-88`) & Regresi Penuh | 3–4 jam |
| **Total Estimasi Pengerjaan** | **20–28 jam (~3–4 hari kerja)** |

---

---

## 12. Hasil Implementasi & Verifikasi (Fase Full-Stack Engineer)

Implementasi fitur **Penagihan Piutang dan Pengingat Jatuh Tempo** telah diselesaikan secara lengkap pada branch `fitur/penagihan` dengan mematuhi seluruh aturan `AGENTS.md` (Aturan Fitur Baru & Aturan UI Enterprise):

### 12.1 Komponen yang Telah Selesai
1. **Basis Data & Migrasi (`supabase/migrations/20261022210000_penagihan_piutang.sql`):**
   - Tabel `public.catatan_penagihan` dengan trigger guard `trg_catatan_penagihan_guard` (menolak tegas UPDATE & DELETE, `E0051`).
   - Fungsi klasifikasi umur `public.fn_klasifikasi_tagihan(p_jatuh_tempo, p_today)` berbasis zona waktu bisnis `Asia/Jakarta`.
   - View aman `public.v_tagihan` (`security_invoker = true` / filter peran RLS, nol kolom finansial rahasia).
   - RPC `public.rpc_catat_penagihan` dan `public.rpc_baca_catatan_penagihan` (`SECURITY DEFINER`, search_path eksplisit).
2. **Katalog Error & Hak Akses:**
   - Terpetakan kode error `E0046` s.d. `E0052` di [`src/lib/errors.ts`](../src/lib/errors.ts).
   - Terdaftar menu & rute `/penagihan` dan `/pelanggan/[id]/piutang` di [`src/lib/akses.ts`](../src/lib/akses.ts) dan [`Sidebar.tsx`](../src/components/layout/Sidebar.tsx).
3. **Frontend & Antarmuka Pengguna:**
   - Helper murni normalisasi telepon dan draf pesan WhatsApp di [`src/features/penagihan/utils.ts`](../src/features/penagihan/utils.ts).
   - Server Actions di [`src/features/penagihan/actions.ts`](../src/features/penagihan/actions.ts).
   - Halaman utama `/penagihan` dengan 4 kartu metrik KPI, tab filter klasifikasi, pencarian, dan dialog modals.
   - Halaman kartu piutang `/pelanggan/[id]/piutang` siap cetak fisik (`@media print`) dengan kop resmi.
   - Widget banner penagihan terintegrasi pada Dashboard Manajer dan Penjualan.
   - Tautan pintas "Kartu Piutang" pada halaman detail pelanggan `/pelanggan/[id]`.

### 12.2 Bukti Uji & Regresi Penuh
- **Database Reset & Migrasi:** Bersih tanpa error.
- **SQL Test Suite 07 (`supabase/tests/07_penagihan_piutang.sql`):** 14/14 PASS (TC-71 s.d. TC-83, TC-88).
- **Semua Test SQL Regresi (02, 03, 04, 05, 06, 07):** 100% PASS.
- **Pengujian Konkurensi (`03_konkurensi.ps1` & `06_konkurensi_persetujuan.ps1`):** 70/70 PASS (Bebas deadlock).
- **TypeScript Strict (`npx tsc --noEmit`):** Bersih (0 error).
- **ESLint (`npm run lint`):** Bersih (0 warning, 0 error).
- **Vitest Unit & Integration (`npx vitest run`):** 15 files, 99 tests passed (100% PASS).
- **Next.js Production Build (`npm run build`):** Sukses terkompilasi (0 error).
- **Zero-Leakage Data Finansial:** Kolom rahasia `harga_pokok`, `harga_beli_satuan`, `hpp_satuan`, dan `margin` diverifikasi tidak pernah diekspos pada view `v_tagihan` maupun antarmuka penagihan.

