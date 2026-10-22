# Spesifikasi Teknis & Rencana Implementasi: Modul Manajemen Stock Opname & Penyesuaian Fisik Gudang (Stock Audit & Adjustment)

> **Status Dokumen:** PROPOSAL SPESIFIKASI TEKNIS (REVIEW & APPROVAL ONLY)  
> **Penulis / Peran:** Tech Lead  
> **Tanggal:** 2026-10-22  
> **Target Rilis:** v1.2.0  
> **Rujukan Dokumen Sumber:** [docs/00-spesifikasi.md](00-spesifikasi.md) (BR-01, BR-11, BR-12), [docs/02-matriks-akses.md](02-matriks-akses.md), [docs/03-test-plan.md](03-test-plan.md), [docs/04-asumsi-dan-celah.md](04-asumsi-dan-celah.md) (B14, B15), [docs/05-skema.md](05-skema.md), [AGENTS.md](../AGENTS.md).

---

## 1. Latar Belakang & Tujuan Bisnis

Dalam operasional harian distributor sembako **CV Sinar Abadi Niaga**, mutasi barang fisik di gudang rentan mengalami perbedaan antara catatan komputer (*book stock*) dengan kondisi fisik di rak gudang (*physical stock*). Selisih ini dapat disebabkan oleh:
1. Barang rusak (*damaged*) atau bocor saat penanganan di rak.
2. Penyusutan alami (*shrinkage*) komoditas curah/timbangan (misal: beras, gula pasir).
3. Selisih hitung saat penerimaan pengiriman atau kesalahan muat saat pengiriman ke pelanggan.
4. Barang hilang atau tidak tercatat.

### Tujuan Utama Fitur:
- **Audit Fisik Berkala**: Memberikan sarana bagi Staf Gudang untuk mencatat hasil inventarisasi fisik riil per rak/barang tanpa mengganggu transaksi berjalan secara prematur.
- **Transparansi Selisih**: Menyajikan kalkulasi selisih secara otomatis dan terperinci (apakah surplus atau defisit) sebelum diajukan.
- **Pemisahan Tugas (*Segregation of Duties*)**: Staf Gudang **hanya berwenang menghitung dan mengajukan**, sedangkan **persetujuan dan eksekusi koreksi stok mutlak menjadi wewenang Manajer**.
- **Audit Trail & Akuntabilitas Penuh**: Setiap perubahan stok akibat opname wajib menghasilkan kartu stok berjenis `penyesuaian` di tabel `mutasi_stok`, menjaga invarian `SUM(mutasi_stok.jumlah) = barang.stok`, serta terekam lengkap di `audit_log`.

---

## 2. Aturan Bisnis & Siklus Status (Business Rules & Lifecycle)

### 2.1 Definisi Siklus Status Sesi Opname

Sesi stock opname memiliki 4 status baku yang dijamin oleh constraint database:
```
           ┌──────────────────────┐
           │        draf          │  (Staf Gudang menginput & revisi hitungan fisik)
           └──────────┬───────────┘
                      │  rpc_ajukan_opname_stok
                      ▼
           ┌──────────────────────┐
           │       diajukan       │  (Terkunci untuk diedit gudang, menunggu telaah Manajer)
           └─────┬──────────┬─────┘
                 │          │
   rpc_setujui...│          │ rpc_batalkan_opname_stok
                 ▼          ▼
┌──────────────────────┐  ┌──────────────────────┐
│      disetujui       │  │      dibatalkan      │  (Selesai / Ditolak / Batal)
│ (Stok terkoreksi DB) │  └──────────────────────┘
└──────────────────────┘
```

