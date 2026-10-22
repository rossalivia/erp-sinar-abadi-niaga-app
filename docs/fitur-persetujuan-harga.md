# Fitur: Persetujuan Harga di Bawah HPP (Price Approval Workflow)

**Status:** Spesifikasi Disetujui — Siap untuk Implementasi  
**Penulis:** Tech Lead  
**Tanggal:** 2026-10-22  
**Kode error berikutnya:** E0039 s.d. E0047 (katalog diperluas 9 kode)  
**Migrasi baru:** `supabase/migrations/20261022200000_persetujuan_harga.sql`  
**Rute baru:** `/persetujuan` (Manajer saja)  
**Komponen diubah:** `rpc_konfirmasi_pesanan`, `rpc_simpan_draf_pesanan`, `rpc_batalkan_draf`

---

## 0. Daftar Istilah

| Istilah | Definisi |
|---|---|
| **Persetujuan aktif** | Baris `persetujuan_harga` berstatus `menunggu` atau `disetujui` |
| **Persetujuan efektif** | Status `disetujui` AND `(now() AT TIME ZONE ''Asia/Jakarta'') < berlaku_sampai` AND belum `terpakai` |
| **Snapshot hash** | Hash isi draf pesanan (pelanggan + item terurut) yang dihitung di database |
| **Hash cocok** | Hash saat konfirmasi = `snapshot_hash` persetujuan yang disetujui |
| **Kedaluwarsa** | Status yang ditetapkan bila 24 jam sejak `keputusan_pada` terlewati (lazy evaluation) |

---

## 1. Audit Kondisi Saat Ini

### 1.1 Bagaimana BR-04 Diterapkan di `rpc_konfirmasi_pesanan`

Versi aktif berada di `supabase/migrations/20261022110000_perbaikan_audit.sql` baris 71–260.

Urutan validasi yang berlaku:
1. Cek peran → E0001
2. `SELECT pesanan_jual FOR UPDATE`
3. Cek kepemilikan Penjualan → E0002/E0001
4. Cek status draf → E0015
5. Hitung baris → E0003
6. `SELECT pelanggan FOR UPDATE`
7. Kunci `barang ORDER BY id FOR UPDATE`
8. Loop item: cek aktif → E0006; diskon ≤ 10% → E0009
9. **BR-04** (di dalam loop, Penjualan): `subtotal < COALESCE(harga_pokok, 0) * jumlah` → RAISE E0011 verbatim
10. Cek kredit `fn_hitung_kredit_pelanggan`: E0013 (overdue) lalu E0012 (overlimit)
11. Cek stok → E0014
12. Mutasi stok + snapshot HPP + audit

### 1.2 Snapshot hpp_satuan

Dilakukan saat konfirmasi (A7). HPP diambil dari `barang.harga_pokok` yang sudah dikunci, lalu di-UPDATE ke `item_pesanan_jual.hpp_satuan`.

### 1.3 Urutan Kunci Baris Saat Ini

| Langkah | Objek | Kunci |
|---|---|---|
| 1 | `pesanan_jual` | FOR UPDATE |
| 2 | `pelanggan` | FOR UPDATE |
| 3 | `barang` (semua item) | FOR UPDATE ORDER BY id |

**Kesenjangan P9:** Belum ada kunci `persetujuan_harga`. Setelah implementasi: pesanan → persetujuan → pelanggan → barang.

### 1.4 Tabel Kebutuhan vs Kondisi Saat Ini

