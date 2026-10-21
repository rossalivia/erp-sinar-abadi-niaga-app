-- ============================================================
-- SUITE UJI KEAMANAN & RBAC (02_keamanan.sql)
-- Memverifikasi:
-- 1. Column grants: harga_pokok, harga_beli_satuan, hpp_satuan tertutup
-- 2. View manajer: Manajer dapat baris, Penjualan & Gudang 0 baris
-- 3. Trigger guard: Penjualan tidak bisa ubah harga_jual, Gudang tidak bisa ubah batas_kredit
-- 4. Guard stok: UPDATE barang.stok langsung ditolak
-- 5. Append-only: UPDATE/DELETE mutasi_stok & audit_log ditolak
-- 6. Role anon: ditolak pada semua tabel & view
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji (
  nomor serial,
  kode_tc text,
  deskripsi text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

-- ============================================================
-- 1. Uji Column-Level Grants (TC-03)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
BEGIN
  -- Login sebagai Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- 1a. SELECT barang.harga_pokok langsung
  BEGIN
    EXECUTE 'SELECT harga_pokok FROM public.barang LIMIT 1';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-03a', 'SELECT barang.harga_pokok langsung ditolak (permission denied)', 'PASS', 'Permission denied sesuai harapan');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-03a', 'SELECT barang.harga_pokok langsung ditolak', 'FAIL', 'Harga pokok berhasil dibaca!');
  END IF;

  -- 1b. SELECT pembelian.harga_beli_satuan langsung
  v_err := false;
  BEGIN
    EXECUTE 'SELECT harga_beli_satuan FROM public.pembelian LIMIT 1';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-03b', 'SELECT pembelian.harga_beli_satuan langsung ditolak (permission denied)', 'PASS', 'Permission denied sesuai harapan');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-03b', 'SELECT pembelian.harga_beli_satuan langsung ditolak', 'FAIL', 'Harga beli berhasil dibaca!');
  END IF;

  -- 1c. SELECT item_pesanan_jual.hpp_satuan langsung
  v_err := false;
  BEGIN
    EXECUTE 'SELECT hpp_satuan FROM public.item_pesanan_jual LIMIT 1';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-03c', 'SELECT item_pesanan_jual.hpp_satuan langsung ditolak (permission denied)', 'PASS', 'Permission denied sesuai harapan');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-03c', 'SELECT item_pesanan_jual.hpp_satuan langsung ditolak', 'FAIL', 'HPP satuan berhasil dibaca!');
  END IF;
END $$;

-- ============================================================
-- 2. Uji View Manajer (TC-04)
-- ============================================================
DO $$
DECLARE
  v_cnt integer;
BEGIN
  -- Login sebagai Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- 2a. Penjualan baca v_barang_manajer
  SELECT count(*) INTO v_cnt FROM public.v_barang_manajer;
  IF v_cnt = 0 THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04a', 'Penjualan membaca v_barang_manajer menghasilkan 0 baris', 'PASS', '0 baris diterima');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04a', 'Penjualan membaca v_barang_manajer menghasilkan 0 baris', 'FAIL', format('Diterima %s baris', v_cnt));
  END IF;

  -- 2b. Penjualan baca v_pembelian_manajer
  SELECT count(*) INTO v_cnt FROM public.v_pembelian_manajer;
  IF v_cnt = 0 THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04b', 'Penjualan membaca v_pembelian_manajer menghasilkan 0 baris', 'PASS', '0 baris diterima');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04b', 'Penjualan membaca v_pembelian_manajer menghasilkan 0 baris', 'FAIL', format('Diterima %s baris', v_cnt));
  END IF;

  -- 2c. Penjualan baca v_item_pesanan_jual_manajer
  SELECT count(*) INTO v_cnt FROM public.v_item_pesanan_jual_manajer;
  IF v_cnt = 0 THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04c', 'Penjualan membaca v_item_pesanan_manajer menghasilkan 0 baris', 'PASS', '0 baris diterima');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04c', 'Penjualan membaca v_item_pesanan_manajer menghasilkan 0 baris', 'FAIL', format('Diterima %s baris', v_cnt));
  END IF;

  -- 2d. Login sebagai Gudang
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  SELECT count(*) INTO v_cnt FROM public.v_barang_manajer;
  IF v_cnt = 0 THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04d', 'Gudang membaca v_barang_manajer menghasilkan 0 baris', 'PASS', '0 baris diterima');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04d', 'Gudang membaca v_barang_manajer menghasilkan 0 baris', 'FAIL', format('Diterima %s baris', v_cnt));
  END IF;

  -- 2e. Login sebagai Manajer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  SELECT count(*) INTO v_cnt FROM public.v_barang_manajer;
  IF v_cnt >= 15 THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04e', 'Manajer membaca v_barang_manajer menghasilkan seluruh data', 'PASS', format('%s baris diterima lengkap', v_cnt));
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-04e', 'Manajer membaca v_barang_manajer menghasilkan seluruh data', 'FAIL', format('Hanya diterima %s baris', v_cnt));
  END IF;