| Status | Hak Ubah | Deskripsi Alur Bisnis | Dampak pada Stok Barang |
|---|---|---|---|
| `draf` | Gudang, Manajer | Sesi audit baru dibuat; item barang dimasukkan dan jumlah fisik riil diinput. Jumlah dapat diubah sewaktu-waktu. | **Tidak ada** (stok sistem belum berubah). |
| `diajukan` | Manajer (hanya review) | Staf Gudang telah memfinalisasi penghitungan fisik dan mengirimkannya ke Manajer untuk ditinjau. Form terkunci dari pengeditan. | **Tidak ada** (menunggu persetujuan). |
| `disetujui` | *Final (Read-only)* | Manajer menyetujui hasil audit fisik. Fungsi RPC mengeksekusi koreksi kolom `barang.stok` secara atomik dan mencatat kartu stok `penyesuaian`. | **Stok dikoreksi** sesuai stok fisik riil. |
| `dibatalkan` | *Final (Read-only)* | Sesi dibatalkan oleh Staf Gudang (jika draf) atau ditolak oleh Manajer (jika diajukan) dengan wajib mengisi alasan pembatalan. | **Tidak ada** (stok tetap utuh). |

---

### 2.2 Rumus & Kalkulasi Selisih

1. **Formula Selisih Unit per Item**:
   $$\text{Selisih} = \text{Stok Fisik} - \text{Stok Sistem}$$
   - Jika $\text{Selisih} < 0$: Terjadi **defisit / barang kurang** (misal: sistem 100, fisik 95 $\rightarrow$ selisih $-5$).
   - Jika $\text{Selisih} > 0$: Terjadi **surplus / barang lebih** (misal: sistem 50, fisik 52 $\rightarrow$ selisih $+2$).
   - Jika $\text{Selisih} = 0$: Stok **cocok sempurna** (tidak ada mutasi kartu stok).

2. **Snapshot Stok Sistem**:
   Saat item ditambahkan ke sesi opname, `stok_sistem` di-snapshot dari `barang.stok` pada saat pencatatan. Pada saat Manajer menekan tombol *Setujui*, RPC akan mengunci baris barang (`FOR UPDATE`) untuk memastikan tidak terjadi konflik transaksi konkuren (*race condition*).

3. **Invarian Database (AGENTS.md & B14)**:
   - Nilai `stok_fisik` **tidak boleh bernilai negatif** ($\ge 0$).
   - Untuk setiap baris item dengan $\text{selisih} \neq 0$:
     $$\text{barang.stok}_{\text{baru}} = \text{item.stok\_fisik}$$
     $$\text{mutasi\_stok.jumlah} = \text{item.selisih}$$
     $$\text{mutasi\_stok.stok\_sesudah} = \text{item.stok\_fisik}$$
     $$\text{mutasi\_stok.jenis} = \text{'penyesuaian'}$$

---

### 2.3 Matriks Hak Akses Peran (RBAC Matrix)

| Aksi / Fungsi | Staf Penjualan | Staf Gudang | Manajer | Lapisan Penegak |
|---|:---:|:---:|:---:|---|
| Melihat Daftar & Detail Opname | ❌ Ditolak | ✅ Ya | ✅ Ya | Route Guard & RLS |
| Membuat Sesi Draf Opname | ❌ Ditolak | ✅ Ya | ✅ Ya | RLS & RPC (`rpc_buat_opname_stok`) |
| Mengubah Item / Hitungan Fisik | ❌ Ditolak | ✅ Ya (draf) | ✅ Ya (draf) | RPC (`rpc_ubah_draf_opname`) |
| Mengajukan Sesi ke Manajer | ❌ Ditolak | ✅ Ya | ✅ Ya | RPC (`rpc_ajukan_opname_stok`) |
| **Menyetujui Opname (Koreksi Stok)** | ❌ Ditolak | ❌ **Dilarang Keras** | ✅ **Ya (Khusus Manajer)** | RPC (`rpc_setujui_opname_stok`) & DB Trigger |
| Membatalkan / Menolak Sesi | ❌ Ditolak | ✅ Ya (draf sendiri) | ✅ Ya (draf/diajukan) | RPC (`rpc_batalkan_opname_stok`) |
| Melihat Nilai Finansial Selisih (HPP) | ❌ Ditolak | ❌ **Dilarang (Sensor)** | ✅ **Ya (View Manajer)** | Column-level grants & Views |