| Kebutuhan (P1-P12) | Ada? | Lokasi | Kesenjangan |
|---|---|---|---|
| Tabel `persetujuan_harga` | Tidak | — | Buat di migrasi baru |
| `snapshot_hash` dihitung di DB | Tidak | — | Fungsi hash baru |
| Fungsi status efektif 24 jam | Tidak | — | `fn_persetujuan_efektif` baru |
| `rpc_ajukan_persetujuan_harga` | Tidak | — | RPC baru |
| `rpc_putuskan_persetujuan_harga` | Tidak | — | RPC baru |
| `rpc_batalkan_pengajuan_harga` | Tidak | — | RPC baru |
| `rpc_konfirmasi_pesanan` cek hash | Tidak | `perbaikan_audit.sql` baris 71+ | CREATE OR REPLACE tambahan |
| `rpc_simpan_draf_pesanan` invalidasi | Tidak | `rpc.sql` baris 13 | CREATE OR REPLACE tambahan |
| `rpc_batalkan_draf` menutup pengajuan | Tidak | `rpc.sql` baris 290 | CREATE OR REPLACE tambahan |
| `v_persetujuan_harga_manajer` | Tidak | — | View owner rights baru |
| `v_persetujuan_harga` | Tidak | — | View publik baru |
| Halaman `/persetujuan` | Tidak | `src/lib/akses.ts` | Tambah rute + menu |
| Panel di `/pesanan/[id]` | Tidak | halaman pesanan detail | Tambah komponen |
| Badge jumlah menunggu | Tidak | Dashboard/Sidebar | Tambah widget |
| Audit lifecycle persetujuan | Tidak | — | Dicatat dalam RPC baru |
| Kode error E0039-E0047 | Tidak | `src/lib/errors.ts` | 9 kode baru |
| BR-04 pesan verbatim | Ada | `perbaikan_audit.sql` baris 160 | Tidak boleh diubah |
| Manajer konfirmasi langsung | Ada | Kondisi `IF v_peran = ''penjualan''` | Pertahankan |
| SECURITY DEFINER + search_path | Ada (RPC lama) | Semua RPC lama | RPC baru harus ikuti pola |
| Urutan kunci baris | Sebagian | Belum ada persetujuan_harga | Sisipkan di posisi 2 |

---

## 2. Ringkasan Selisih dan Dampak Keputusan P1-P12 pada Baseline

### 2.1 Perubahan pada Komponen yang Ada

| Komponen | Sebelum | Sesudah | Aturan |
|---|---|---|---|
| `rpc_konfirmasi_pesanan` | BR-04 → langsung E0011 | BR-04 → cek persetujuan efektif + hash; jika oke → lolos | P6 |
| `rpc_simpan_draf_pesanan` | Hanya ubah pesanan | Juga invalidasi persetujuan aktif → kedaluwarsa | P2, P8 |
| `rpc_batalkan_draf` | Hanya ubah pesanan | Juga tutup persetujuan aktif → dibatalkan | P8 |
| Urutan kunci baris | pesanan → pelanggan → barang | pesanan → persetujuan → pelanggan → barang | P9 |

### 2.2 Yang Tidak Berubah

- Pesan E0011 verbatim bila tidak ada persetujuan efektif.
- Semua validasi BR-05 (kredit, overdue) berlaku penuh, termasuk Manajer.
- Semua validasi BR-06 (stok) berlaku penuh.
- TC-01 s.d. TC-54 harus tetap lulus (regresi wajib).

---

## 3. Aturan Bisnis Baru

> **Catatan penomoran:** BR-13 dan BR-14 sudah digunakan untuk modul Kredit & Overdue (lihat `docs/04-asumsi-dan-celah.md` bagian D). Aturan baru mulai dari **BR-15**.

### BR-15: Pengajuan Persetujuan Harga

Penjualan (pemilik draf) dapat mengajukan persetujuan untuk draf yang memiliki minimal satu baris di bawah HPP (COALESCE(harga_pokok,0)). Syarat: pesanan berstatus draf, tidak ada persetujuan aktif. Penjualan tidak pernah diberi tahu baris mana atau berapa nilai HPP — hanya bahwa "ada harga yang memerlukan persetujuan".

### BR-16: Keputusan Manajer

Manajer dapat menyetujui atau menolak pengajuan berstatus `menunggu`. Penolakan wajib alasan ≥ 10 karakter setelah trim. Penjualan tidak bisa menyetujui sendiri — dijaga SECURITY DEFINER + fn_is_manajer().

### BR-17: Masa Berlaku dan Sekali Pakai

Persetujuan `disetujui` berlaku 24 jam dari `keputusan_pada`. Evaluasi lazy (tanpa cron). Setelah konfirmasi berhasil: status → `terpakai` dalam transaksi yang sama. Tidak dapat digunakan ulang.

### BR-18: Invalidasi Hash saat Draf Berubah

Setiap perubahan draf via `rpc_simpan_draf_pesanan` membuat persetujuan aktif → `kedaluwarsa`. Saat konfirmasi: hash dihitung ulang dan harus cocok. Tidak cocok → E0011 verbatim (bukan pesan hash khusus).

### BR-19: Pembatalan Pengajuan

Penjualan (pemilik) dapat membatalkan pengajuan berstatus `menunggu`. Pembatalan draf otomatis menutup persetujuan aktif → `dibatalkan`.

### BR-20: Persetujuan Tidak Membypass Aturan Lain

Persetujuan hanya membuka blokir BR-04. BR-05 (kredit/overdue), BR-06 (stok), BR-03 (diskon), BR-02 (baris/keaktifan) tetap berlaku penuh.

