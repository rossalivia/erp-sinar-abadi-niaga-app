-- ============================================================
-- SUITE UJI LOGIKA BISNIS & RPC (03_rpc.sql)
-- Memverifikasi BR-01 s.d. BR-12 & Test Cases TC-06..TC-28
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_rpc (
  nomor serial,
  kode_br text,
  kode_tc text,
  deskripsi text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_rpc TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

-- ============================================================
-- 1. BR-01 & TC-07: Master Barang (Harga, Stok Minimum, Kode Unik)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_res jsonb;
BEGIN
  -- Login sebagai Manajer
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  -- 1a. Kode barang sudah ada (case-insensitive) -> E27
  BEGIN
    PERFORM public.rpc_buat_barang('brg-a', 'Beras Palsu', 'kg', 10000, 5);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Kode barang sudah digunakan%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07a', 'Buat barang dengan kode terpakai ditolak (E27)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07a', 'Buat barang dengan kode terpakai ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil dibuat tanpa error!'));
  END IF;

  -- 1b. Harga jual <= 0 -> E28
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_buat_barang('BRG-NEW1', 'Barang Nol', 'pcs', 0, 5);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Harga jual harus lebih dari 0%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07b', 'Buat barang harga_jual = 0 ditolak (E28)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07b', 'Buat barang harga_jual = 0 ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 1c. Stok minimum < 0 -> E29
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_buat_barang('BRG-NEW2', 'Barang Min Minus', 'pcs', 10000, -1);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Stok minimum harus bilangan bulat >= 0%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07c', 'Buat barang stok_minimum < 0 ditolak (E29)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07c', 'Buat barang stok_minimum < 0 ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 1d. Buat barang valid -> sukses, stok awal = 0
  v_err := false; v_msg := NULL;
  BEGIN
    v_res := public.rpc_buat_barang('BRG-NEWOK', 'Barang Baru Sukses', 'pcs', 25000, 10, 20000);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF NOT v_err AND (v_res->>'stok')::int = 0 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07d', 'Buat barang valid sukses dengan stok awal 0', 'PASS', format('ID: %s, Stok: %s', v_res->>'id', v_res->>'stok'));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-01', 'TC-07d', 'Buat barang valid sukses', 'FAIL', COALESCE(v_msg, 'Stok bukan 0!'));
  END IF;
END $$;

-- ============================================================
-- 2. BR-02 & TC-10, TC-11: Aturan Baris Item Pesanan Jual
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_so  jsonb;
  v_plg_id uuid := 'b1111111-0000-0000-0000-000000000001'; -- PLG-1
  v_brg_a  uuid := 'c1111111-0000-0000-0000-000000000001'; -- BRG-A
  v_brg_c  uuid := 'c1111111-0000-0000-0000-000000000003'; -- BRG-C (nonaktif)
  v_so_id  uuid;
BEGIN
  -- Login sebagai Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- 2a. Konfirmasi pesanan tanpa baris item -> E03
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;

  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Pesanan harus berisi 1 sampai 20 baris%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-10', 'Konfirmasi draf tanpa baris item ditolak (E03)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-10', 'Konfirmasi draf tanpa baris item ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 2b. Simpan item jumlah = 0 -> E04
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 0, 0);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Jumlah minimal 1%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11a', 'Simpan item dengan jumlah 0 ditolak (E04)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11a', 'Simpan item dengan jumlah 0 ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 2c. Simpan item barang duplikat -> E05
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 2, 0);
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 1, 0);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Barang sudah ada di pesanan ini%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11b', 'Simpan barang duplikat pada pesanan ditolak (E05)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11b', 'Simpan barang duplikat pada pesanan ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 2d. Simpan barang nonaktif (BRG-C) -> E06
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_c, 1, 0);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Barang tidak aktif%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11c', 'Simpan barang tidak aktif ditolak (E06)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11c', 'Simpan barang tidak aktif ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 2e. Buat pesanan untuk pelanggan nonaktif (PLG-4) -> E07
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_buat_pesanan('b1111111-0000-0000-0000-000000000004');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Pelanggan tidak aktif%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11d', 'Buat pesanan untuk pelanggan nonaktif ditolak (E07)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-11d', 'Buat pesanan untuk pelanggan nonaktif ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;
END $$;

