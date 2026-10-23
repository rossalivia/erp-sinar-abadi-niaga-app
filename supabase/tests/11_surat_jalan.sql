-- ============================================================
-- Test Suite: Cetak Surat Jalan (TC-146 s.d. TC-153)
-- Berkas: supabase/tests/11_surat_jalan.sql
-- ============================================================

BEGIN;

-- Helper Fungsi Pengujian Sederhana
CREATE OR REPLACE FUNCTION pg_temp.assert(condition boolean, message text)
RETURNS void AS $$
BEGIN
  IF NOT condition THEN
    RAISE EXCEPTION 'TEST FAILED: %', message;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 1. TC-153: Verifikasi Katalog Kolom Bebas dari Data Finansial (Zero-Leakage)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad_cols text[];
BEGIN
  -- Periksa kolom v_surat_jalan
  SELECT array_agg(column_name::text) INTO v_bad_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_surat_jalan'
    AND column_name = ANY(ARRAY['total', 'harga', 'diskon', 'subtotal', 'termin_hari', 'jatuh_tempo', 'batas_kredit', 'hpp', 'margin']);

  PERFORM pg_temp.assert(v_bad_cols IS NULL OR array_length(v_bad_cols, 1) = 0, 'v_surat_jalan memuat kolom finansial rahasia: ' || array_to_string(v_bad_cols, ', '));

  -- Periksa kolom v_surat_jalan_item
  SELECT array_agg(column_name::text) INTO v_bad_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_surat_jalan_item'
    AND column_name = ANY(ARRAY['harga_satuan', 'diskon_persen', 'subtotal', 'total', 'hpp_satuan', 'harga_pokok', 'harga_jual', 'margin']);

  PERFORM pg_temp.assert(v_bad_cols IS NULL OR array_length(v_bad_cols, 1) = 0, 'v_surat_jalan_item memuat kolom finansial rahasia: ' || array_to_string(v_bad_cols, ', '));

  RAISE NOTICE 'TC-153: LULUS (Katalog kolom v_surat_jalan dan v_surat_jalan_item 100 persen bersih dari kolom finansial)';
END $$;

-- ------------------------------------------------------------
-- Siapkan Data Uji Pesanan untuk Berbagai Status dan Pembuat
-- ------------------------------------------------------------
DO $$
DECLARE
  v_manajer_id uuid;
  v_sales_a_id uuid;
  v_sales_b_id uuid;
  v_gudang_id  uuid;
  v_pelanggan_id uuid;
  v_barang_id uuid;
  v_pesanan_draf_id uuid;
  v_pesanan_konfirm_id uuid;
  v_pesanan_dikirim_a_id uuid;
  v_pesanan_dikirim_b_id uuid;
  v_pesanan_lunas_id uuid;
  v_pesanan_batal_id uuid;
  v_count int;