---

## 3. Perubahan Skema Basis Data (Database Schema)

Sesuai konvensi penamaan AGENTS.md (snake_case Bahasa Indonesia), dibuat 2 tabel baru, 1 sequence nomor dokumen, 1 view khusus manajer, serta indeks pendukung.

### 3.1 Sequence Nomor Dokumen
```sql
CREATE SEQUENCE IF NOT EXISTS public.seq_opname_stok START 1 INCREMENT 1 NO CYCLE;
```
Format nomor dokumen: `OPN-YYYY-XXXX` (contoh: `OPN-2026-0001`).

---

### 3.2 Tabel `public.opname_stok` (Header Sesi Opname)

```sql
CREATE TABLE public.opname_stok (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor               text          NOT NULL UNIQUE,
  status              text          NOT NULL DEFAULT 'draf'
                                    CHECK (status IN ('draf', 'diajukan', 'disetujui', 'dibatalkan')),
  catatan             text,
  total_item          integer       NOT NULL DEFAULT 0 CHECK (total_item >= 0),
  total_selisih_unit  integer       NOT NULL DEFAULT 0,
  dibuat_oleh         uuid          NOT NULL REFERENCES public.profiles(id),
  dibuat_pada         timestamptz   NOT NULL DEFAULT now(),
  diajukan_pada       timestamptz,
  disetujui_oleh      uuid          REFERENCES public.profiles(id),
  disetujui_pada      timestamptz,
  dibatalkan_oleh     uuid          REFERENCES public.profiles(id),
  dibatalkan_pada     timestamptz,
  alasan_batal        text
);

COMMENT ON TABLE public.opname_stok IS 'Header dokumen sesi stock opname fisik gudang.';
```

---

### 3.3 Tabel `public.item_opname_stok` (Rincian Item Hitung Fisik)

```sql
CREATE TABLE public.item_opname_stok (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_stok_id  uuid          NOT NULL REFERENCES public.opname_stok(id) ON DELETE CASCADE,
  barang_id       uuid          NOT NULL REFERENCES public.barang(id),
  stok_sistem     integer       NOT NULL CHECK (stok_sistem >= 0),
  stok_fisik      integer       NOT NULL CHECK (stok_fisik >= 0),
  selisih         integer       GENERATED ALWAYS AS (stok_fisik - stok_sistem) STORED,
  keterangan      text,
  dibuat_pada     timestamptz   NOT NULL DEFAULT now()
);

-- Indeks unik: 1 barang hanya boleh muncul 1 kali dalam 1 sesi opname
CREATE UNIQUE INDEX uq_item_opname_barang ON public.item_opname_stok (opname_stok_id, barang_id);
CREATE INDEX idx_item_opname_opname_id ON public.item_opname_stok (opname_stok_id);
```

---

### 3.4 View Analisis Selisih Finansial Manajer (`v_opname_stok_manajer`)

Untuk melindungi kerahasiaan `harga_pokok` (HPP) sesuai aturan AGENTS.md Bagian 3, Staf Gudang hanya melihat selisih kuantitas (unit). Estimasi nilai kerugian/keuntungan selisih finansial ($\text{selisih} \times \text{harga\_pokok}$) hanya disajikan melalui view khusus Manajer:

```sql
CREATE OR REPLACE VIEW public.v_opname_stok_manajer AS
SELECT
  o.id,
  o.nomor,
  o.status,
  o.catatan,
  o.total_item,
  o.total_selisih_unit,
  COALESCE(SUM(i.selisih * b.harga_pokok), 0)::numeric(14,0) AS estimasi_nilai_selisih,
  o.dibuat_oleh,
  p_buat.nama_lengkap AS pembuat_nama,
  o.dibuat_pada,
  o.diajukan_pada,
  o.disetujui_oleh,
  p_tuju.nama_lengkap AS penyetuju_nama,
  o.disetujui_pada,
  o.alasan_batal
FROM public.opname_stok o
LEFT JOIN public.item_opname_stok i ON i.opname_stok_id = o.id
LEFT JOIN public.barang b ON b.id = i.barang_id
LEFT JOIN public.profiles p_buat ON p_buat.id = o.dibuat_oleh
LEFT JOIN public.profiles p_tuju ON p_tuju.id = o.disetujui_oleh
GROUP BY o.id, p_buat.nama_lengkap, p_tuju.nama_lengkap;

-- Grant hak akses
REVOKE ALL ON public.v_opname_stok_manajer FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_opname_stok_manajer TO authenticated;
```