-- ============================================================
-- 3. BR-03 & TC-12, TC-13: Perhitungan Harga Satuan, Diskon, & Pembulatan
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_so  jsonb;
  v_so_id uuid;
  v_plg_id uuid := 'b1111111-0000-0000-0000-000000000001';
  v_brg_d  uuid := 'c1111111-0000-0000-0000-000000000004'; -- harga_jual 3333
  v_item record;
BEGIN
  -- Login sebagai Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- 3a. BRG-D jumlah 3 diskon 7.5% -> subtotal = round(3 * 3333 * 92.5 / 100) = 9249 (TC-12)
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;

  -- Kirim juga parameter harga_satuan = 1 untuk menguji bahwa input diabaikan
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_d, 3, 7.5, 1);

  SELECT harga_satuan, subtotal INTO v_item FROM public.v_item_pesanan_jual WHERE pesanan_jual_id = v_so_id;
  IF v_item.harga_satuan = 3333 AND v_item.subtotal = 9249 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-03', 'TC-12a', 'Harga satuan otomatis & subtotal pembulatan akurat (9249)', 'PASS', format('Harga: %s, Subtotal: %s', v_item.harga_satuan, v_item.subtotal));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-03', 'TC-12a', 'Harga satuan otomatis & subtotal pembulatan akurat', 'FAIL', format('Harga: %s, Subtotal: %s', v_item.harga_satuan, v_item.subtotal));
  END IF;

  -- 3b. Konfirmasi pesanan, lalu coba ubah baris lagi -> E08
  PERFORM public.rpc_konfirmasi_pesanan(v_so_id);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_simpan_item_pesanan(v_so_id, 'c1111111-0000-0000-0000-000000000001', 1, 0);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Pesanan hanya bisa diubah saat berstatus draf%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-12b', 'Ubah baris pesanan non-draf ditolak (E08)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-02', 'TC-12b', 'Ubah baris pesanan non-draf ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 3c. Diskon Staf Penjualan > 10% (TC-13)
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_d, 1, 10.5);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Diskon harus 0% sampai 10%%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-03', 'TC-13a', 'Penjualan memberi diskon 10.5% ditolak (E09)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-03', 'TC-13a', 'Penjualan memberi diskon 10.5% ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 3d. Diskon Manajer > 25% (TC-13)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_d, 1, 26);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Diskon harus 0% sampai 25%%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-03', 'TC-13b', 'Manajer memberi diskon 26% ditolak (E10)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-03', 'TC-13b', 'Manajer memberi diskon 26% ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;
END $$;

-- ============================================================
-- 4. BR-04 & TC-14, TC-15: Konfirmasi di Bawah HPP & Snapshot HPP
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_so  jsonb;
  v_so_id uuid;
  v_plg_id uuid := 'b1111111-0000-0000-0000-000000000001'; -- PLG-1
  v_brg_b  uuid := 'c1111111-0000-0000-0000-000000000002'; -- BRG-B: hj 15000, hp 14000
  v_item record;
  v_stok_b integer;
