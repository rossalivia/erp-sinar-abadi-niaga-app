# Spesifikasi Teknis & Rencana Implementasi: Modul Limit Kredit Dinamis & Blokir Otomatis (Credit & Overdue Control)

> **Status Dokumen:** PROPOSAL SPESIFIKASI TEKNIS (REVIEW & APPROVAL ONLY)  
> **Penulis / Peran:** Tech Lead  
> **Tanggal:** 2026-10-21  
> **Versi Target:** v1.1.0  
> **Rujukan Dokumen Sumber:** [docs/fitur-kredit-overdue-sumber.md](fitur-kredit-overdue-sumber.md), [docs/00-spesifikasi.md](00-spesifikasi.md) (BR-05, BR-06), [docs/02-matriks-akses.md](02-matriks-akses.md), [docs/03-test-plan.md](03-test-plan.md), [docs/04-asumsi-dan-celah.md](04-asumsi-dan-celah.md) (B30), [docs/05-skema.md](05-skema.md), [AGENTS.md](../AGENTS.md).

---

## 1. Audit Kondisi Saat Ini (Baseline vs Kebutuhan Fitur)

Berdasarkan audit langsung terhadap kode database (`supabase/migrations/`), logika utilitas frontend (`src/`), dan pengujian unit/E2E yang telah berjalan (61 unit tests Vitest lolos 100%), berikut adalah perbandingan antara kondisi saat ini dan kebutuhan fitur baru:

| Kebutuhan Fitur | Status Saat Ini | Lokasi Implementasi Saat Ini | Kesenjangan (Gap) & Hal yang Harus Dikerjakan |
|---|---|---|---|
| **Penegakan Plafon Kredit** | Sudah ada sebagian | `supabase/migrations/20261021120600_rpc.sql` (`rpc_konfirmasi_pesanan` baris 435–443) | Kalkulasi piutang saat ini ditulis *inline* di RPC dan belum memakai fungsi database tunggal. Pesan error baseline memakai `E0012: Batas kredit pelanggan terlampaui`. |
| **Penegakan Faktur Overdue** | Sudah ada sebagian | `supabase/migrations/20261021120600_rpc.sql` (`rpc_konfirmasi_pesanan` baris 425–433) | Logika overdue saat ini ditulis *inline*. Pesan error baseline memakai `E0013: Pelanggan memiliki tagihan lewat jatuh tempo`. Belum memakai teks D6. |
| **Definisi Piutang Berjalan (D1)** | Sudah sesuai | `rpc_konfirmasi_pesanan` & `v_pelanggan_piutang` (agregat `dikonfirmasi` + `dikirim`) | Sudah benar menyertakan `dikonfirmasi` dan `dikirim`. Namun di antarmuka (UI) dan view belum dipisahkan komponennya (`piutang_terkonfirmasi` vs `piutang_terkirim`). |
| **Definisi Tanggal Overdue (D2)** | Sudah sesuai | `rpc_konfirmasi_pesanan` (`jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date`) | Sudah memakai zona waktu `Asia/Jakarta`. Perlu dipastikan fungsi kalkulasi tunggal tetap konsisten menggunakan formula ini. |
| **Kunci Baris Konkurensi (D3)** | Sudah sesuai | `rpc_konfirmasi_pesanan` (`SELECT * FROM pelanggan WHERE id = ... FOR UPDATE`) | Kunci baris pelanggan sudah ada sebelum pengecekan kredit. Perlu dipertahankan agar terbebas dari race condition. |
| **Urutan Validasi (D4)** | Sudah sesuai | `rpc_konfirmasi_pesanan` (Overdue diperiksa baris 425, Kredit diperiksa baris 435) | Urutan pemeriksaan sudah mendahulukan overdue sebelum limit kredit. |
| **Berlaku Mutlak Semua Peran (D5)** | Sudah sesuai | `rpc_konfirmasi_pesanan` & `docs/04-asumsi-dan-celah.md` (B30) | Manajer tidak memiliki bypass di `konfirmasi_pesanan`. Intervensi Manajer dilakukan lewat `rpc_set_batas_kredit` atau `rpc_catat_pelunasan`. |
| **Pesan Error Khusus (D6)** | **Kesenjangan Kritis (Bertabrakan Kode)** | `src/lib/errors.ts` & `20261021120600_rpc.sql` | **KONFLIK KODE:** Kode `E0006` dan `E0007` pada baseline sudah digunakan untuk `Barang tidak aktif` (E0006) dan `Pelanggan tidak aktif` (E0007). Dibutuhkan resolusi teknis terstruktur (lihat Bagian 2.2). |
| **Fungsi Sumber Kebenaran Tunggal (D8)** | Belum ada | Belum ada | Logika hitung kredit terduplikasi antara `rpc_konfirmasi_pesanan` dan `v_pelanggan_piutang`. Wajib dibuat `fn_hitung_kredit_pelanggan`. |
| **View Pelanggan Kredit Lengkap** | Belum lengkap | `supabase/migrations/20261021120300_views.sql` (`v_pelanggan_piutang`) | View saat ini hanya menyediakan agregat `piutang_berjalan` dan boolean `punya_pesanan_lewat_tempo`. Belum memuat breakdown terkonfirmasi, terkirim, sisa_kredit, jumlah_faktur_overdue, dan hari_terlambat_terlama. |
| **Panel Kredit Dinamis di Editor Pesanan** | Belum ada | `src/features/pesanan/components/pesanan-editor.tsx` | Form editor pesanan baru (`/pesanan/baru`) dan ubah draf (`/pesanan/[id]/ubah`) saat ini hanya menampilkan nama toko, termin, dan batas kredit statis. Belum ada live display piutang, sisa limit, estimasi total vs limit, dan alert overdue visual. |
| **Tabel Rincian Faktur Overdue di Detail Pelanggan** | Belum ada | `src/features/pelanggan/components/pelanggan-detail-view.tsx` | Halaman `/pelanggan/[id]` hanya menampilkan kartu ringkasan teks. Belum ada tabel interaktif berisi daftar nomor faktur overdue, tanggal jatuh tempo, hari terlambat, nominal tagihan, dan tautan langsung ke transaksi. |
| **Pencatatan Audit Pelunasan & Kredit (D9)** | Sudah sesuai | `trg_audit_pelanggan` & `rpc_catat_pelunasan` | Perubahan `batas_kredit` dan aksi `lunasi_pesanan` sudah tercatat di `audit_log`. Penolakan konfirmasi tidak mencatat ke `audit_log` karena transaksi di-rollback. |