BEGIN
  -- Ambil pengguna profil uji
  SELECT id INTO v_manajer_id FROM public.profiles WHERE peran = 'manajer' AND aktif = true LIMIT 1;
  SELECT id INTO v_gudang_id FROM public.profiles WHERE peran = 'gudang' AND aktif = true LIMIT 1;

  -- Cari atau buat 2 sales berbeda
  SELECT id INTO v_sales_a_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true ORDER BY id ASC LIMIT 1;
  SELECT id INTO v_sales_b_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true AND id <> v_sales_a_id ORDER BY id ASC LIMIT 1;

  IF v_sales_b_id IS NULL THEN
    v_sales_b_id := gen_random_uuid();
    INSERT INTO public.profiles (id, nama_lengkap, peran, aktif)
    VALUES (v_sales_b_id, 'Sales B Uji', 'penjualan', true);
  END IF;

  SELECT id INTO v_pelanggan_id FROM public.pelanggan WHERE aktif = true LIMIT 1;
  SELECT id INTO v_barang_id FROM public.barang WHERE aktif = true LIMIT 1;

  -- 1. Pesanan Draf oleh Sales A
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, total)
  VALUES ('SO-TEST-DRAF', v_pelanggan_id, 'draf', v_sales_a_id, 100000)
  RETURNING id INTO v_pesanan_draf_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_pesanan_draf_id, v_barang_id, 2, 50000, 0, 100000);

  -- 2. Pesanan Dikonfirmasi oleh Sales A
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, total, dikonfirmasi_pada)
  VALUES ('SO-TEST-KONFIRM', v_pelanggan_id, 'dikonfirmasi', v_sales_a_id, 100000, now())
  RETURNING id INTO v_pesanan_konfirm_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_pesanan_konfirm_id, v_barang_id, 2, 50000, 0, 100000);

  -- 3. Pesanan Dikirim oleh Sales A
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, total, dikonfirmasi_pada, dikirim_pada)
  VALUES ('SO-TEST-KIRIM-A', v_pelanggan_id, 'dikirim', v_sales_a_id, 100000, now(), now())
  RETURNING id INTO v_pesanan_dikirim_a_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_pesanan_dikirim_a_id, v_barang_id, 5, 20000, 0, 100000);

  -- 4. Pesanan Dikirim oleh Sales B
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, total, dikonfirmasi_pada, dikirim_pada)
  VALUES ('SO-TEST-KIRIM-B', v_pelanggan_id, 'dikirim', v_sales_b_id, 200000, now(), now())
  RETURNING id INTO v_pesanan_dikirim_b_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_pesanan_dikirim_b_id, v_barang_id, 10, 20000, 0, 200000);

  -- 5. Pesanan Lunas
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, total, dikirim_pada, dilunasi_pada)
  VALUES ('SO-TEST-LUNAS', v_pelanggan_id, 'lunas', v_sales_a_id, 100000, now(), now())
  RETURNING id INTO v_pesanan_lunas_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_pesanan_lunas_id, v_barang_id, 2, 50000, 0, 100000);

  -- 6. Pesanan Dibatalkan
  INSERT INTO public.pesanan_jual (nomor, pelanggan_id, status, dibuat_oleh, total, dibatalkan_pada, alasan_batal)
  VALUES ('SO-TEST-BATAL', v_pelanggan_id, 'dibatalkan', v_sales_a_id, 100000, now(), 'Alasan uji pembatalan')
  RETURNING id INTO v_pesanan_batal_id;

  INSERT INTO public.item_pesanan_jual (pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal)
  VALUES (v_pesanan_batal_id, v_barang_id, 2, 50000, 0, 100000);

  -- ----------------------------------------------------------
  -- PENGUJIAN PERAN: MANAJER (Melihat semua pesanan status 'dikirim')
  -- ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manajer_id::text, 'role', 'authenticated')::text, true);

  -- Manajer bisa melihat pesanan dikirim A dan B
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_dikirim_a_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-147 GAGAL: Manajer harus bisa melihat surat jalan pesanan dikirim A');

  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_dikirim_b_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-147 GAGAL: Manajer harus bisa melihat surat jalan pesanan dikirim B');

  -- Item pada pesanan dikirim terlihat oleh manajer
  SELECT count(*) INTO v_count FROM public.v_surat_jalan_item WHERE pesanan_jual_id = v_pesanan_dikirim_a_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-147 GAGAL: Manajer harus bisa melihat item pesanan dikirim');

  RAISE NOTICE 'TC-147: LULUS (Manajer berhasil mengakses surat jalan pesanan dikirim)';

  -- ----------------------------------------------------------
  -- PENGUJIAN STATUS NON-DIKIRIM (TC-150, TC-151, TC-152)
  -- ----------------------------------------------------------
  -- Draf harus 0 baris
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_draf_id;
  PERFORM pg_temp.assert(v_count = 0, 'TC-150 GAGAL: Pesanan draf tidak boleh muncul di v_surat_jalan');

  -- Dikonfirmasi harus 0 baris
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_konfirm_id;
  PERFORM pg_temp.assert(v_count = 0, 'TC-151 GAGAL: Pesanan dikonfirmasi tidak boleh muncul di v_surat_jalan');

  -- Lunas harus 0 baris
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_lunas_id;
  PERFORM pg_temp.assert(v_count = 0, 'TC-152 GAGAL: Pesanan lunas tidak boleh muncul di v_surat_jalan');

  -- Dibatalkan harus 0 baris
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_batal_id;
  PERFORM pg_temp.assert(v_count = 0, 'TC-152 GAGAL: Pesanan dibatalkan tidak boleh muncul di v_surat_jalan');

  RAISE NOTICE 'TC-150, TC-151, TC-152: LULUS (Status draf, dikonfirmasi, lunas, dibatalkan tidak muncul di v_surat_jalan)';

  -- ----------------------------------------------------------
  -- PENGUJIAN PERAN: GUDANG (TC-146)
  -- ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gudang_id::text, 'role', 'authenticated')::text, true);

  -- Gudang bisa melihat pesanan dikirim
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_dikirim_a_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-146 GAGAL: Gudang harus bisa melihat surat jalan pesanan dikirim');

  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_dikirim_b_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-146 GAGAL: Gudang harus bisa melihat surat jalan pesanan dikirim');

  -- Gudang tidak bisa melihat status draf atau dikonfirmasi di v_surat_jalan
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_draf_id;
  PERFORM pg_temp.assert(v_count = 0, 'Gudang tidak boleh melihat draf di v_surat_jalan');

  RAISE NOTICE 'TC-146: LULUS (Gudang berhasil mengakses surat jalan pesanan dikirim)';

  -- ----------------------------------------------------------
  -- PENGUJIAN PERAN: SALES A (TC-148 & TC-149)
  -- ----------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sales_a_id::text, 'role', 'authenticated')::text, true);

  -- Sales A BISA melihat pesanan dikirim miliknya (A)
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_dikirim_a_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-148 GAGAL: Sales pemilik harus bisa melihat surat jalan pesanan miliknya');

  SELECT count(*) INTO v_count FROM public.v_surat_jalan_item WHERE pesanan_jual_id = v_pesanan_dikirim_a_id;
  PERFORM pg_temp.assert(v_count = 1, 'TC-148 GAGAL: Sales pemilik harus bisa melihat item surat jalan pesanan miliknya');

  RAISE NOTICE 'TC-148: LULUS (Sales pemilik pesanan berhasil mengakses surat jalan)';

  -- Sales A TIDAK BISA melihat pesanan dikirim milik Sales B (TC-149)
  SELECT count(*) INTO v_count FROM public.v_surat_jalan WHERE id = v_pesanan_dikirim_b_id;
  PERFORM pg_temp.assert(v_count = 0, 'TC-149 GAGAL: Sales bukan pemilik DILARANG melihat surat jalan sales lain');

  SELECT count(*) INTO v_count FROM public.v_surat_jalan_item WHERE pesanan_jual_id = v_pesanan_dikirim_b_id;
  PERFORM pg_temp.assert(v_count = 0, 'TC-149 GAGAL: Sales bukan pemilik DILARANG melihat item surat jalan sales lain');

  RAISE NOTICE 'TC-149: LULUS (Sales bukan pemilik ditolak melihat surat jalan sales lain)';
END $$;

ROLLBACK;