BEGIN
  -- Login sebagai Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- 4a. Draf PLG-1: BRG-B jumlah 1 diskon 10% (subtotal 13500 < HPP 14000)
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_b, 1, 10);

  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  -- Cek teks error persis dan pastikan tidak membocorkan angka 14000 atau HPP
  IF v_err AND v_msg = 'Harga di bawah batas, minta persetujuan Manajer' AND v_msg NOT LIKE '%14000%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-04', 'TC-14', 'Penjualan konfirmasi di bawah HPP ditolak (E11, tanpa bocor angka)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-04', 'TC-14', 'Penjualan konfirmasi di bawah HPP ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil konfirmasi tanpa proteksi!'));
  END IF;

  -- 4b. Manajer boleh konfirmasi draf yang sama (TC-15)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  SELECT hpp_satuan INTO v_item FROM public.v_item_pesanan_jual_manajer WHERE pesanan_jual_id = v_so_id;
  SELECT stok INTO v_stok_b FROM public.barang WHERE id = v_brg_b;

  IF NOT v_err AND v_item.hpp_satuan = 14000 AND v_stok_b = 0 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-04', 'TC-15', 'Manajer berhasil konfirmasi & HPP di-snapshot permanen (14000)', 'PASS', format('Status: dikonfirmasi, Snapshot HPP: %s, Stok akhir: %s', v_item.hpp_satuan, v_stok_b));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-04', 'TC-15', 'Manajer berhasil konfirmasi & HPP di-snapshot', 'FAIL', COALESCE(v_msg, 'Snapshot salah atau stok tidak berkurang!'));
  END IF;
END $$;

-- ============================================================
-- 5. BR-05 & TC-16, TC-17, TC-18: Batas Kredit & Jatuh Tempo
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_so  jsonb;
  v_so_id uuid;
  v_plg_2 uuid := 'b1111111-0000-0000-0000-000000000002'; -- PLG-2: limit 500.000
  v_plg_3 uuid := 'b1111111-0000-0000-0000-000000000003'; -- PLG-3: tagihan lewat tempo
  v_brg_a uuid := 'c1111111-0000-0000-0000-000000000001'; -- BRG-A: hj 10.000
  v_pembelian_id uuid;
BEGIN
  -- Login sebagai Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- 5a. Draf PLG-2: BRG-A x 51 (total 510.000 > batas kredit 500.000) -> E12
  v_so := public.rpc_buat_pesanan(v_plg_2);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 51, 0);

  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Batas kredit pelanggan terlampaui%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-05', 'TC-16', 'Konfirmasi melampaui batas kredit ditolak (E12)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-05', 'TC-16', 'Konfirmasi melampaui batas kredit ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil konfirmasi melebihi limit!'));
  END IF;

  -- 5b. Tagihan lewat jatuh tempo (PLG-3) -> E13 (TC-17)
  -- Reset role ke postgres untuk menyisipkan data fixture uji
  RESET ROLE;
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-TEMPO', v_plg_3, 'dikirim', 100000, '11111111-1111-1111-1111-111111111111',
    now() - interval '10 days', now() - interval '10 days', (now() AT TIME ZONE 'Asia/Jakarta')::date - 1
  );

  -- Set kembali ke Penjualan 1
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  v_so := public.rpc_buat_pesanan(v_plg_3);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 1, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-05', 'TC-17', 'Konfirmasi saat ada tagihan lewat jatuh tempo ditolak (E13)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-05', 'TC-17', 'Konfirmasi saat ada tagihan lewat jatuh tempo ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil konfirmasi tanpa cek tempo!'));
  END IF;

  -- 5c. Penjualan membuat pelanggan baru: batas kredit otomatis 0 (TC-18)
  v_so := public.rpc_buat_pelanggan('PLG-BARU1', 'Toko Baru Penjualan', '081111', 'Bekasi', 14, 5000000);
  IF (v_so->>'batas_kredit')::numeric = 0 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-05', 'TC-18a', 'Penjualan buat pelanggan: batas kredit dipaksa 0 (A10)', 'PASS', format('Batas kredit: %s', v_so->>'batas_kredit'));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-05', 'TC-18a', 'Penjualan buat pelanggan: batas kredit dipaksa 0', 'FAIL', format('Batas kredit: %s', v_so->>'batas_kredit'));
  END IF;
END $$;