---

### 3.5 Kebijakan Row Level Security (RLS)

```sql
ALTER TABLE public.opname_stok ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_opname_stok ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Hanya Gudang dan Manajer (Penjualan dilarang)
CREATE POLICY "opname_stok_select_policy" ON public.opname_stok
  FOR SELECT TO authenticated
  USING (public.fn_is_gudang() OR public.fn_is_manajer());

CREATE POLICY "item_opname_stok_select_policy" ON public.item_opname_stok
  FOR SELECT TO authenticated
  USING (public.fn_is_gudang() OR public.fn_is_manajer());

-- 2. INSERT / UPDATE / DELETE langsung dari klien diblokir (wajib via RPC)
CREATE POLICY "opname_stok_modify_policy" ON public.opname_stok
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "item_opname_stok_modify_policy" ON public.item_opname_stok
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);
```

---

## 4. Rancangan Fungsi Database (PostgreSQL RPC Functions)

Semua mutasi wajib melalui RPC `SECURITY DEFINER` dengan penguncian baris ketat.

### 4.1 Pemetaan Kode Error Baru (`src/lib/errors.ts`)
Dialokasikan kode error baru yang tidak berbenturan dengan baseline:
- `E0031`: *Sesi opname harus berisi minimal 1 item barang*
- `E0032`: *Sesi opname hanya dapat diubah saat berstatus draf*
- `E0033`: *Stok fisik riil tidak boleh bernilai negatif*
- `E0034`: *Sesi opname hanya dapat disetujui atau ditolak pada status diajukan*
- `E0035`: *Barang sudah ada di sesi opname ini*
- `E0036`: *Hanya Manajer yang berwenang menyetujui stock opname*

---

### 4.2 Spesifikasi RPC

#### 1. `rpc_buat_opname_stok(p_catatan text, p_items jsonb, p_langsung_ajukan boolean)`
- **Akses:** Gudang, Manajer.
- **Validasi:**
  - Periksa hak akses (`fn_is_gudang() OR fn_is_manajer()`), raise `E0001` jika tidak berhak.
  - `p_items` array minimal 1 elemen, raise `E0031`.
  - Tidak boleh ada `barang_id` duplikat, raise `E0035`.
  - Setiap item harus memiliki `stok_fisik >= 0`, raise `E0033`.
- **Eksekusi:**
  - Generate nomor: `'OPN-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY') || '-' || lpad(nextval('public.seq_opname_stok')::text, 4, '0')`.
  - Snapshot `stok_sistem` langsung dari tabel `barang`.
  - Insert ke `opname_stok` (status = `diajukan` jika `p_langsung_ajukan = true`, else `draf`).
  - Insert seluruh baris ke `item_opname_stok`.
  - Update `total_item` dan `total_selisih_unit` pada header.
- **Return:** `uuid` (ID sesi opname yang baru dibuat).

---

#### 2. `rpc_ubah_draf_opname(p_id uuid, p_catatan text, p_items jsonb)`
- **Akses:** Gudang (pembuat), Manajer.
- **Validasi:**
  - Kunci baris header: `SELECT * FROM opname_stok WHERE id = p_id FOR UPDATE`.
  - Status wajib `draf`, raise `E0032`.
  - Validasi array item dan non-negatif.