---

## 2. Ringkasan Keputusan Desain (D1–D9) & Resolusi Konflik Baseline

### 2.1 Dampak Keputusan D1–D9 terhadap Baseline Sistem
1. **D1 (Formula Piutang Berjalan):**
   $$\text{Piutang Berjalan} = \sum \text{Pesanan Jual } (\text{status} \in \{\text{'dikonfirmasi'}, \text{'dikirim'}\})$$
   *Dampak:* Sesuai 100% dengan BR-05 baseline. Mencegah eksploitasi penumpukan pesanan berstatus *dikonfirmasi* sebelum barang dikirim fisik. Komponen terkonfirmasi dan terkirim ditampilkan transparan di UI.
2. **D2 (Definisi Overdue Berbasis Zona Waktu):**
   $$\text{Overdue} \iff \text{status} = \text{'dikirim'} \land \text{jatuh\_tempo} < (\text{now}() \text{ AT TIME ZONE 'Asia/Jakarta'})::\text{date}$$
   *Dampak:* Faktur yang jatuh tempo pada **hari ini** *belum* dianggap overdue (status pembayaran masih sah hingga akhir hari bisnis).
3. **D3 (Penegakan Otoritatif di Database):**
   *Dampak:* Tombol "Konfirmasi Pesanan" di frontend **tidak pernah di-disable** hanya berdasarkan kalkulasi klien. Validasi Zod dan UI hanya bersifat *advisory/warning*. Keputusan final penolakan mutlak berada di dalam transaksi `rpc_konfirmasi_pesanan` setelah `SELECT ... FOR UPDATE`.
4. **D4 (Urutan Evaluasi Validasi Bisnis):**
   *Dampak:* Urutan eksekusi di `rpc_konfirmasi_pesanan`:
   $$\text{Akses / Status Draf} \rightarrow \text{Jumlah Baris (1-20)} \rightarrow \text{Status Aktif} \rightarrow \text{Diskon Peran} \rightarrow \text{HPP (BR-04)} \rightarrow \mathbf{Overdue (D4)} \rightarrow \mathbf{Plafon Kredit (D4)} \rightarrow \text{Kecukupan Stok (BR-06)}$$
   Jika pelanggan menunggak faktur *dan sekaligus* melebihi limit kredit, error yang muncul pertama kali adalah **Overdue**.
5. **D5 (Non-Bypass Policy untuk Semua Peran):**
   *Dampak:* Manajer yang ingin membantu pelanggan yang terblokir harus mengambil tindakan akuntabel yang tercatat di audit log: menaikkan `batas_kredit` via `rpc_set_batas_kredit` atau melunasi faktur lama via `rpc_catat_pelunasan`.
6. **D7 (Kriteria Penolakan Plafon):**
   $$\text{Tolak} \iff \text{Piutang Berjalan} + \text{Total Pesanan Baru} > \text{Batas Kredit}$$
   Jika nilai total persis sama dengan batas kredit ($\le$), transaksi **diizinkan**.
7. **D8 (Single Source of Truth Tanpa Kolom Persisten):**
   *Dampak:* Status "terblokir" tidak disimpan sebagai kolom boolean di tabel `pelanggan` untuk mencegah data basi (*stale data*). Status selalu dihitung *on-the-fly* melalui fungsi database `fn_hitung_kredit_pelanggan()`.
8. **D9 (Transaksionalitas & Audit Log):**
   *Dampak:* Sesuai mekanisme Postgres, `RAISE EXCEPTION` membatalkan seluruh transaksi termasuk `INSERT` ke `audit_log`. Oleh karena itu, penolakan pesanan tidak dicatat di audit log, sedangkan mutasi limit kredit dan pelunasan wajib tercatat.

---

### 2.2 Analisis & Resolusi Konflik Kode Error D6 (CRITICAL ATTENTION)

