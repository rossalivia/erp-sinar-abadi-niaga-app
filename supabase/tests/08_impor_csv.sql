-- ============================================================
-- 08_impor_csv.sql — Suite Pengujian Otomatis Impor CSV
-- Menguji TC-89 s.d. TC-110 (Lapisan Basis Data & Keamanan)
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

-- Helper UUID Akun Uji
-- 11111111-1111-1111-1111-111111111111 (Penjualan 1)
-- 22222222-2222-2222-2222-222222222222 (Gudang)
-- 33333333-3333-3333-3333-333333333333 (Manajer)

-- ============================================================
-- TC-107: Penolakan Hak Akses Penjualan & Gudang (E0001)
-- ============================================================
-- Skenario A: Penjualan memanggil rpc_impor_barang
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';
DO $$
BEGIN
  PERFORM public.rpc_impor_barang('test.csv', '[{"kode":"BRG-FAIL","nama":"Gagal","satuan":"pcs","harga_jual":1000}]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Penjualan seharusnya ditolak memanggil rpc_impor_barang';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Akses ditolak%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan Akses ditolak: %', SQLERRM;
  END IF;
END $$;

-- Skenario B: Gudang memanggil rpc_impor_pelanggan
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222"}';
DO $$
BEGIN
  PERFORM public.rpc_impor_pelanggan('test.csv', '[{"kode":"PLG-FAIL","nama_toko":"Gagal"}]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Gudang seharusnya ditolak memanggil rpc_impor_pelanggan';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Akses ditolak%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan Akses ditolak: %', SQLERRM;
  END IF;
END $$;

-- Switch ke Sesi Manajer
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333"}';

-- ============================================================
-- TC-99: Penolakan Berkas Kosong (E0054)
-- ============================================================
DO $$
BEGIN
  PERFORM public.rpc_impor_barang('kosong.csv', '[]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Berkas kosong seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Berkas CSV kosong%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan Berkas CSV kosong: %', SQLERRM;
  END IF;
END $$;

-- ============================================================
-- TC-92: Deteksi Kode Duplikat di Dalam Berkas CSV (E0059)
-- ============================================================
DO $$
BEGIN
  PERFORM public.rpc_impor_barang('dup.csv', '[
    {"kode":"BRG-DUP","nama":"Barang 1","satuan":"pcs","harga_jual":1000},
    {"kode":"BRG-DUP","nama":"Barang 2","satuan":"pcs","harga_jual":2000}
  ]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Kode duplikat in-batch seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Kode barang atau pelanggan duplikat%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan duplikat: %', SQLERRM;
  END IF;
END $$;

-- ============================================================
-- TC-93: Penolakan Kode yang Sudah Ada di Database (E0057)
-- ============================================================
-- 'BRG-01' sudah ada di seed data
DO $$
BEGIN
  PERFORM public.rpc_impor_barang('exist.csv', '[
    {"kode":"BRG-01","nama":"Tepung Terigu Baru","satuan":"kg","harga_jual":15000}
  ]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Kode yang sudah ada di database seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Kode barang atau pelanggan sudah terdaftar%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan sudah terdaftar: %', SQLERRM;
  END IF;
END $$;

-- ============================================================
-- TC-94: Penolakan Harga Jual Nol atau Negatif (E0028)
-- ============================================================
DO $$
BEGIN
  PERFORM public.rpc_impor_barang('nol.csv', '[
    {"kode":"BRG-NOL","nama":"Barang Gratis","satuan":"pcs","harga_jual":0}
  ]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Harga jual 0 seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Harga jual harus lebih dari 0%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan harga jual: %', SQLERRM;
  END IF;
END $$;

-- ============================================================
-- TC-89: Impor CSV Barang Valid (Stok 0, Tanpa HPP)
-- ============================================================
DO $$
DECLARE
  v_res jsonb;
  v_nomor text;
  v_stok int;
  v_count int;
BEGIN
  v_res := public.rpc_impor_barang('barang_stok0.csv', '[
    {"kode":"BRG-NEW-01","nama":"Kecap Asin 300ml","satuan":"botol","harga_jual":12000,"stok_minimum":5},
    {"kode":"BRG-NEW-02","nama":"Cuka Dapur 150ml","satuan":"botol","harga_jual":5000,"stok_minimum":10}
  ]'::jsonb);

  v_nomor := v_res->>'nomor';
  IF v_nomor IS NULL OR v_nomor NOT LIKE 'IMP-%' THEN
    RAISE EXCEPTION 'TEST FAILED: Nomor dokumen tidak sesuai pola IMP-YYYY-XXXX: %', v_nomor;
  END IF;

  SELECT stok INTO v_stok FROM public.barang WHERE kode = 'BRG-NEW-01';
  IF v_stok <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Stok awal harus 0, didapat %', v_stok;
  END IF;

  -- Pastikan riwayat impor dan audit log tercatat
  SELECT count(*) INTO v_count FROM public.impor_data WHERE nomor = v_nomor;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Riwayat impor_data tidak tercatat';
  END IF;

  SELECT count(*) INTO v_count FROM public.audit_log WHERE aksi = 'impor_barang' AND nilai_baru->>'nomor' = v_nomor;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Entri audit log tidak tercatat';
  END IF;
END $$;

-- ============================================================
-- TC-90: Impor CSV Barang Valid dengan Stok Awal & HPP
-- ============================================================
DO $$
DECLARE
  v_res jsonb;
  v_nomor text;
  v_barang_id uuid;
  v_stok int;
  v_hpp numeric;
  v_mutasi record;
BEGIN
  v_res := public.rpc_impor_barang('barang_stok_awal.csv', '[
    {
      "kode":"BRG-STOK-01",
      "nama":"Minyak Goreng Sawit 1L",
      "satuan":"pouch",
      "harga_jual":18000,
      "harga_pokok":15000,
      "stok_minimum":10,
      "stok_awal":25,
      "aktif":true
    }
  ]'::jsonb);

  v_nomor := v_res->>'nomor';

  SELECT id, stok, harga_pokok INTO v_barang_id, v_stok, v_hpp
  FROM public.barang WHERE kode = 'BRG-STOK-01';

  IF v_stok <> 25 THEN
    RAISE EXCEPTION 'TEST FAILED: Stok fisik barang harus 25, didapat %', v_stok;
  END IF;

  IF v_hpp <> 15000 THEN
    RAISE EXCEPTION 'TEST FAILED: Harga pokok barang harus 15000, didapat %', v_hpp;
  END IF;

  -- Periksa kartu mutasi stok
  SELECT * INTO v_mutasi FROM public.mutasi_stok
  WHERE barang_id = v_barang_id AND nomor_dokumen = v_nomor;

  IF v_mutasi.id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Kartu mutasi stok tidak ditemukan untuk nomor %', v_nomor;
  END IF;

  IF v_mutasi.jenis <> 'penyesuaian' OR v_mutasi.jumlah <> 25 OR v_mutasi.stok_sesudah <> 25 THEN
    RAISE EXCEPTION 'TEST FAILED: Data mutasi stok tidak sesuai: %', v_mutasi;
  END IF;

  IF length(v_mutasi.alasan) < 10 THEN
    RAISE EXCEPTION 'TEST FAILED: Alasan mutasi kurang dari 10 karakter: %', v_mutasi.alasan;
  END IF;

  -- Verifikasi invarian buku besar stok
  IF (SELECT sum(jumlah) FROM public.mutasi_stok WHERE barang_id = v_barang_id) <> v_stok THEN
    RAISE EXCEPTION 'TEST FAILED: Invarian sum(mutasi_stok) != barang.stok';
  END IF;
END $$;

-- ============================================================
-- TC-91: Impor CSV Pelanggan Valid (Termin & Batas Kredit)
-- ============================================================
DO $$
DECLARE
  v_res jsonb;
  v_nomor text;
  v_pelanggan record;
BEGIN
  v_res := public.rpc_impor_pelanggan('pelanggan.csv', '[
    {
      "kode":"PLG-IMP-01",
      "nama_toko":"Toko Sukses Jaya Mandiri",
      "telepon":"081299988877",
      "alamat":"Jl. Bintara Jaya No. 9",
      "termin_hari":14,
      "batas_kredit":3000000,
      "aktif":true
    }
  ]'::jsonb);

  v_nomor := v_res->>'nomor';

  SELECT * INTO v_pelanggan FROM public.pelanggan WHERE kode = 'PLG-IMP-01';
  IF v_pelanggan.id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Pelanggan tidak tersimpan';
  END IF;

  IF v_pelanggan.termin_hari <> 14 OR v_pelanggan.batas_kredit <> 3000000 THEN
    RAISE EXCEPTION 'TEST FAILED: Termin atau batas kredit tidak sesuai: %', v_pelanggan;
  END IF;
END $$;

-- ============================================================
-- TC-97: Penolakan Nilai Termin Tidak Valid (E0024)
-- ============================================================
DO $$
BEGIN
  PERFORM public.rpc_impor_pelanggan('termin_invalid.csv', '[
    {
      "kode":"PLG-BAD-TERM",
      "nama_toko":"Toko Salah Termin",
      "termin_hari":45
    }
  ]'::jsonb);
  RAISE EXCEPTION 'TEST FAILED: Termin tidak valid seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Termin hari harus 0, 7, 14, atau 30%' THEN
    RAISE EXCEPTION 'TEST FAILED: Pesan error bukan termin: %', SQLERRM;
  END IF;
END $$;

-- ============================================================
-- TC-105: Atomisitas Transaksi (All or Nothing Rollback)
-- ============================================================
DO $$
DECLARE
  v_count_sebelum int;
  v_count_sesudah int;
BEGIN
  SELECT count(*) INTO v_count_sebelum FROM public.barang;

  BEGIN
    PERFORM public.rpc_impor_barang('batch_partial.csv', '[
      {"kode":"BRG-VALID-A","nama":"Barang A","satuan":"pcs","harga_jual":10000},
      {"kode":"BRG-VALID-B","nama":"Barang B","satuan":"pcs","harga_jual":-500}
    ]'::jsonb);
    RAISE EXCEPTION 'TEST FAILED: Seharusnya error di baris kedua';
  EXCEPTION WHEN OTHERS THEN
    -- Expected error
    NULL;
  END;

  SELECT count(*) INTO v_count_sesudah FROM public.barang;
  IF v_count_sebelum <> v_count_sesudah THEN
    RAISE EXCEPTION 'TEST FAILED: Transaksi tidak atomik! Ada data parsial yang tersimpan. Sebelum: %, Sesudah: %', v_count_sebelum, v_count_sesudah;
  END IF;

  IF EXISTS (SELECT 1 FROM public.barang WHERE kode = 'BRG-VALID-A') THEN
    RAISE EXCEPTION 'TEST FAILED: BRG-VALID-A tersimpan padahal transaksi seharusnya di-rollback penuh!';
  END IF;
END $$;

-- ============================================================
-- TC-108: Zero-Leakage Data Rahasia Harga Pokok
-- ============================================================
DO $$
DECLARE
  v_ringkasan jsonb;
  v_audit jsonb;
BEGIN
  SELECT ringkasan INTO v_ringkasan FROM public.impor_data ORDER BY dibuat_pada DESC LIMIT 1;
  IF v_ringkasan::text LIKE '%harga_pokok%' OR v_ringkasan::text LIKE '%hpp%' THEN
    RAISE EXCEPTION 'TEST FAILED: Ringkasan impor_data membocorkan harga pokok: %', v_ringkasan;
  END IF;

  SELECT nilai_baru INTO v_audit FROM public.audit_log WHERE aksi = 'impor_barang' ORDER BY dibuat_pada DESC LIMIT 1;
  IF v_audit::text LIKE '%harga_pokok%' OR v_audit::text LIKE '%hpp%' THEN
    RAISE EXCEPTION 'TEST FAILED: Nilai baru audit_log membocorkan harga pokok: %', v_audit;
  END IF;
END $$;

ROLLBACK;

\echo 'ALL TEST CASES TC-89 s.d. TC-108 IN 08_impor_csv.sql PASSED SUCCESSFULLY!'