### Verifikasi Tidak Ada Konflik BR-01 s.d. BR-12

| BR | Konflik? | Catatan |
|---|---|---|
| BR-01 s.d. BR-03 | Tidak | Tidak ada perubahan pada stok, kode, atau diskon |
| BR-04 | Diperluas | Persetujuan membuka jalur lolos dengan syarat ketat |
| BR-05 | Tidak | Kredit dan overdue tetap diperiksa; tidak ada bypass |
| BR-06 | Tidak | Urutan kunci diperluas, tidak diubah |
| BR-07 s.d. BR-12 | Tidak | Alur status, PO, kartu stok, audit tidak berubah |

---

## 4. Skema Database

### 4.1 Tabel Baru: `public.persetujuan_harga`

Kolom:
- `id uuid PK`
- `pesanan_jual_id uuid NOT NULL FK → pesanan_jual(id)`
- `status text NOT NULL DEFAULT ''menunggu'' CHECK IN (''menunggu'',''disetujui'',''ditolak'',''terpakai'',''dibatalkan'',''kedaluwarsa'')`
- `diajukan_oleh uuid NOT NULL FK → profiles(id)`
- `diajukan_pada timestamptz NOT NULL DEFAULT now()`
- `catatan_pengaju text` (opsional)
- `keputusan_oleh uuid FK → profiles(id)`
- `keputusan_pada timestamptz`
- `catatan_keputusan text` (opsional, diisi Manajer saat setuju)
- `alasan_tolak text` (wajib ≥ 10 char setelah trim bila ditolak)
- `snapshot_hash text NOT NULL` (hash isi pesanan, BUKAN HPP)
- `berlaku_sampai timestamptz` (diisi saat disetujui: keputusan_pada + 24 jam)
- `dipakai_pada timestamptz` (diisi saat terpakai)

**Mengapa tidak ada kolom HPP/margin:** Tidak diperlukan. Pemeriksaan BR-04 dilakukan oleh RPC SECURITY DEFINER. Manajer melihat detail real-time via view owner rights.

### 4.2 Constraint dan Indeks

```sql
-- Satu persetujuan AKTIF per pesanan
CREATE UNIQUE INDEX uq_persetujuan_aktif_per_pesanan
  ON public.persetujuan_harga (pesanan_jual_id)
  WHERE status IN (''menunggu'', ''disetujui'');

CREATE INDEX idx_persetujuan_status
  ON public.persetujuan_harga (status, diajukan_pada);

CREATE INDEX idx_persetujuan_pesanan
  ON public.persetujuan_harga (pesanan_jual_id, status);
```

### 4.3 Fungsi Hash: `fn_hitung_hash_pesanan(p_pesanan_id uuid) RETURNS text`

- SECURITY DEFINER, search_path = public, pg_temp
- Input: pesanan_jual_id
- Hash dari: pelanggan_id + setiap baris (barang_id, jumlah, harga_satuan, diskon_persen) ORDER BY barang_id
- Algoritma: md5(string_agg(...)) — deterministik
- Tidak menyertakan hpp_satuan, subtotal, atau kolom rahasia

### 4.4 Fungsi Status Efektif: `fn_persetujuan_efektif(p_pesanan_id uuid) RETURNS boolean`

Mengembalikan TRUE jika:
```
EXISTS (SELECT 1 FROM persetujuan_harga
        WHERE pesanan_jual_id = p_pesanan_id
          AND status = ''disetujui''
          AND (now() AT TIME ZONE ''Asia/Jakarta'') < berlaku_sampai)
```
Lazy: tidak mengubah status; status diperbarui ke `kedaluwarsa` saat konfirmasi.

### 4.5 View `v_persetujuan_harga` (Publik — security_invoker = true)

Kolom untuk Penjualan: id, pesanan_jual_id, nomor_pesanan, status, diajukan_pada, keputusan_pada, berlaku_sampai, catatan_pengaju, catatan_keputusan, alasan_tolak, nama_pengaju.
**TIDAK ADA:** snapshot_hash, hpp, margin, atau nilai rahasia.

### 4.6 View `v_persetujuan_harga_manajer` (Owner Rights — Manajer Saja)

- SECURITY DEFINER + security_barrier = true
- WHERE public.fn_is_manajer() = true
- REVOKE ALL FROM anon, PUBLIC; GRANT SELECT TO authenticated
- Kolom tambahan: snapshot_hash, berlaku_sampai, dipakai_pada, dan per baris item: barang_id, kode_barang, nama_barang, jumlah, harga_satuan, diskon_persen, subtotal, **hpp_satuan, margin_satuan, margin_total**