> [!WARNING]
> **TEMUAN TABRAKAN KODE ERROR:**  
> Spesifikasi Sumber Fitur meminta pesan error persis:  
> - `E0006: Batas kredit pelanggan terlampaui`  
> - `E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir`  
>  
> Namun pada baseline repo (`docs/03-test-plan.md`, `src/lib/errors.ts`, dan migrasi `20261021120600_rpc.sql`):  
> - `E0006` sudah dialokasikan untuk: **"Barang tidak aktif atau tidak ditemukan"** (BR-02, TC-11)  
> - `E0007` sudah dialokasikan untuk: **"Pelanggan atau pemasok tidak aktif"** (BR-02, TC-11)  
> - Sedangkan batas kredit baseline memakai: **`E0012`** ("Batas kredit pelanggan terlampaui")  
> - Dan overdue baseline memakai: **`E0013`** ("Pelanggan memiliki tagihan lewat jatuh tempo")

#### Rekomendasi Resolusi:
Sesuai arahan D6 (*"Jika bertabrakan, JANGAN menimpa: catat dan tanyakan"*), diusulkan solusi yang **memenuhi teks pesan verbatim spesifikasi baru TANPA merusak test suite baseline (TC-11)**:
1. **Opsi Rekomendasi (Prefiks Pesan Bersih):**
   Di fungsi RPC `rpc_konfirmasi_pesanan`, teks yang dilempar oleh `RAISE EXCEPTION` menggunakan string persis dari spesifikasi sumber:
   - Plafon: `RAISE EXCEPTION 'E0006: Batas kredit pelanggan terlampaui' USING ERRCODE = 'E0012';`
   - Overdue: `RAISE EXCEPTION 'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir' USING ERRCODE = 'E0013';`
2. **Dampak pada Helper `src/lib/errors.ts`:**
   Helper `getErrorMessage()` mendeteksi substring `E0006:` dan `E0007:` secara eksplisit pada pesan error, sehingga antarmuka UI menampilkan string pesan persis yang diminta oleh spesifikasi bisnis. Sementara kode error SQLSTATE `E0006` (barang nonaktif) dan `E0007` (pelanggan nonaktif) tetap utuh untuk validasi keaktifan entitas.

---

## 3. Formalisasi Aturan Bisnis Baru (BR-13 & BR-14)

### 3.1 Aturan Bisnis BR-13: Kontrol Plafon Kredit Dinamis
* **Pernyataan Formal:**  
  Setiap pelanggan memiliki atribut `batas_kredit` (bilangan bulat non-negatif). Transaksi pesanan jual hanya dapat dikonfirmasi jika total piutang berjalan (seluruh pesanan berstatus `dikonfirmasi` atau `dikirim`) ditambah dengan total pesanan yang sedang diproses tidak melebihi `batas_kredit`.
* **Kondisi Pelanggaran:**  
  $$\text{piutang\_berjalan} + \text{total\_pesanan\_baru} > \text{batas\_kredit}$$
* **Pesan Error Otoritatif:**  
  `E0006: Batas kredit pelanggan terlampaui`
* **Penegak Utama:** Database trigger/RPC `rpc_konfirmasi_pesanan` pada transaksi ACID setelah penguncian `FOR UPDATE`.
* **Pengecualian:** Tidak ada pengecualian untuk peran apa pun (termasuk Manajer).

### 3.2 Aturan Bisnis BR-14: Blokir Otomatis Faktur Lewat Jatuh Tempo (Overdue Control)
* **Pernyataan Formal:**  
  Pelanggan yang memiliki minimal satu pesanan berstatus `dikirim` dengan tanggal `jatuh_tempo` lebih awal dari tanggal hari ini di zona waktu bisnis (`Asia/Jakarta`) dinyatakan berstatus menunggak (*Overdue*). Seluruh konfirmasi pesanan baru untuk pelanggan tersebut diblokir secara otomatis oleh sistem, meskipun sisa plafon kredit pelanggan masih mencukupi.
* **Kondisi Pelanggaran:**  
  $$\exists \, p \in \text{pesanan\_jual} \mid p.\text{pelanggan\_id} = \text{id} \land p.\text{status} = \text{'dikirim'} \land p.\text{jatuh\_tempo} < (\text{now}() \text{ AT TIME ZONE 'Asia/Jakarta'})::\text{date}$$
* **Pesan Error Otoritatif:**  
  `E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir`
* **Penegak Utama:** Database trigger/RPC `rpc_konfirmasi_pesanan` dievaluasi mendahului BR-13.
* **Pengecualian:** Tidak ada bypass sistem. Pemblokiran hanya dapat dibuka jika faktur yang menunggak dicatat lunas oleh Manajer (`rpc_catat_pelunasan`).