END $$;

-- ============================================================
-- 3. Uji Trigger Guard Peran (TC-09 & TC-18)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_rows integer;
BEGIN
  -- 3a. Penjualan mencoba mengubah barang.harga_jual (TC-09)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  BEGIN
    UPDATE public.barang SET harga_jual = 99999 WHERE kode = 'BRG-A';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Hanya Manajer yang dapat mengubah harga%' THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-09a', 'Penjualan UPDATE barang.harga_jual ditolak trigger guard (E23)', 'PASS', v_msg);
  ELSIF NOT v_err AND v_rows = 0 THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-09a', 'Penjualan UPDATE barang.harga_jual diblokir RLS (0 baris)', 'PASS', '0 baris terpengaruh');
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-09a', 'Penjualan UPDATE barang.harga_jual ditolak', 'FAIL', 'Harga jual berhasil diubah oleh Penjualan!');
  END IF;

  -- 3b. Gudang (yang punya izin UPDATE barang selain harga) mencoba mengubah barang.harga_jual (TC-09)
  v_err := false;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

  BEGIN
    UPDATE public.barang SET harga_jual = 99999 WHERE kode = 'BRG-A';
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Hanya Manajer yang dapat mengubah harga%' THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-09b', 'Gudang UPDATE barang.harga_jual ditolak trigger guard (E23)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-09b', 'Gudang UPDATE barang.harga_jual ditolak trigger guard', 'FAIL', COALESCE(v_msg, 'Berhasil diubah tanpa error!'));
  END IF;

  -- 3c. Penjualan (yang punya izin UPDATE pelanggan data toko) mencoba mengubah pelanggan.batas_kredit (TC-18)
  v_err := false;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  BEGIN
    UPDATE public.pelanggan SET batas_kredit = 9999999 WHERE kode = 'PLG-1';
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Hanya Manajer yang dapat mengubah batas kredit%' THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-18a', 'Penjualan UPDATE pelanggan.batas_kredit ditolak trigger guard (E24)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-18a', 'Penjualan UPDATE pelanggan.batas_kredit ditolak trigger guard', 'FAIL', COALESCE(v_msg, 'Berhasil diubah tanpa error!'));
  END IF;

  -- 3d. Penjualan mencoba eskalasi peran pada profiles (TC-06)
  v_err := false;
  BEGIN
    UPDATE public.profiles SET peran = 'manajer' WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err AND (v_msg LIKE '%Hanya Manajer yang dapat mengubah peran%' OR v_msg LIKE '%permission denied for table profiles%') THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-06', 'Penjualan eskalasi peran sendiri ditolak (grant / trigger guard)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-06', 'Penjualan eskalasi peran sendiri ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil eskalasi tanpa error!'));
  END IF;

  -- 3e. Penjualan mencoba menonaktifkan akun sendiri pada profiles
  v_err := false;
  BEGIN
    UPDATE public.profiles SET aktif = false WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err AND (v_msg LIKE '%Hanya Manajer yang dapat mengubah peran%' OR v_msg LIKE '%permission denied for table profiles%') THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-02', 'Penjualan mengubah status aktif akun sendiri ditolak (grant / trigger guard)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-02', 'Penjualan mengubah status aktif akun sendiri ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil diubah tanpa error!'));
  END IF;