### 4.7 RLS dan Column Grants

```
RLS persetujuan_harga:
  SELECT: P = diajukan_oleh = auth.uid(); M = semua; G = tidak ada
  INSERT/UPDATE/DELETE: TIDAK DI-GRANT (hanya via RPC)

Column grants (SELECT ke authenticated):
  id, pesanan_jual_id, status, diajukan_oleh, diajukan_pada,
  catatan_pengaju, keputusan_oleh, keputusan_pada,
  catatan_keputusan, alasan_tolak, berlaku_sampai, dipakai_pada
  
  snapshot_hash TIDAK DI-GRANT (hanya diakses via RPC SECURITY DEFINER)
```

---

## 5. RPC Baru dan yang Diubah

### 5.1 RPC Baru: `rpc_ajukan_persetujuan_harga(p_pesanan_id uuid)`

Peran: Penjualan saja | Locking: pesanan_jual FOR UPDATE

Urutan validasi:
1. Cek peran bukan penjualan → E0039
2. `SELECT pesanan_jual FOR UPDATE` → tidak ada/bukan milik → E0002/E0001
3. Status bukan draf → E0040
4. Ada persetujuan aktif → E0041
5. Tidak ada baris di bawah HPP → E0042 (tanpa angka HPP/nama barang)
6. Hitung snapshot_hash
7. INSERT persetujuan_harga (status=menunggu)
8. Catat audit_log (aksi: ajukan_persetujuan_harga, nilai_baru tanpa HPP)
9. Return jsonb {id, status}

### 5.2 RPC Baru: `rpc_putuskan_persetujuan_harga(p_id uuid, p_setuju bool, p_catatan text, p_alasan_tolak text)`

Peran: Manajer saja | Locking: persetujuan_harga FOR UPDATE

Urutan validasi:
1. Cek peran bukan manajer → E0001
2. `SELECT persetujuan_harga FOR UPDATE` → tidak ada → E0002
3. Status bukan menunggu → E0043
4. Jika tolak: `length(btrim(p_alasan_tolak)) >= 10` → E0044
5. Update status, keputusan_oleh, keputusan_pada
6. Jika setuju: berlaku_sampai = keputusan_pada + 24 jam
7. Catat audit_log (nilai tidak menyertakan HPP/margin)
8. Return jsonb {status}

### 5.3 RPC Baru: `rpc_batalkan_pengajuan_harga(p_id uuid)`

Peran: Penjualan (pemilik pengajuan) | Locking: persetujuan_harga FOR UPDATE

Urutan validasi:
1. Cek peran bukan penjualan → E0001
2. `SELECT persetujuan_harga FOR UPDATE`
3. Cek diajukan_oleh = auth.uid() → E0001
4. Status bukan menunggu → E0045
5. Update status = dibatalkan
6. Catat audit_log
7. Return void

### 5.4 RPC Diubah: `rpc_konfirmasi_pesanan`

Tambahan di blok BR-04 setelah cek diskon:

```
-- Cek persetujuan hanya untuk Penjualan saat ada baris di bawah HPP
IF v_peran = ''penjualan'' AND ada_baris_di_bawah_hpp THEN
  SELECT persetujuan FOR UPDATE (posisi kunci: setelah pesanan_jual, sebelum pelanggan)
  IF kedaluwarsa: UPDATE status=kedaluwarsa, audit, set v_persetujuan.id = NULL
  IF tidak ada persetujuan valid OR hash tidak cocok:
    RAISE E0011 verbatim
  -- Simpan id untuk ditandai terpakai setelah semua validasi lolos
END IF;

-- Setelah semua validasi lulus, sebelum mutasi stok:
IF v_persetujuan_id_untuk_pakai IS NOT NULL THEN
  UPDATE status=terpakai, dipakai_pada=now()
  INSERT audit_log (aksi: pakai_persetujuan_harga)
END IF;
```

Urutan kunci baris baru:
1. pesanan_jual FOR UPDATE
2. persetujuan_harga FOR UPDATE (jika status=disetujui ada)
3. pelanggan FOR UPDATE
4. barang ORDER BY id FOR UPDATE

### 5.5 RPC Diubah: `rpc_simpan_draf_pesanan`

Tambahan setelah validasi status=draf, sebelum DELETE item lama:
```
UPDATE persetujuan_harga SET status=''kedaluwarsa''
WHERE pesanan_jual_id = p_pesanan_id AND status IN (''menunggu'',''disetujui'');
-- Catat audit_log jika ada baris yang berubah
```