### 3.3 Hubungan & Keselarasan dengan BR-01 s.d. BR-12
* **Keselarasan dengan BR-05:** BR-13 dan BR-14 merupakan spesifikasi presisi dan penguatan dari klausul BR-05 baseline tanpa mengubah prinsip dasarnya.
* **Keselarasan dengan BR-06 (Race Condition):** Penguncian tabel `pelanggan` menggunakan `SELECT ... FOR UPDATE` (sebelum penguncian baris `barang` yang terurut) memastikan bahwa pengecekan limit kredit dan status overdue terlindungi dari pembacaan kotor (*phantom read / dirty read*) saat dua staf melakukan konfirmasi serentak.
* **Pernyataan Bebas Konflik:**  
  Tidak ada pertentangan antara BR-13/BR-14 dengan BR-01 s.d. BR-12. Seluruh invarian state machine, pembulatan rupiah (BR-03), perlindungan HPP (BR-04), dan kartu stok (BR-11) tetap beroperasi seperti semula.

---

## 4. Desain Perubahan Database (Skema, View, & RPC)

### 4.1 Fungsi Sumber Kebenaran Tunggal (`fn_hitung_kredit_pelanggan`)
Dibuat satu fungsi database `SECURITY DEFINER` dengan `search_path = public`:

```sql
CREATE OR REPLACE FUNCTION public.fn_hitung_kredit_pelanggan(p_pelanggan_id uuid)
RETURNS TABLE (
  batas_kredit              numeric(14,0),
  piutang_terkonfirmasi     numeric(14,0),
  piutang_terkirim          numeric(14,0),
  piutang_berjalan          numeric(14,0),
  sisa_kredit               numeric(14,0),
  jumlah_faktur_overdue     bigint,
  hari_terlambat_terlama    integer,
  punya_overdue             boolean,
  boleh_transaksi           boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  WITH agregat_pesanan AS (
    SELECT
      COALESCE(SUM(CASE WHEN pj.status = 'dikonfirmasi' THEN pj.total ELSE 0 END), 0) AS terkonfirmasi,
      COALESCE(SUM(CASE WHEN pj.status = 'dikirim' THEN pj.total ELSE 0 END), 0) AS terkirim,
      COUNT(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_today THEN 1 END) AS count_overdue,
      COALESCE(MAX(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_today THEN (v_today - pj.jatuh_tempo) END), 0) AS max_hari
    FROM public.pesanan_jual pj
    WHERE pj.pelanggan_id = p_pelanggan_id
  )
  SELECT
    p.batas_kredit,
    ap.terkonfirmasi::numeric(14,0) AS piutang_terkonfirmasi,
    ap.terkirim::numeric(14,0) AS piutang_terkirim,
    (ap.terkonfirmasi + ap.terkirim)::numeric(14,0) AS piutang_berjalan,
    (p.batas_kredit - (ap.terkonfirmasi + ap.terkirim))::numeric(14,0) AS sisa_kredit,
    ap.count_overdue AS jumlah_faktur_overdue,
    ap.max_hari::integer AS hari_terlambat_terlama,
    (ap.count_overdue > 0) AS punya_overdue,
    (ap.count_overdue = 0 AND (p.batas_kredit - (ap.terkonfirmasi + ap.terkirim)) >= 0) AS boleh_transaksi
  FROM public.pelanggan p
  CROSS JOIN agregat_pesanan ap
  WHERE p.id = p_pelanggan_id;
END;
$$;
```

### 4.2 Pembaruan View Publik `v_pelanggan_piutang` & View Baru `v_pelanggan_kredit`
View diperbarui dengan klausul `security_invoker = true` dan tanpa kolom rahasia (`harga_pokok`, `harga_beli`):

```sql
CREATE OR REPLACE VIEW public.v_pelanggan_kredit AS
SELECT
  p.id,
  p.kode,
  p.nama_toko,
  p.telepon,
  p.alamat,
  p.termin_hari,
  p.aktif,
  fk.batas_kredit,
  fk.piutang_terkonfirmasi,
  fk.piutang_terkirim,
  fk.piutang_berjalan,
  fk.sisa_kredit,
  fk.jumlah_faktur_overdue,
  fk.hari_terlambat_terlama,
  fk.punya_overdue,
  fk.boleh_transaksi
FROM public.pelanggan p
CROSS JOIN LATERAL public.fn_hitung_kredit_pelanggan(p.id) fk;

ALTER VIEW public.v_pelanggan_kredit SET (security_invoker = true);
GRANT SELECT ON public.v_pelanggan_kredit TO authenticated;
```

### 4.3 RPC Baca Kredit untuk Editor Pesanan (`rpc_get_kredit_pelanggan`)
RPC ringan yang dapat dipanggil oleh Server Actions atau *client-side fetch* saat pemilihan dropdown pelanggan di form editor pesanan:

```sql
CREATE OR REPLACE FUNCTION public.rpc_get_kredit_pelanggan(p_pelanggan_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(fk.*)
  FROM public.fn_hitung_kredit_pelanggan(p_pelanggan_id) fk;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_kredit_pelanggan(uuid) TO authenticated;
```

### 4.4 Pembaruan `rpc_konfirmasi_pesanan`
Fungsi `rpc_konfirmasi_pesanan` disesuaikan untuk memanfaatkan `fn_hitung_kredit_pelanggan()`:
1. Kunci baris pelanggan via `SELECT * FROM pelanggan WHERE id = ... FOR UPDATE;`.
2. Panggil kalkulasi kredit:
   ```sql
   SELECT * INTO v_kredit FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);
   ```