- **Eksekusi:**
  - Hapus item lama: `DELETE FROM item_opname_stok WHERE opname_stok_id = p_id`.
  - Masukkan item baru dengan snapshot `stok_sistem` terkini.
  - Perbarui header `catatan`, `total_item`, dan `total_selisih_unit`.
- **Return:** `void`.

---

#### 3. `rpc_ajukan_opname_stok(p_id uuid)`
- **Akses:** Gudang (pembuat), Manajer.
- **Validasi:**
  - `SELECT * FROM opname_stok WHERE id = p_id FOR UPDATE`.
  - Status harus `draf`, raise `E0032`.
  - Minimal harus ada 1 item terdaftar, raise `E0031`.
- **Eksekusi:**
  - Update status menjadi `diajukan`, `diajukan_pada = now()`.
- **Return:** `void`.

---

#### 4. `rpc_setujui_opname_stok(p_id uuid)` — *CRITICAL ATOMIC FUNCTION*
- **Akses:** **Hanya Manajer** (`fn_is_manajer()`), jika bukan raise `E0036`.
- **Penguncian & Validasi Konkurensi:**
  1. `SELECT * FROM opname_stok WHERE id = p_id FOR UPDATE`.
  2. Status harus `diajukan`, jika tidak raise `E0034`.
  3. Aktifkan bypass trigger guard stok di sesi transaksi lokal:
     `PERFORM set_config('app.mutasi_stok', '1', true);`
- **Eksekusi Koreksi Stok (Loop Item):**
  Untuk setiap item di `item_opname_stok`:
  1. Kunci baris master barang secara berurutan (*prevent deadlock*):
     `SELECT stok, nama, kode FROM public.barang WHERE id = r_item.barang_id FOR UPDATE;`
  2. Hitung selisih terkini:
     $$\Delta = \text{r\_item.stok\_fisik} - \text{v\_barang.stok}$$
  3. Jika $\Delta \neq 0$:
     - Update stok master:
       `UPDATE public.barang SET stok = r_item.stok_fisik, diperbarui_pada = now() WHERE id = r_item.barang_id;`
     - Catat kartu stok `mutasi_stok`:
       ```sql
       INSERT INTO public.mutasi_stok (
         barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh
       ) VALUES (
         r_item.barang_id,
         'penyesuaian',
         Delta,
         r_item.stok_fisik,
         v_opname.nomor,
         COALESCE(r_item.keterangan, 'Stock Opname: penyesuaian fisik rak gudang'),
         auth.uid()
       );
       ```
- **Finalisasi Header & Audit Log:**
  1. `UPDATE opname_stok SET status = 'disetujui', disetujui_oleh = auth.uid(), disetujui_pada = now() WHERE id = p_id;`
  2. Catat riwayat audit:
     ```sql
     INSERT INTO public.audit_log (pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru)
     VALUES (
       auth.uid(),
       'setujui_stock_opname',
       'opname_stok',
       p_id,
       jsonb_build_object('status', 'diajukan'),
       jsonb_build_object('status', 'disetujui', 'nomor', v_opname.nomor, 'total_item', v_opname.total_item)
     );
     ```
- **Return:** `void`.

---

#### 5. `rpc_batalkan_opname_stok(p_id uuid, p_alasan text)`
- **Akses:** Gudang (jika draf), Manajer (jika draf/diajukan).
- **Validasi:**
  - `p_alasan` minimal 10 karakter, raise `E0016`.
  - Status tidak boleh `disetujui` atau `dibatalkan`, raise `E0015`.
- **Eksekusi:**
  - `UPDATE opname_stok SET status = 'dibatalkan', dibatalkan_oleh = auth.uid(), dibatalkan_pada = now(), alasan_batal = p_alasan WHERE id = p_id;`
  - Catat ke `audit_log`.
- **Return:** `void`.

---

## 5. Desain Antarmuka Pengguna (UI & Design System)