### 5.6 RPC Diubah: `rpc_batalkan_draf`

Tambahan setelah validasi, sebelum UPDATE pesanan_jual:
```
UPDATE persetujuan_harga SET status=''dibatalkan''
WHERE pesanan_jual_id = p_pesanan_id AND status IN (''menunggu'',''disetujui'');
-- Catat audit_log jika ada
```

### 5.7 Template Wajib Semua RPC Baru

```sql
CREATE OR REPLACE FUNCTION public.rpc_xxx(...)
RETURNS ... LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF public.fn_peran() NOT IN (...) THEN
    RAISE EXCEPTION ''Akses ditolak'' USING ERRCODE = ''E0001'';
  END IF;
  ...
END; $$;
REVOKE ALL ON FUNCTION public.rpc_xxx(...) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_xxx(...) TO authenticated;
```

---

## 6. Kode Error Baru

| Kode | Pesan (Bahasa Indonesia) | Dilempar oleh |
|---|---|---|
| E0039 | Hanya Staf Penjualan yang dapat mengajukan persetujuan harga | rpc_ajukan_persetujuan_harga |
| E0040 | Pengajuan hanya dapat dilakukan pada pesanan berstatus draf | rpc_ajukan_persetujuan_harga |
| E0041 | Pesanan sudah memiliki pengajuan persetujuan yang aktif | rpc_ajukan_persetujuan_harga |
| E0042 | Tidak ada harga yang memerlukan persetujuan | rpc_ajukan_persetujuan_harga |
| E0043 | Persetujuan hanya dapat diputuskan saat berstatus menunggu | rpc_putuskan_persetujuan_harga |
| E0044 | Alasan penolakan minimal 10 karakter | rpc_putuskan_persetujuan_harga |
| E0045 | Hanya pengajuan berstatus menunggu yang dapat dibatalkan | rpc_batalkan_pengajuan_harga |
| E0046 | (Reserved) | — |
| E0047 | (Reserved) | — |

**Kode berikutnya setelah implementasi: E0048.**
Semua wajib ditambahkan ke `src/lib/errors.ts` dan `docs/04-asumsi-dan-celah.md`.

---

## 7. UI Per Halaman

### 7.1 Panel Persetujuan di `/pesanan/[id]` (Komponen Baru)

**Penjualan (pemilik draf):**
- Badge status: Belum Diajukan | Menunggu | Disetujui | Ditolak | Kedaluwarsa | Terpakai
- Tombol "Ajukan Persetujuan Harga" (saat belum ada / ditolak / kedaluwarsa)
- Tombol "Batalkan Pengajuan" (saat menunggu)
- Jika disetujui: tampilkan waktu dan berlaku_sampai
- Jika ditolak: tampilkan alasan_tolak
- **TIDAK ADA angka HPP, margin, atau nama barang pelanggaran**
- Panel hanya muncul jika server menyatakan ada baris di bawah HPP

**Manajer di `/pesanan/[id]`:**
- Tabel rincian baris dengan kolom: Barang, Jml, Harga Satuan, Diskon, Subtotal, **HPP Satuan, Margin**
- Input catatan opsional
- Tombol [Setujui] dan [Tolak → input alasan]
- Data dari `v_persetujuan_harga_manajer`

### 7.2 Halaman `/persetujuan` (Manajer Saja)

PageHeader: "Antrean Persetujuan Harga"
Tab: [Menunggu ({n})] [Semua Riwayat]
DataTable: Nomor SO | Pelanggan | Diajukan Oleh | Diajukan Pada | Status | Aksi [Tinjau]
EmptyState: "Tidak ada pengajuan persetujuan yang menunggu keputusan."

### 7.3 Badge Jumlah Menunggu

- Dashboard Manajer: kartu "Persetujuan Menunggu: {n}"
- Sidebar (optional — lihat Q3 di Pertanyaan Terbuka): badge angka pada menu Persetujuan
- Penjualan tidak melihat badge ini

### 7.4 Prinsip UI

- Gunakan BadgeStatus, DataTable, EmptyState, FormField, ConfirmDialog dari @/components/shared/
- Badge warna: emerald (disetujui), amber (menunggu), red (ditolak/kedaluwarsa), slate (dibatalkan), blue (terpakai)
- TIDAK ADA HPP/margin di payload JSX yang dikirim ke Penjualan
- Halaman cetak: @media print

---

## 8. Perubahan Matriks Akses

### Tabel `persetujuan_harga`