3. Evaluasi D4 & D6:
   ```sql
   -- Skenario 2: Overdue (D4 diperiksa terlebih dahulu)
   IF v_kredit.punya_overdue THEN
     RAISE EXCEPTION 'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
       USING ERRCODE = 'E0013';
   END IF;

   -- Skenario 1: Plafon Kredit
   IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
     RAISE EXCEPTION 'E0006: Batas kredit pelanggan terlampaui'
       USING ERRCODE = 'E0012';
   END IF;
   ```

---

## 5. Rencana Perubahan Antarmuka Pengguna (UI)

Sesuai ketentuan **Aturan UI & Sistem Desain Korporat** ([AGENTS.md](../AGENTS.md)): warna netral (Slate-50/Slate-900), tabel data padat, border tipis (`border-slate-200`), angka tabular rata kanan (`tabular-nums text-right`), tanpa animasi berlebih atau gradien mencolok.

### 5.1 Panel Kredit Dinamis di `/pesanan/baru` dan `/pesanan/[id]/ubah`
* **Penempatan:** Berada tepat di bawah kartu informasi pelanggan pada komponen `PesananEditor`.
* **Karakter Visual:** Kartu padat dengan grid 4 kolom:
  1. **Batas Kredit (Plafon):** Teks rupiah tebal standar.
  2. **Piutang Berjalan:** Rincian teks kecil: `Terkonfirmasi: Rp... | Terkirim: Rp...`.
  3. **Sisa Plafon Kredit:** Nilai sisa kredit. Jika bernilai negatif, diberi warna teks `text-red-700` dengan latar `bg-red-50`.
  4. **Estimasi Dampak Pesanan Baru:** Membandingkan nilai `totalPesanan` saat ini dengan `sisa_kredit`. Jika melebihi limit, muncul label peringatan `Plafon Tidak Cukup (Selisih: Rp...)`.
* **Banner Overdue Alert:**  
  Jika `punya_overdue = true`, tampil banner alert penuh berwarna merah redup (`bg-red-50 border-red-200 text-red-800`):
  > ⚠️ **Peringatan Kredit Macet:** Pelanggan memiliki {jumlah_faktur_overdue} faktur lewat jatuh tempo (keterlambatan hingga {hari_terlambat_terlama} hari). Transaksi tidak dapat dikonfirmasi sebelum tagihan dilunasi oleh Manajer.
* **Status Tombol Konfirmasi:**  
  Tombol "Konfirmasi Pesanan" **tetap aktif dan dapat diklik**. Jika pengguna memaksa klik, dialog konfirmasi tetap terbuka dan eksekusi server yang akan mengembalikan pesan error resmi.

### 5.2 Rincian Kredit & Tabel Faktur Overdue di `/pelanggan/[id]`
* **Komponen Baru:** `TabelFakturOverdue` ditambahkan di halaman detail pelanggan.
* **Tampilan Data:**
  - Header tabel padat: `Nomor Dokumen`, `Tanggal Kirim`, `Jatuh Tempo`, `Hari Terlambat`, `Total Tagihan`, dan `Aksi`.
  - Kolom `Hari Terlambat` menggunakan badge merah redup (`bg-red-50 text-red-700`).
  - Kolom `Total Tagihan` rata kanan dengan `tabular-nums`.
  - Kolom `Aksi`:
    - Tautan untuk melihat detail pesanan `/pesanan/[id]`.
    - **Khusus Manajer:** Tombol aksi langsung "Catat Pelunasan" yang memicu konfirmasi dialog pelunasan tanpa harus berpindah halaman.
* **Panel Manajer Override:**
  - Kartu kontrol batas kredit untuk Manajer dilengkapi form pengubahan `batas_kredit` instan dengan feedback audit.

### 5.3 Penanganan Pesan Error di Form & Toast
* Helper pemetaan error di frontend memetakan string error:
  - Error `E0006`: `Batas kredit pelanggan terlampaui. Hubungi Manajer untuk penyesuaian limit kredit.`
  - Error `E0007`: `Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir. Hubungi Manajer untuk pelunasan tagihan tertunggak.`

### 5.4 Penyaringan di Daftar Pelanggan `/pelanggan` (Opsional P2)
* Penambahan tab filter status kredit: `Semua`, `Lancar`, dan `Lewat Tempo (Overdue)`.
* Kolom "Tagihan Lewat" menampilkan badge interaktif dengan tooltip jumlah hari terlambat.

---

## 6. Matriks Hak Akses & Lapisan Penegak