END $$;

-- ============================================================
-- 4. Uji UPDATE Langsung barang.stok (TC-08)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
BEGIN
  -- Login sebagai Manajer
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  BEGIN
    EXECUTE 'UPDATE public.barang SET stok = 999 WHERE kode = ''BRG-A''';
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_err := true;
      v_msg := 'permission denied (kolom stok tidak di-grant UPDATE)';
    WHEN OTHERS THEN
      v_err := true;
      v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-08', 'UPDATE barang.stok langsung ditolak (grant / trigger guard)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-08', 'UPDATE barang.stok langsung ditolak', 'FAIL', 'Stok berhasil di-update langsung!');
  END IF;
END $$;

-- ============================================================
-- 5. Uji Append-Only mutasi_stok & audit_log (TC-27, TC-28)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  -- 5a. UPDATE mutasi_stok
  BEGIN
    EXECUTE 'UPDATE public.mutasi_stok SET jumlah = 999 WHERE nomor_dokumen = ''SALDO-AWAL''';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-27a', 'UPDATE mutasi_stok ditolak (append-only)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-27a', 'UPDATE mutasi_stok ditolak', 'FAIL', 'mutasi_stok berhasil di-update!');
  END IF;

  -- 5b. DELETE mutasi_stok
  v_err := false;
  BEGIN
    EXECUTE 'DELETE FROM public.mutasi_stok WHERE nomor_dokumen = ''SALDO-AWAL''';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-27b', 'DELETE mutasi_stok ditolak (append-only)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-27b', 'DELETE mutasi_stok ditolak', 'FAIL', 'mutasi_stok berhasil di-delete!');
  END IF;

  -- 5c. UPDATE audit_log
  v_err := false;
  BEGIN
    EXECUTE 'UPDATE public.audit_log SET aksi = ''palsu''';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-28a', 'UPDATE audit_log ditolak (append-only)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-28a', 'UPDATE audit_log ditolak', 'FAIL', 'audit_log berhasil di-update!');
  END IF;

  -- 5d. DELETE audit_log
  v_err := false;
  BEGIN
    EXECUTE 'DELETE FROM public.audit_log';
  EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-28b', 'DELETE audit_log ditolak (append-only)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-28b', 'DELETE audit_log ditolak', 'FAIL', 'audit_log berhasil di-delete!');
  END IF;
END $$;

-- ============================================================
-- 6. Uji Role Anonim (TC-01)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
BEGIN
  SET LOCAL ROLE anon;

  BEGIN
    EXECUTE 'SELECT count(*) FROM public.barang';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-01a', 'Role anon SELECT barang ditolak (permission denied)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-01a', 'Role anon SELECT barang ditolak', 'FAIL', 'Anon berhasil membaca barang!');
  END IF;

  v_err := false;
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.v_barang';
  EXCEPTION WHEN insufficient_privilege THEN
    v_err := true;
    v_msg := SQLERRM;
  END;

  IF v_err THEN
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-01b', 'Role anon SELECT v_barang ditolak (permission denied)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-01b', 'Role anon SELECT v_barang ditolak', 'FAIL', 'Anon berhasil membaca v_barang!');
  END IF;
END $$;

-- ============================================================
-- TAMPILKAN LAPORAN HASIL PENGUJIAN
-- ============================================================
RESET ROLE;

SELECT
  nomor,
  kode_tc,
  status,
  deskripsi,
  pesan
FROM hasil_uji
ORDER BY nomor;

DO $$
DECLARE
  v_fail integer;
  v_pass integer;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'FAIL'),
         count(*) FILTER (WHERE status = 'PASS')
  INTO v_fail, v_pass
  FROM hasil_uji;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'RINGKASAN UJI: % PASS, % FAIL DARI % TOTAL TES', v_pass, v_fail, (v_pass + v_fail);
  RAISE NOTICE '============================================================';

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Pengujian gagal: terdapat % tes berstatus FAIL', v_fail;
  END IF;
END $$;

ROLLBACK;