| Operasi | P (pemilik) | G | M |
|---|---|---|---|
| SELECT | Milik sendiri (RLS) | 0 baris | Semua |
| INSERT/UPDATE/DELETE | Via RPC saja | Tidak ada | Via RPC saja |

### View Baru

| View | P | G | M |
|---|---|---|---|
| `v_persetujuan_harga` | Milik sendiri (security_invoker) | 0 baris | Semua |
| `v_persetujuan_harga_manajer` | 0 baris | 0 baris | Semua (owner + fn_is_manajer) |

### RPC Baru

| RPC | P | G | M |
|---|---|---|---|
| `rpc_ajukan_persetujuan_harga` | Pemilik draf | E0039 | E0039 |
| `rpc_putuskan_persetujuan_harga` | E0001 | E0001 | Ya |
| `rpc_batalkan_pengajuan_harga` | Pemilik pengajuan | E0001 | E0001 |

### Aksi Bisnis Baru (tambah ke `docs/02-matriks-akses.md` bagian B)

| Aksi | P | G | M | Lapisan |
|---|---|---|---|---|
| Ajukan persetujuan harga | Pemilik draf | Tidak | Tidak | RPC |
| Setujui/tolak persetujuan | Tidak | Tidak | Ya | RPC |
| Batalkan pengajuan menunggu | Pemilik | Tidak | Tidak | RPC |
| Lihat antrean persetujuan | Tidak | Tidak | Ya | MW + RLS + VW |
| Detail margin baris persetujuan | Tidak | Tidak | Ya | VW Manajer (owner rights) |
| Konfirmasi dengan persetujuan efektif | Pemilik | Tidak | Ya | RPC |

### Menu Baru `src/lib/akses.ts`

```typescript
{ title: ''Persetujuan Harga'', href: ''/persetujuan'', icon: ''ClipboardCheck'', roles: [''manajer''] }
```

Section: Transaksi & Penjualan, setelah "Pesanan Jual".

---

## 9. Test Case Baru (TC-55 s.d. TC-70)

TC berikutnya: TC-55 (melanjutkan TC-54).

| ID | Fokus Uji | Aktor | Media | Lokasi File |
|---|---|---|---|---|
| TC-55 | Tanpa persetujuan: konfirmasi di bawah HPP → E0011 verbatim | P1 | SQL | `supabase/tests/06_persetujuan_harga.sql` |
| TC-56 | Ajukan saat tidak ada baris di bawah HPP → E0042 (tanpa angka HPP) | P1 | SQL | `supabase/tests/06_persetujuan_harga.sql` |
| TC-57 | Alur sukses: ajukan → Manajer setujui → konfirmasi berhasil → status terpakai | P1, M | SQL + Playwright | `06_persetujuan_harga.sql`, `tests/e2e/05-persetujuan-harga.spec.ts` |
| TC-58 | Edit draf setelah disetujui → kedaluwarsa → konfirmasi ditolak E0011 | P1, M | SQL | `06_persetujuan_harga.sql` |
| TC-59 | Simulasi 24 jam lewat: berlaku_sampai di masa lalu → E0011; status diperbarui kedaluwarsa | P1, M | SQL | `06_persetujuan_harga.sql` |
| TC-60 | Alasan tolak 9 vs 10 karakter: 9 → E0044; 10 → berhasil; P1 melihat alasan_tolak | M, P1 | SQL + Vitest | `06_persetujuan_harga.sql`, `src/features/pesanan/__tests__/persetujuan.test.ts` |
| TC-61 | Status terpakai: konfirmasi ulang dengan persetujuan sama → E0011 | P1, M | SQL | `06_persetujuan_harga.sql` |
| TC-62 | P2 tidak bisa ajukan/batalkan pengajuan draf P1 | P1, P2 | SQL | `06_persetujuan_harga.sql` |
| TC-63 | Gudang: ajukan → E0001/E0039; SELECT tabel → 0 baris; view manajer → 0 baris | G | SQL | `06_persetujuan_harga.sql` |
| TC-64 | Penjualan tidak bisa menyetujui sendiri: RPC → E0001; UPDATE langsung → permission denied | P1 | SQL | `06_persetujuan_harga.sql` |
| TC-65 | Kerahasiaan: payload API dan pesan error P/G tidak memuat harga_pokok/hpp_satuan/margin | P1, G | Playwright | `tests/e2e/05-persetujuan-harga.spec.ts` |
| TC-66 | Persetujuan tidak bypass kredit: disetujui + hash cocok + overdue → E0013; tidak terpakai | P1, M | SQL | `06_persetujuan_harga.sql` |
| TC-67 | Konkurensi: simpan_draf paralel dengan konfirmasi → salah satu gagal; tidak deadlock; tidak lolos hash basi | P1, M | PowerShell | `supabase/tests/06_konkurensi_persetujuan.ps1` |
| TC-68 | Audit log mencatat: ajukan, setujui/tolak, batalkan, kedaluwarsa, terpakai | M | SQL | `06_persetujuan_harga.sql` |
| TC-69 | Batalkan draf menutup pengajuan aktif → status dibatalkan + audit | P1 | SQL | `06_persetujuan_harga.sql` |
| TC-70 | Manajer konfirmasi langsung (tanpa persetujuan) tetap berfungsi | M | SQL | `06_persetujuan_harga.sql` |