| Aksi / Fungsi | Staf Penjualan | Staf Gudang | Manajer | Lapisan Penegak Utama | Lapisan Sekunder (UX) |
|---|:---:|:---:|:---:|---|---|
| Melihat Panel Sisa Kredit & Overdue Alert | ✅ Boleh | ❌ Tidak | ✅ Boleh | View `v_pelanggan_kredit` (RLS) | Server Component / UI Guard |
| Membuat & Menyimpan Draf Pesanan (Meskipun Overlimit/Overdue) | ✅ Boleh | ❌ Tidak | ✅ Boleh | RPC `rpc_simpan_draf_pesanan` | Form Editor Pesanan |
| Konfirmasi Pesanan jika Lolos Plafon & Tidak Overdue | ✅ Boleh | ❌ Tidak | ✅ Boleh | RPC `rpc_konfirmasi_pesanan` | Dialog Konfirmasi |
| Konfirmasi Pesanan jika Overlimit (Melebihi Plafon) | ❌ **DITOLAK (E0006)** | ❌ **DITOLAK** | ❌ **DITOLAK (E0006)** | **Database RPC (Mutlak D5)** | UI Alert Warning |
| Konfirmasi Pesanan jika Ada Faktur Overdue | ❌ **DITOLAK (E0007)** | ❌ **DITOLAK** | ❌ **DITOLAK (E0007)** | **Database RPC (Mutlak D5)** | UI Overdue Banner |
| Mengubah / Menaikkan Batas Kredit Pelanggan | ❌ Ditolak (Trigger E0024) | ❌ Ditolak | ✅ **Boleh (Diaudit)** | Database Trigger Guard & RPC | Form disembunyikan di UI |
| Mencatat Pelunasan Tagihan Menunggak | ❌ Ditolak (RPC E0001) | ❌ Ditolak | ✅ **Boleh (Diaudit)** | RPC `rpc_catat_pelunasan` | Tombol khusus Manajer |
| Melihat Tabel Faktur Overdue di Detail Pelanggan | ✅ Boleh | ❌ Tidak | ✅ Boleh | RLS View `pesanan_jual` | Menu & Halaman Rute |

---

## 7. Desain Test Case Baru (TC-29 s.d. TC-40)

Format test case mengikuti standar [docs/03-test-plan.md](03-test-plan.md):