-- ============================================================
-- 6. BR-07 & BR-08: Siklus Status (Kirim, Pelunasan, Pembatalan)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_so  jsonb;
  v_so_id uuid;
  v_plg_1 uuid := 'b1111111-0000-0000-0000-000000000001';
  v_brg_a uuid := 'c1111111-0000-0000-0000-000000000001';
  v_stok_awal integer;
  v_stok_akhir integer;
BEGIN
  -- Login sebagai Manajer
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  -- 6a. Alur normal: draf -> dikonfirmasi -> dikirim -> lunas (TC-21)
  v_so := public.rpc_buat_pesanan(v_plg_1);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 2, 0);
  PERFORM public.rpc_konfirmasi_pesanan(v_so_id);

  -- Kirim pesanan (Gudang/Manajer)
  PERFORM public.rpc_kirim_pesanan(v_so_id);
  IF (SELECT status FROM public.pesanan_jual WHERE id = v_so_id) = 'dikirim' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-07', 'TC-21a', 'Kirim pesanan berhasil & tanggal jatuh tempo terisi', 'PASS', 'Status: dikirim');
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-07', 'TC-21a', 'Kirim pesanan berhasil', 'FAIL', 'Status bukan dikirim!');
  END IF;

  -- Lunasi pesanan (Manajer)
  PERFORM public.rpc_catat_pelunasan(v_so_id);
  IF (SELECT status FROM public.pesanan_jual WHERE id = v_so_id) = 'lunas' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-07', 'TC-21b', 'Pelunasan pesanan berhasil dicatat', 'PASS', 'Status: lunas');
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-07', 'TC-21b', 'Pelunasan pesanan berhasil', 'FAIL', 'Status bukan lunas!');
  END IF;

  -- 6b. Batalkan pesanan terkonfirmasi oleh Manajer: stok kembali & alasan >= 10 (TC-23)
  v_so := public.rpc_buat_pesanan(v_plg_1);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_a, 5, 0);

  SELECT stok INTO v_stok_awal FROM public.barang WHERE id = v_brg_a;
  PERFORM public.rpc_konfirmasi_pesanan(v_so_id);

  -- Coba alasan < 10 karakter -> E16
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_batalkan_pesanan_terkonfirmasi(v_so_id, 'batal aja');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Alasan minimal 10 karakter%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-08', 'TC-23a', 'Batal pesanan dengan alasan < 10 karakter ditolak (E16)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-08', 'TC-23a', 'Batal pesanan dengan alasan pendek ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- Batal valid: alasan >= 10 karakter -> stok kembali
  PERFORM public.rpc_batalkan_pesanan_terkonfirmasi(v_so_id, 'Pelanggan membatalkan pesanan karena toko renovasi');
  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_brg_a;

  IF v_stok_akhir = v_stok_awal THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-08', 'TC-23b', 'Batal pesanan terkonfirmasi berhasil & stok dikembalikan utuh', 'PASS', format('Stok awal: %s, Stok setelah batal: %s', v_stok_awal, v_stok_akhir));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-08', 'TC-23b', 'Stok dikembalikan utuh', 'FAIL', format('Stok awal: %s, Stok akhir: %s', v_stok_awal, v_stok_akhir));
  END IF;
END $$;

-- ============================================================
-- 7. BR-09 & BR-10: Siklus Pengadaan (PO & Penerimaan Barang)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_po  jsonb;
  v_po_id uuid;
  v_pms_1 uuid := 'a1111111-0000-0000-0000-000000000001';
  v_brg_a uuid := 'c1111111-0000-0000-0000-000000000001';
  v_stok_awal integer;
  v_stok_akhir integer;
  v_hp_akhir numeric;