Sesuai **AGENTS.md Bagian 6 (Aturan UI & Sistem Desain)**:
- Gaya Enterprise/ERP profesional yang kalem, data-table padat (`text-xs` / `text-sm`, `py-1.5 px-2.5`), border minimalis `border-slate-200`, tanpa gradien mencolok atau glassmorphism.
- Selalu memanfaatkan komponen baku: `AppShell`, `PageHeader`, `DataTable`, `BadgeStatus`, `FormField`, `EmptyState`.

### 5.1 Struktur Halaman & Rute Baru
1. `/stok/opname` (`src/app/(dashboard)/stok/opname/page.tsx`):
   - Daftar riwayat seluruh sesi stock opname dengan filter status (`Semua`, `Draf`, `Diajukan`, `Disetujui`, `Dibatalkan`).
   - Tombol utama di slot kanan atas `PageHeader`: `+ Mulai Sesi Opname` (muncul untuk Gudang & Manajer).
2. `/stok/opname/baru` (`src/app/(dashboard)/stok/opname/baru/page.tsx`):
   - Form input sesi baru: tabel interaktif berisi daftar barang, input angka fisik, dan kalkulasi live selisih.
3. `/stok/opname/[id]` (`src/app/(dashboard)/stok/opname/[id]/page.tsx`):
   - Halaman detail audit: kartu ringkasan dokumen, rincian tabel per item, kolom keterangan penyebab selisih, dan panel aksi persetujuan manajer.

---

### 5.2 Komponen Interaktif & Visual Tokens

#### A. Tabel Input Audit Fisik (Opname Item Editor)
- Kolom tabel:
  1. `No`
  2. `Kode Barang` (`font-mono text-xs font-semibold`)
  3. `Nama Barang & Satuan`
  4. `Stok Sistem` (`tabular-nums text-right text-slate-500`)
  5. `Stok Fisik Riil` (`Input number` padat, `tabular-nums text-right font-medium`)
  6. `Selisih` (Badge dinamis real-time):
     - $\text{Selisih} < 0$: `bg-red-50 text-red-700 border-red-200` (contoh: `-4 karung`)
     - $\text{Selisih} > 0$: `bg-blue-50 text-blue-700 border-blue-200` (contoh: `+2 pouch`)
     - $\text{Selisih} = 0$: `bg-slate-50 text-slate-500 border-slate-200` (`Cocok`)
  7. `Keterangan Selisih` (`Input text` singkat: alasan barang rusak/hilang jika ada selisih)
  8. `Aksi` (Tombol hapus baris item)

#### B. Badge Status Sesi (`BadgeStatus`)
- `draf`: `neutral` (`bg-slate-100 text-slate-700 border-slate-200`)
- `diajukan`: `warning` (`bg-amber-50 text-amber-800 border-amber-200`)
- `disetujui`: `success` (`bg-emerald-50 text-emerald-800 border-emerald-200`)
- `dibatalkan`: `danger` (`bg-red-50 text-red-800 border-red-200`)

#### C. Panel Keputusan Manajer (Khusus Peran Manajer)
Pada rute `/stok/opname/[id]`, jika status adalah `diajukan` dan pengguna aktif adalah **Manajer**:
- Muncul kartu *banner* aksi di bawah header:
  - Ringkasan: "Sesi ini membutuhkan persetujuan Manajer. Menyetujui sesi ini akan langsung mengoreksi stok fisik di database dan mencatat kartu stok penyesuaian."
  - Jika Manajer: Tampil total estimasi selisih nilai finansial HPP.
  - Tombol Aksi:
    - `Tolak Sesi` (merah outline `border-red-300 text-red-700 hover:bg-red-50`, membuka modal input alasan tolak).
    - `Setujui & Perbarui Stok` (primer enterprise `bg-slate-900 text-white hover:bg-slate-800`, membuka modal dialog konfirmasi eksplisit).

---

## 6. Rencana Pengujian (Test Plan TC-41 s.d. TC-48)

Melanjutkan daftar 40 test cases yang sudah ada di `docs/03-test-plan.md`:

| No. TC | Nama Skenario Uji | Peran | Ekspektasi Hasil & Validasi |
|---|---|---|---|
| **TC-41** | Pembuatan draf sesi stock opname oleh Staf Gudang | Gudang | Sesi berhasil dibuat dengan status `draf`, nomor `OPN-YYYY-XXXX` terbit, item tersimpan dengan snapshot `stok_sistem` yang tepat. |
| **TC-42** | Penolakan akses modul opname untuk Staf Penjualan | Penjualan | Route guard memblokir rute `/stok/opname` ke `/tidak-berwenang` (HTTP 403), query RLS mengembalikan 0 baris, RPC ditolak dengan `E0001: Akses ditolak`. |
| **TC-43** | Validasi input item opname & barang unik | Gudang | Memasukkan item dengan stok fisik negatif ditolak (`E0033`). Memasukkan barang duplikat dalam 1 sesi ditolak (`E0035`). |
| **TC-44** | Pengajuan sesi opname ke Manajer | Gudang | Mengajukan draf kosong ditolak (`E0031`). Sesi dengan item valid berpindah status menjadi `diajukan`, form terkunci dari edit gudang (`E0032`). |
| **TC-45** | **Larangan Staf Gudang menyetujui opname sendiri** | Gudang | Memanggil `rpc_setujui_opname_stok` oleh Staf Gudang wajib **ditolak keras** oleh database dengan error `E0036: Hanya Manajer yang berwenang menyetujui stock opname`. |
| **TC-46** | **Persetujuan Manajer & koreksi stok otomatis** | Manajer | Manajer menyetujui sesi `diajukan`: kolom `barang.stok` terkoreksi persis ke nilai `stok_fisik`. Baris `mutasi_stok` berjenis `penyesuaian` terbit dengan delta yang tepat. Invarian `SUM(mutasi) = stok` valid 100%. |
| **TC-47** | Uji pembatalan sesi opname & validasi alasan | Manajer / Gudang | Membatalkan tanpa alasan (< 10 karakter) ditolak (`E0016`). Pembatalan valid mengubah status ke `dibatalkan` dan stok barang sama sekali tidak berubah. |
| **TC-48** | Isolasi kerahasiaan data nilai selisih HPP | Gudang vs Manajer | Staf Gudang memanggil API / view tidak dapat melihat kolom HPP / `estimasi_nilai_selisih`. Manajer dapat melihat total nilai selisih rupiah di view `v_opname_stok_manajer`. |

---

## 7. Rencana Kerja Bertahap (Execution Plan)

Jika spesifikasi ini telah disetujui, pekerjaan akan dibagi menjadi sub-tahap rapi:
1. **Langkah 1 (Database Migration):** Buat file migrasi `supabase/migrations/20261022000000_stock_opname.sql` (Sequence, Tabel, Indeks, RLS, Views, dan 5 Fungsi RPC).
2. **Langkah 2 (Test Suite Database):** Tulis berkas uji SQL `supabase/tests/05_stock_opname.sql` untuk memverifikasi TC-41 s.d. TC-48.
3. **Langkah 3 (Frontend Server Actions & Lib):** Daftarkan kode error di `src/lib/errors.ts`, perbarui izin rute di `src/lib/akses.ts`, dan buat Server Actions di `src/features/stok/actions/opname-actions.ts`.
4. **Langkah 4 (Frontend UI Components):** Bangun halaman `/stok/opname`, `/stok/opname/baru`, dan `/stok/opname/[id]` beserta komponen tabel dan modal persetujuan.
5. **Langkah 5 (Verifikasi E2E & Dokumentasi):** Jalankan pengujian lintas peran dengan akun `gudang@sinarabadi.com` dan `manajer@sinarabadi.com`.

---

> [!IMPORTANT]
> Dokumen spesifikasi di atas telah disusun secara komprehensif dan mematuhi seluruh aturan arsitektur di `AGENTS.md`.  
> Sesuai instruksi, **pengerjaan kode belum dimulai**. Silakan tinjau spesifikasi ini dan beri persetujuan untuk melanjutkan ke tahap implementasi.