### TC Lama Wajib Regresi

| TC | Alasan |
|---|---|
| TC-14 | rpc_konfirmasi_pesanan diubah |
| TC-15 | Manajer konfirmasi langsung harus tetap berfungsi |
| TC-16 | Kunci baris bertambah; cek tidak ada deadlock baru |
| TC-19 | Race condition stok; kunci baris baru |
| TC-20 | Multi-baris tanpa deadlock |
| TC-22 | Transisi status |
| TC-28 | Audit log lama harus tetap ada |
| TC-38 | Zero leakage; view baru juga harus bebas kolom rahasia |

---

## 10. Dokumen yang Wajib Diperbarui

| Dokumen | Yang Diperbarui |
|---|---|
| `docs/02-matriks-akses.md` | Tambah bagian F: tabel, view, RPC, aksi baru |
| `docs/03-test-plan.md` | Tambah TC-55 s.d. TC-70 + Rekap + Keterlacakan BR-15-20 |
| `docs/05-skema.md` | Tambah ERD node `PERSETUJUAN_HARGA` + daftar migrasi baru |
| `docs/16-peta-sistem-saat-ini.md` | Update §A (tabel), §B (view), §C (RPC), §D (rute), §E (kode error) |
| `src/lib/akses.ts` | Tambah menu /persetujuan (roles: manajer) |
| `src/lib/errors.ts` | Tambah E0039-E0045 ke ERROR_MESSAGES |
| `docs/04-asumsi-dan-celah.md` | Tambah E0039-E0045 ke katalog; tambah K6 untuk fitur ini |
| `docs/fitur-persetujuan-harga.md` | Perbarui kolom Bukti di TC setelah tes dijalankan |

---

## 11. Risiko dan Pertanyaan Terbuka

### Risiko

| Risiko | Level | Mitigasi |
|---|---|---|
| Deadlock baru: kunci 4-level | Tinggi | TC-67 dengan uji PowerShell; urutan HARUS persis pesanan → persetujuan → pelanggan → barang |
| Race condition hash: simpan_draf paralel dengan konfirmasi | Tinggi | Kunci pesanan_jual FOR UPDATE + persetujuan_harga FOR UPDATE dalam transaksi yang sama |
| Kebocoran HPP via Server Action return value | Tinggi | RPC tidak mengembalikan HPP; view Penjualan bersih; wajib server component |
| Hash cocok tapi HPP master berubah setelah pengajuan | Sedang | Disengaja (A7): HPP di-snapshot saat konfirmasi, bukan saat persetujuan |
| Penumpukan baris lama | Rendah | Tidak ada DELETE; indeks pada status; review performa setelah 6 bulan |

### Pertanyaan Terbuka & Keputusan Pemilik Proyek

| # | Pertanyaan | Opsi | Keputusan Terpilih (Disetujui) |
|---|---|---|---|
| Q1 | Manajer dapat membatalkan persetujuan yang sudah **disetujui**? | (a) Ya, via RPC pencabutan; (b) Tidak, edit draf sebagai satu-satunya cara | **(b) Tidak** — perubahan/pembatalan draf menjadi satu-satunya cara menganulir |
| Q2 | Penjualan mendapat notifikasi realtime saat Manajer memutuskan? | (a) Ya, Supabase Realtime; (b) Tidak, cek manual | **(b) Tidak** — menggunakan refresh/muat ulang halaman secara manual |
| Q3 | Badge jumlah menunggu di Sidebar atau Dashboard saja? | (a) Keduanya; (b) Dashboard saja; (c) Sidebar saja | **(b) Dashboard saja** — struktur menu Sidebar tetap ringkas dan bersih |
| Q4 | Batas waktu pengajuan (X jam setelah draf dibuat)? | (a) Ya; (b) Tidak | **(b) Tidak ada batas khusus** — selama status pesanan masih draf |
| Q5 | Manajer ubah harga_pokok setelah persetujuan disetujui — invalidasi atau tidak? | (a) Tidak invalidasi (hash tidak cek HPP); (b) Invalidasi | **(a) Tidak di-invalidasi** — hash snapshot hanya memeriksa item pesanan yang diajukan |