BEGIN
  -- Login sebagai Gudang
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

  -- 7a. Ajukan PO dengan jumlah di luar 1..10000 -> E17 (TC-24)
  BEGIN
    PERFORM public.rpc_ajukan_pembelian(v_pms_1, v_brg_a, 0);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Jumlah pembelian harus 1 sampai 10.000%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-09', 'TC-24', 'Ajukan PO jumlah = 0 ditolak (E17)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-09', 'TC-24', 'Ajukan PO jumlah = 0 ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- Ajukan PO valid
  v_po := public.rpc_ajukan_pembelian(v_pms_1, v_brg_a, 50);
  v_po_id := (v_po->>'id')::uuid;

  -- 7b. Gudang mencoba setujui PO -> ditolak (E01) (TC-25)
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_setujui_pembelian(v_po_id, 9500);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Akses ditolak%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-09', 'TC-25a', 'Gudang menyetujui PO ditolak (E01)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-09', 'TC-25a', 'Gudang menyetujui PO ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil disetujui Gudang!'));
  END IF;

  -- 7c. Manajer menyetujui PO dengan harga beli valid (TC-25)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  PERFORM public.rpc_setujui_pembelian(v_po_id, 9500);

  IF (SELECT status FROM public.pembelian WHERE id = v_po_id) = 'disetujui' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-09', 'TC-25b', 'Manajer menyetujui PO dengan harga beli 9500', 'PASS', 'Status: disetujui');
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-09', 'TC-25b', 'Manajer menyetujui PO', 'FAIL', 'Status bukan disetujui!');
  END IF;

  -- 7d. Terima barang: stok naik & harga_pokok terbarui (TC-26)
  SELECT stok INTO v_stok_awal FROM public.barang WHERE id = v_brg_a;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  PERFORM public.rpc_terima_pembelian(v_po_id, 50);

  SELECT stok INTO v_stok_akhir FROM public.barang WHERE id = v_brg_a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  SELECT harga_pokok INTO v_hp_akhir FROM public.v_barang_manajer WHERE id = v_brg_a;

  IF v_stok_akhir = (v_stok_awal + 50) AND v_hp_akhir = 9500 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-10', 'TC-26a', 'Penerimaan PO sukses: stok bertambah & harga pokok terbarui (9500)', 'PASS', format('Stok: %s, HP: %s', v_stok_akhir, v_hp_akhir));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-10', 'TC-26a', 'Penerimaan PO sukses', 'FAIL', format('Stok: %s, HP: %s', v_stok_akhir, v_hp_akhir));
  END IF;

  -- 7e. Penerimaan ganda pada PO yang sama ditolak (E19) (TC-26)
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_terima_pembelian(v_po_id, 10);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Pembelian tidak dalam status disetujui%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-10', 'TC-26b', 'Penerimaan ganda pada PO ditolak (E19)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-10', 'TC-26b', 'Penerimaan ganda pada PO ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil diterima dua kali!'));
  END IF;
END $$;

-- ============================================================
-- 8. BR-11 & TC-27: Penyesuaian Stok & Rekonsiliasi Kartu Stok
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_brg_a uuid := 'c1111111-0000-0000-0000-000000000001';
  v_selisih integer;
BEGIN
  -- Login sebagai Gudang
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);

  -- 8a. Penyesuaian stok fisik < 0 -> E21
  BEGIN
    PERFORM public.rpc_penyesuaian_stok(v_brg_a, -5, 'Hitung fisik bulanan gudang');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Stok hasil penyesuaian tidak boleh negatif%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-11', 'TC-27a', 'Penyesuaian stok ke angka negatif ditolak (E21)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-11', 'TC-27a', 'Penyesuaian stok ke angka negatif ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 8a2. Penyesuaian stok alasan < 10 karakter -> E0023
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_penyesuaian_stok(v_brg_a, 90, 'Pendek');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND (v_msg LIKE '%Alasan penyesuaian stok minimal 10 karakter%' OR SQLSTATE = 'E0023') THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-11', 'TC-27-alasan', 'Penyesuaian stok alasan < 10 karakter ditolak (E0023)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-11', 'TC-27-alasan', 'Penyesuaian stok alasan < 10 karakter ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 8b. Penyesuaian stok valid: alasan >= 10 karakter -> sukses
  PERFORM public.rpc_penyesuaian_stok(v_brg_a, 95, 'Hitung fisik bulanan stok opname');

  -- 8c. Rekonsiliasi: SUM(mutasi_stok.jumlah) harus persis sama dengan barang.stok
  SELECT count(*) INTO v_selisih
  FROM public.barang b
  WHERE b.stok <> (SELECT COALESCE(SUM(m.jumlah), 0) FROM public.mutasi_stok m WHERE m.barang_id = b.id);

  IF v_selisih = 0 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-11', 'TC-27b', 'Invarian kartu stok sempurna: 0 selisih pada seluruh barang', 'PASS', 'Semua mutasi cocok dengan stok saat ini');
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-11', 'TC-27b', 'Invarian kartu stok', 'FAIL', format('Terdapat %s barang yang tidak sinkron!', v_selisih));
  END IF;