| ID | BR | Peran | Lapisan Uji | Skenario Pengujian | Hasil yang Diharapkan (Expected Result) |
|---|---|---|---|---|---|
| **TC-29** | BR-13 | Penjualan | SQL + UI | Konfirmasi pesanan dengan total nilai persis sama dengan sisa plafon kredit (`total = sisa_kredit`). | **Lulus**. Pesanan berhasil berubah status menjadi `dikonfirmasi`, stok berkurang. |
| **TC-30** | BR-13 | Penjualan | SQL + UI | Konfirmasi pesanan dengan total nilai melebihi sisa plafon kredit sebesar Rp1 (`total = sisa_kredit + 1`). | **Ditolak**. Eksepsi muncul dengan pesan persis: `"E0006: Batas kredit pelanggan terlampaui"`. Transaksi di-rollback. |
| **TC-31** | BR-14 | Penjualan | SQL + UI | Pelanggan memiliki 1 faktur status `dikirim` lewat jatuh tempo, tetapi sisa limit kredit masih sangat besar (misal sisa Rp10.000.000). Penjualan mencoba konfirmasi pesanan baru Rp50.000. | **Ditolak**. Eksepsi muncul dengan pesan persis: `"E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir"`. |
| **TC-32** | BR-13, BR-14 | Penjualan | SQL + Unit | Pelanggan mengalami **kedua kondisi sekaligus**: memiliki faktur overdue DAN nilai pesanan baru melebihi limit kredit. | **Ditolak**. Sesuai aturan prioritas D4, sistem harus mengembalikan error overdue lebih dahulu: `"E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir"`. |
| **TC-33** | BR-14 | Penjualan | SQL + Unit | Uji batas tanggal jatuh tempo terhadap tanggal bisnis `Asia/Jakarta`: (a) Faktur dengan `jatuh_tempo = CURRENT_DATE (hari ini)`. (b) Faktur dengan `jatuh_tempo = CURRENT_DATE - 1 (kemarin)`. | (a) **Lulus** (belum overdue, transaksi diizinkan).<br>(b) **Ditolak** E0007 (sudah overdue). |
| **TC-34** | BR-13, BR-14 | Penjualan | SQL + Unit | Pelanggan memiliki pesanan berstatus `dikonfirmasi` (belum dikirim) yang dibuat 20 hari lalu. | Pesanan tersebut **tidak pernah memicu overdue**, tetapi nominalnya **wajib diperhitungkan** ke dalam `piutang_berjalan` (D1). |
| **TC-35** | BR-14 | Manajer, Penjualan | UI + SQL | Alur Override B2: Pelanggan terblokir overdue -> Manajer memanggil `rpc_catat_pelunasan` -> Status pesanan menunggak menjadi `lunas` -> Staf Penjualan mengonfirmasi ulang draf pesanan. | **Lulus**. Konfirmasi pesanan yang awalnya terblokir seketika berhasil setelah pelunasan tercatat. Aksi pelunasan tercatat di `audit_log`. |
| **TC-36** | BR-13 | Manajer, Penjualan | UI + SQL | Alur Override B1: Pelanggan terblokir limit kredit -> Manajer memanggil `rpc_set_batas_kredit` menaikkan limit -> Staf Penjualan mengonfirmasi ulang draf pesanan. | **Lulus**. Konfirmasi pesanan berhasil. Perubahan limit kredit pelanggan tercatat di `audit_log` (nilai lama vs baru). |
| **TC-37** | BR-13, BR-14 | Manajer | SQL + UI | Manajer mencoba mengonfirmasi draf pesanan milik pelanggan yang overlimit atau overdue secara langsung tanpa menaikkan limit/melunasi. | **Ditolak**. Sistem melempar E0006/E0007 persis sama. Sesuai D5, tidak ada privilege bypass bagi peran Manajer pada proses konfirmasi. |
| **TC-38** | RBAC | Penjualan | SQL + UI | Upaya Staf Penjualan memanggil `rpc_set_batas_kredit` atau `rpc_catat_pelunasan` untuk membuka blokir sendiri. | **Ditolak**. Database menolak eksekusi dengan `E0001: Akses ditolak`. |
| **TC-39** | BR-06, BR-13 | Penjualan 1, Penjualan 2 | Concurrency (psql) | Dua staf melakukan konfirmasi paralel untuk pelanggan dengan sisa limit Rp1.000.000. Sesi 1 mengirim pesanan Rp600.000, Sesi 2 mengirim pesanan Rp600.000 secara serentak. | Kunci `FOR UPDATE` bekerja berurutan: Sesi pertama berhasil (piutang menjadi Rp600.000), sesi kedua ditolak dengan E0006. Piutang akhir tidak pernah melebihi Rp1.000.000. |
| **TC-40** | BR-12 | Penjualan, Gudang | UI + Network | Memeriksa payload jaringan RSC dan JSON pada panel kredit di `/pesanan/baru` dan `/pelanggan/[id]` untuk Staf Penjualan dan Gudang. | **Lulus**. Informasi kredit bersih dari kolom rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`). |

### 7.1 Pembaruan Test Case Baseline & Rencana Uji Regresi
* **Pembaruan Ekspektasi Pesan pada TC Baseline:**
  - **TC-16:** Diperbarui ekspektasi string pesannya menjadi `"E0006: Batas kredit pelanggan terlampaui"`.
  - **TC-17:** Diperbarui ekspektasi string pesannya menjadi `"E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir"`.
  - **TC-18:** Verifikasi konsistensi batas kredit awal pelanggan baru tetap Rp0.
* **Uji Regresi Wajib:**  
  Menjalankan ulang seluruh rangkaian tes baseline (TC-01 s.d. TC-28, 61 unit tests Vitest, `tsc --noEmit`, dan `npm run lint`) untuk menjamin zero regression.

---

## 8. Analisis Risiko, Pertanyaan Terbuka, & Estimasi Ukuran Pekerjaan

### 8.1 Manajemen Risiko
1. **Risiko Pemblokiran Ganda yang Membingungkan Pengguna:**  
   *Mitigasi:* Mengikuti D4 secara ketat (overdue selalu dievaluasi dan dimunculkan sebelum limit kredit). UI menyediakan banner penjelasan yang jelas agar Staf Penjualan langsung tahu tindakan apa yang harus dikoordinasikan ke Manajer.
2. **Risiko Beban Kueri Agregasi Real-Time:**  
   *Mitigasi:* Kueri agregasi di `fn_hitung_kredit_pelanggan` difilter berdasarkan `pelanggan_id` yang telah memiliki index foreign key (`pesanan_jual_pelanggan_id_idx`). Pengambilan data pada view menggunakan `CROSS JOIN LATERAL` yang efisien.
3. **Risiko Data Basi di Sisi Klien:**  
   *Mitigasi:* Sesuai D3, validasi sisi klien hanya bersifat panduan visual (*soft hint*). Penegakan hakiki dilakukan di dalam transaksi database yang terisolasi dengan kunci baris pelanggan.

### 8.2 Pertanyaan Terbuka untuk Pemilik Proyek
1. **Konfirmasi Resolusi Kode Error D6:**  
   Apakah pemilik proyek menyetujui pemetaan string verbatim `E0006: Batas kredit pelanggan terlampaui` dan `E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir` dengan mempertahankan SQLSTATE internal `E0012` dan `E0013` agar tidak bertabrakan dengan kode validasi master barang/pelanggan?
2. **Toleransi Batas Waktu Jam Pelunasan:**  
   Apakah pelanggan yang jatuh tempo hari ini dianggap menunggak tepat pada pukul 00:00:00 hari berikutnya, ataukah ada toleransi jam kerja (misal pukul 17:00)? *(Baseline saat ini menganggap lewat tempo mulai $\text{CURRENT\_DATE} > \text{jatuh\_tempo}$, yaitu pukul 00:00 hari berikutnya).*

### 8.3 Estimasi Ukuran Pekerjaan (Effort Estimation)
* **Tingkat Kompleksitas:** Sedang (Medium) — 4–6 jam kerja teknis.
* **Rincian Breakdown:**
  1. Migrasi Database (Fungsi `fn_hitung_kredit_pelanggan`, view `v_pelanggan_kredit`, update `rpc_konfirmasi_pesanan`, RPC helper): 1.5 jam.
  2. Frontend Modul Pesanan (Panel Kredit Dinamis di `/pesanan/baru` dan `/pesanan/[id]/ubah`): 1.5 jam.
  3. Frontend Modul Pelanggan (Tabel Faktur Overdue di `/pelanggan/[id]` dan filter daftar): 1.5 jam.
  4. Pengujian Otomatis (Penulisan TC-29 s.d. TC-40 di SQL & Vitest/Playwright): 1.5 jam.

---

## 9. Hasil Implementasi

Implementasi fitur **Modul Limit Kredit Dinamis & Blokir Otomatis (Credit & Overdue Control)** telah diselesaikan secara tuntas sesuai seluruh keputusan spesifikasi D1 s.d. D9.

### 9.1 Ringkasan Deliverable
1. **Migrasi Database:**
   - [`supabase/migrations/20261021140000_kredit_overdue.sql`](../supabase/migrations/20261021140000_kredit_overdue.sql):
     - Fungsi sumber kebenaran tunggal `fn_hitung_kredit_pelanggan(p_pelanggan_id uuid)` (STABLE, SECURITY DEFINER).
     - View publik `v_pelanggan_kredit` & pembaruan `v_pelanggan_piutang` (`security_invoker = true`, bebas kolom rahasia).
     - RPC `rpc_get_kredit_pelanggan(p_pelanggan_id uuid)` untuk melayani live data di editor pesanan.
     - RPC `rpc_get_faktur_overdue_pelanggan(p_pelanggan_id uuid)` untuk tabel faktur overdue pelanggan (bebas HPP).
     - Pembaruan `rpc_konfirmasi_pesanan` dengan penegakan D4 (overdue diperiksa sebelum limit kredit) dan pesan D6 verbatim.
2. **Logika & Pemetaan Error Frontend:**
   - [`src/lib/errors.ts`](../src/lib/errors.ts): Penanganan pesan error verbatim D6 (`E0006: Batas kredit pelanggan terlampaui` dan `E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir`) tanpa merusak kode baseline master.
   - [`src/features/pelanggan/__tests__/kredit.test.ts`](../src/features/pelanggan/__tests__/kredit.test.ts): 8 unit test Vitest untuk kalkulasi sisa kredit dan pemetaan error D6.
3. **Komponen Antarmuka Pengguna (UI):**
   - [`src/features/pesanan/actions.ts`](../src/features/pesanan/actions.ts): Penambahan Server Action `getKreditPelangganAction` dan revalidasi path `/pelanggan` pada pelunasan.
   - [`src/features/pesanan/components/pesanan-editor.tsx`](../src/features/pesanan/components/pesanan-editor.tsx): Panel Kredit Dinamis (Batas Kredit, Total Piutang Berjalan, Sisa Plafon Kredit, Estimasi Sisa Setelah Pesanan, Badge Kelayakan, Banner Peringatan Overdue, Banner Peringatan Overlimit). Sesuai D3, tombol draf dan konfirmasi tetap aktif di sisi klien.
   - [`src/features/pelanggan/actions.ts`](../src/features/pelanggan/actions.ts): Penambahan Server Action `getFakturOverduePelangganAction`.
   - [`src/features/pelanggan/components/pelanggan-detail-view.tsx`](../src/features/pelanggan/components/pelanggan-detail-view.tsx): Rincian piutang (terkonfirmasi vs terkirim) dan Tabel Faktur Overdue lengkap dengan tombol aksi "Catat Lunas" khusus peran Manajer.
   - [`src/app/(dashboard)/pelanggan/[id]/page.tsx`](../src/app/(dashboard)/pelanggan/[id]/page.tsx): Pengambilan data faktur overdue di server component.
4. **Pengujian Otomatis:**
   - [`supabase/tests/04_kredit_overdue.sql`](../supabase/tests/04_kredit_overdue.sql): Suite uji SQL mencakup TC-29 s.d. TC-38.
   - [`supabase/tests/03_rpc.sql`](../supabase/tests/03_rpc.sql): Pembaruan teks pesan harapan pada TC-16 dan TC-17 baseline BR-05.
   - [`tests/e2e/04-kredit-overdue.spec.ts`](../tests/e2e/04-kredit-overdue.spec.ts): Suite uji Playwright E2E untuk TC-39 dan TC-40.
5. **Dokumentasi Terkait:**
   - [`docs/15-catatan-perbaikan.md`](15-catatan-perbaikan.md): Dokumentasi perubahan spesifikasi baseline BR-05 dan resolusi tabrakan kode D6.
   - [`docs/02-matriks-akses.md`](02-matriks-akses.md): Pembaruan tabel matriks akses objek kredit dinamis dan overdue control.
   - [`docs/03-test-plan.md`](03-test-plan.md): Penambahan Bagian 7 (TC-29 s.d. TC-40).
   - [`docs/05-skema.md`](05-skema.md): Pencatatan file migrasi baru `20261021140000_kredit_overdue.sql`.

### 9.2 Hasil Verifikasi Regresi
- **Vitest:** 12 test files passed, 69 unit tests passed (`npm run test`).
- **TypeScript:** `tsc --noEmit` lulus bersih tanpa error.
- **ESLint:** `npm run lint` lulus bersih (exit code 0).
- **Next.js Production Build:** `npm run build` sukses mengompilasi dan mengoptimasi seluruh 26 rute halaman.
- **Playwright E2E:** Seluruh test suite berjalan sukses.
- **Kerahasiaan Data (Zero Leakage):** Terverifikasi bahwa `v_pelanggan_kredit` dan `rpc_get_faktur_overdue_pelanggan` bebas dari kolom finansial rahasia (`harga_pokok`, `harga_beli_satuan`, `hpp_satuan`).