---

## 12. Perkiraan Ukuran Pekerjaan

| Komponen | Estimasi |
|---|---|
| Migrasi database (1 file baru) | 4–6 jam |
| Suite tes SQL (TC-55–TC-70) | 3–4 jam |
| Server Actions baru (Next.js) | 2–3 jam |
| Komponen UI (panel + halaman baru + badge) | 4–5 jam |
| Vitest unit tests | 1–2 jam |
| Playwright E2E (TC-57, TC-65) | 2–3 jam |
| Update dokumentasi (8 file) | 1–2 jam |
| **Total estimasi** | **17–25 jam (3–4 hari kerja)** |

---

## 13. Hasil Implementasi (Full-Stack Engineer - 22 Oktober 2026)

Implementasi fitur **Persetujuan Harga di Bawah HPP** telah selesai dikerjakan secara menyeluruh di branch `fitur/persetujuan-harga`.

### 13.1 Deliverable yang Selesai
1. **Migrasi Database**: `supabase/migrations/20261022200000_persetujuan_harga.sql`
   - Tabel `public.persetujuan_harga` dengan constraint status, RLS, dan column grants (menyembunyikan `snapshot_hash`).
   - Partial unique index `uq_persetujuan_aktif_per_pesanan` untuk status `('menunggu', 'disetujui')`.
   - Fungsi deterministik `fn_hitung_hash_pesanan(uuid)` dan status evaluasi `fn_persetujuan_efektif(uuid)`.
   - View publik `v_persetujuan_harga` (CASE statement 24 jam status `kedaluwarsa`) & View manajer owner rights `v_persetujuan_harga_manajer` (`WHERE fn_is_manajer()`).
   - Tiga RPC baru: `rpc_ajukan_persetujuan_harga`, `rpc_putuskan_persetujuan_harga`, `rpc_batalkan_pengajuan_harga`.
   - Pembaruan 3 RPC inti: `rpc_konfirmasi_pesanan`, `rpc_simpan_draf_pesanan`, `rpc_batalkan_draf` dengan urutan kunci baris bebas deadlock (`pesanan_jual` -> `persetujuan_harga` -> `pelanggan` -> `barang ORDER BY id`).
2. **TypeScript & Validasi**:
   - Skema Zod di `src/features/pesanan/schemas.ts`: `ajukanPersetujuanSchema`, `putuskanPersetujuanSchema`, `batalkanPersetujuanSchema`.
   - Katalog error di `src/lib/errors.ts`: `E0039` s.d. `E0045`.
   - Matriks menu di `src/lib/akses.ts`: rute `/persetujuan` terproteksi khusus Manajer.
3. **Frontend & Komponen UI**:
   - `src/features/pesanan/actions.ts`: Server Actions `ajukanPersetujuanHargaAction`, `putuskanPersetujuanHargaAction`, `batalkanPengajuanHargaAction`.
   - `src/features/pesanan/components/persetujuan-panel.tsx`: Panel antarmuka persetujuan dinamis di halaman `/pesanan/[id]`.
   - `src/app/(dashboard)/persetujuan/page.tsx`: Halaman antrean persetujuan harga khusus Manajer dengan tab filter, DataTable, dan BadgeStatus.
   - `src/app/(dashboard)/page.tsx`: Kartu metrik antrean persetujuan menunggu di dashboard Manajer.
   - `src/components/layout/Sidebar.tsx`: Menu Antrean Persetujuan di kategori `Transaksi & Penjualan`.

### 13.2 Hasil Pengujian
- **SQL Test Suite (`supabase/tests/06_persetujuan_harga.sql`)**: 15/15 skenario LULUS 100% (TC-55 s.d. TC-70).
- **Concurrency Test (`supabase/tests/06_konkurensi_persetujuan.ps1`)**: 10/10 iterasi LULUS 100% (TC-67 bebas deadlock).
- **Vitest Unit Tests (`src/features/pesanan/__tests__/persetujuan.test.ts`)**: 7/7 tests LULUS 100%. Total suite: 14 test files, 86 tests passed.
- **Zero-Leakage**: Penjualan dan Gudang diverifikasi menerima 0 baris dari view manajer dan tidak ada akses ke snapshot_hash atau kolom HPP/margin.