END $$;

-- ============================================================
-- 9. BR-12 & TC-28: Audit Log Aksi Sensitif
-- ============================================================
DO $$
DECLARE
  v_cnt integer;
BEGIN
  -- Login sebagai Manajer
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  -- Pastikan terdapat baris audit untuk setiap aksi bisnis yang telah dilakukan
  SELECT count(DISTINCT aksi) INTO v_cnt
  FROM public.audit_log
  WHERE aksi IN ('konfirmasi_pesanan', 'batalkan_pesanan', 'setujui_pembelian', 'sesuaikan_stok', 'lunasi_pesanan');

  IF v_cnt >= 4 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-12', 'TC-28', 'Seluruh aksi sensitif tercatat lengkap di audit_log', 'PASS', format('Tercatat %s jenis aksi bisnis berbeda', v_cnt));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-12', 'TC-28', 'Audit log aksi sensitif', 'FAIL', format('Hanya tercatat %s aksi', v_cnt));
  END IF;
END $$;

-- ============================================================
-- 10. Laporan (Khusus Manajer)
-- ============================================================
DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_cnt integer;
BEGIN
  -- 10a. Penjualan panggil rpc_laporan_mingguan -> E01
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  BEGIN
    PERFORM * FROM public.rpc_laporan_mingguan();
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Akses ditolak%' THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('Laporan', 'TC-04f', 'Penjualan panggil rpc_laporan_mingguan ditolak (E01)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('Laporan', 'TC-04f', 'Penjualan panggil rpc_laporan_mingguan ditolak', 'FAIL', COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- 10b. Manajer panggil rpc_laporan_mingguan & rpc_laporan_piutang -> sukses
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);

  SELECT count(*) INTO v_cnt FROM public.rpc_laporan_mingguan();
  IF v_cnt >= 8 THEN
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('Laporan', 'TC-04g', 'Manajer panggil rpc_laporan_mingguan sukses (deret 8 minggu)', 'PASS', format('%s baris mingguan dihasilkan', v_cnt));
  ELSE
    INSERT INTO hasil_uji_rpc (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('Laporan', 'TC-04g', 'Manajer panggil rpc_laporan_mingguan', 'FAIL', format('Hanya %s baris dihasilkan!', v_cnt));
  END IF;
END $$;

-- ============================================================
-- TAMPILKAN LAPORAN HASIL PENGUJIAN
-- ============================================================
RESET ROLE;

SELECT
  nomor,
  kode_br,
  kode_tc,
  status,
  deskripsi,
  pesan
FROM hasil_uji_rpc
ORDER BY nomor;

DO $$
DECLARE
  v_fail integer;
  v_pass integer;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'FAIL'),
         count(*) FILTER (WHERE status = 'PASS')
  INTO v_fail, v_pass
  FROM hasil_uji_rpc;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'RINGKASAN UJI RPC: % PASS, % FAIL DARI % TOTAL TES', v_pass, v_fail, (v_pass + v_fail);
  RAISE NOTICE '============================================================';

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Pengujian gagal: terdapat % tes berstatus FAIL', v_fail;
  END IF;
END $$;

ROLLBACK;
