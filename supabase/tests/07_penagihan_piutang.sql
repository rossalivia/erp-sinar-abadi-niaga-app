-- ============================================================
-- SUITE UJI FITUR PENAGIHAN PIUTANG & MONITORING JATUH TEMPO
-- File: supabase/tests/07_penagihan_piutang.sql
-- Memverifikasi BR-15 s.d. BR-18 dan TC-71 s.d. TC-83, TC-88
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_penagihan (
  nomor serial,
  kode_br text,
  kode_tc text,
  deskripsi text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_penagihan TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_today date;
  v_res text;
  v_count integer;
  v_catatan_id uuid;
  v_plg_id uuid := 'b1111111-0000-0000-0000-000000000001'; -- Toko Berkah Mandiri
  v_plg_lain uuid := 'b1111111-0000-0000-0000-000000000002'; -- Minimarket Sejahtera
  v_so_sales1 uuid;
  v_so_sales2 uuid;
  v_so_lunas uuid;
  v_res_json jsonb;
  v_status_janji text;
  -- Akun uji seed
  v_user_manajer uuid := '33333333-3333-3333-3333-333333333333';
  v_user_sales1 uuid := '11111111-1111-1111-1111-111111111111';
  v_user_sales2 uuid := '11111111-1111-1111-1111-111111111112';
  v_user_gudang uuid := '22222222-2222-2222-2222-222222222222';
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  -- ============================================================
  -- TC-71: Klasifikasi hari_ini (jatuh_tempo = v_today)
  -- ============================================================
  v_res := public.fn_klasifikasi_tagihan(v_today, v_today);
  IF v_res = 'hari_ini' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-71', 'Klasifikasi hari_ini tepat dan belum dihitung overdue', 'PASS', v_res);
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-71', 'Klasifikasi hari_ini tepat dan belum dihitung overdue', 'FAIL', 'Diterima: ' || COALESCE(v_res, 'NULL'));
  END IF;

  -- ============================================================
  -- TC-72: Klasifikasi segera (jatuh_tempo v_today + 1 s.d. +3)
  -- ============================================================
  IF public.fn_klasifikasi_tagihan(v_today + 1, v_today) = 'segera'
     AND public.fn_klasifikasi_tagihan(v_today + 2, v_today) = 'segera'
     AND public.fn_klasifikasi_tagihan(v_today + 3, v_today) = 'segera' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-72', 'Klasifikasi segera konsisten pada rentang 1 s.d. 3 hari ke depan', 'PASS', 'segera');
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-72', 'Klasifikasi segera konsisten pada rentang 1 s.d. 3 hari ke depan', 'FAIL', 'Gagal memetakan v_today + 1..3 ke segera');
  END IF;

  -- ============================================================
  -- TC-73: Klasifikasi belum_jatuh_tempo (jatuh_tempo v_today + 4)
  -- ============================================================
  v_res := public.fn_klasifikasi_tagihan(v_today + 4, v_today);
  IF v_res = 'belum_jatuh_tempo' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-73', 'Klasifikasi belum_jatuh_tempo tepat untuk > 3 hari ke depan', 'PASS', v_res);
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-73', 'Klasifikasi belum_jatuh_tempo tepat untuk > 3 hari ke depan', 'FAIL', 'Diterima: ' || COALESCE(v_res, 'NULL'));
  END IF;

  -- ============================================================
  -- TC-74: Klasifikasi overdue_1_7 (jatuh_tempo v_today - 1 s.d. -7)
  -- ============================================================
  IF public.fn_klasifikasi_tagihan(v_today - 1, v_today) = 'overdue_1_7'
     AND public.fn_klasifikasi_tagihan(v_today - 7, v_today) = 'overdue_1_7' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-74', 'Klasifikasi overdue_1_7 presisi pada hari ke-1 s.d. ke-7 lewat tempo', 'PASS', 'overdue_1_7');
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-74', 'Klasifikasi overdue_1_7 presisi pada hari ke-1 s.d. ke-7 lewat tempo', 'FAIL', 'Gagal memetakan v_today - 1..7 ke overdue_1_7');
  END IF;

  -- ============================================================
  -- TC-75: Klasifikasi overdue_8_30 (jatuh_tempo v_today - 8 s.d. -30)
  -- ============================================================
  IF public.fn_klasifikasi_tagihan(v_today - 8, v_today) = 'overdue_8_30'
     AND public.fn_klasifikasi_tagihan(v_today - 30, v_today) = 'overdue_8_30' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-75', 'Klasifikasi overdue_8_30 presisi pada hari ke-8 s.d. ke-30 lewat tempo', 'PASS', 'overdue_8_30');
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-75', 'Klasifikasi overdue_8_30 presisi pada hari ke-8 s.d. ke-30 lewat tempo', 'FAIL', 'Gagal memetakan v_today - 8..30 ke overdue_8_30');
  END IF;

  -- ============================================================
  -- TC-76: Klasifikasi overdue_lebih_30 (jatuh_tempo v_today - 31)
  -- ============================================================
  v_res := public.fn_klasifikasi_tagihan(v_today - 31, v_today);
  IF v_res = 'overdue_lebih_30' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-76', 'Klasifikasi overdue_lebih_30 tepat untuk keterlambatan > 30 hari', 'PASS', v_res);
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-16', 'TC-76', 'Klasifikasi overdue_lebih_30 tepat untuk keterlambatan > 30 hari', 'FAIL', 'Diterima: ' || COALESCE(v_res, 'NULL'));
  END IF;

  -- ============================================================
  -- DATA SETUP UNTUK UJI INTEGRASI VIEW & RPC
  -- ============================================================
  -- Buat pesanan terkirim untuk Sales 1
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  ) VALUES (
    gen_random_uuid(), 'SO-TEST-TAGIHAN-S1', v_plg_id, 'dikirim', 500000,
    v_user_sales1, now() - interval '5 days', now() - interval '5 days', v_today - 2
  ) RETURNING id INTO v_so_sales1;

  -- Buat pesanan terkirim untuk Sales 2
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  ) VALUES (
    gen_random_uuid(), 'SO-TEST-TAGIHAN-S2', v_plg_lain, 'dikirim', 750000,
    v_user_sales2, now() - interval '2 days', now() - interval '2 days', v_today + 2
  ) RETURNING id INTO v_so_sales2;

  -- ============================================================
  -- TC-77: Isolasi Visibilitas Penjualan pada v_tagihan
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_sales1::text)::text, true);

  SELECT count(*) INTO v_count FROM public.v_tagihan WHERE pesanan_id = v_so_sales2;
  IF v_count = 0 THEN
    SELECT count(*) INTO v_count FROM public.v_tagihan WHERE pesanan_id = v_so_sales1;
    IF v_count = 1 THEN
      INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
      VALUES ('BR-15', 'TC-77', 'Penjualan hanya melihat faktur pesanannya sendiri, faktur orang lain terisolasi', 'PASS', '1 tagihan terlihat');
    ELSE
      INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
      VALUES ('BR-15', 'TC-77', 'Penjualan hanya melihat faktur pesanannya sendiri, faktur orang lain terisolasi', 'FAIL', 'Faktur sendiri tidak terbaca');
    END IF;
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-15', 'TC-77', 'Penjualan hanya melihat faktur pesanannya sendiri, faktur orang lain terisolasi', 'FAIL', 'BOCOR: Faktur sales 2 terlihat oleh sales 1');
  END IF;

  -- ============================================================
  -- TC-78: Pemblokiran Total Akses Gudang (v_tagihan & RPC)
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_gudang::text)::text, true);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_catat_penagihan(v_plg_id, v_so_sales1, 'catatan', 'Catatan oleh staf gudang');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Akses ditolak%' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('RBAC', 'TC-78', 'Gudang ditolak saat memanggil rpc_catat_penagihan', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('RBAC', 'TC-78', 'Gudang ditolak saat memanggil rpc_catat_penagihan', 'FAIL', COALESCE(v_msg, 'Gudang berhasil catat penagihan!'));
  END IF;

  -- ============================================================
  -- TC-79: Hak Akses Penuh Manajer pada v_tagihan
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_manajer::text)::text, true);

  SELECT count(*) INTO v_count FROM public.v_tagihan WHERE pesanan_id IN (v_so_sales1, v_so_sales2);
  IF v_count = 2 THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-15', 'TC-79', 'Manajer membaca seluruh faktur lintas seluruh staf penjualan', 'PASS', '2 dari 2 terbaca');
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-15', 'TC-79', 'Manajer membaca seluruh faktur lintas seluruh staf penjualan', 'FAIL', 'Hanya terbaca: ' || v_count);
  END IF;

  -- ============================================================
  -- TC-80: Trigger Guard Append-Only pada catatan_penagihan
  -- ============================================================
  -- Masukkan 1 catatan sah lewat RPC oleh Manajer
  v_res_json := public.rpc_catat_penagihan(v_plg_id, v_so_sales1, 'catatan', 'Catatan awal penagihan sah');
  v_catatan_id := (v_res_json->>'id')::uuid;

  v_err := false; v_msg := NULL;
  BEGIN
    UPDATE public.catatan_penagihan SET isi = 'Isi diubah ilegal' WHERE id = v_catatan_id;
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Catatan penagihan bersifat permanen%' THEN
    v_err := false; v_msg := NULL;
    BEGIN
      DELETE FROM public.catatan_penagihan WHERE id = v_catatan_id;
    EXCEPTION WHEN OTHERS THEN
      v_err := true; v_msg := SQLERRM;
    END;

    IF v_err AND v_msg LIKE '%Catatan penagihan bersifat permanen%' THEN
      INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
      VALUES ('BR-17', 'TC-80', 'Tabel catatan_penagihan append-only (UPDATE & DELETE diblokir trigger)', 'PASS', 'Tolak UPDATE & DELETE');
    ELSE
      INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
      VALUES ('BR-17', 'TC-80', 'Tabel catatan_penagihan append-only (UPDATE & DELETE diblokir trigger)', 'FAIL', 'DELETE berhasil lolos');
    END IF;
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-17', 'TC-80', 'Tabel catatan_penagihan append-only (UPDATE & DELETE diblokir trigger)', 'FAIL', 'UPDATE berhasil lolos');
  END IF;

  -- ============================================================
  -- TC-81: Validasi Panjang Isi Catatan Penagihan (3 s.d. 500 Char)
  -- ============================================================
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_catat_penagihan(v_plg_id, v_so_sales1, 'catatan', 'ok');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Catatan penagihan minimal 3 karakter%' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-17', 'TC-81', 'Validasi isi catatan < 3 karakter ditolak E0047', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-17', 'TC-81', 'Validasi isi catatan < 3 karakter ditolak E0047', 'FAIL', COALESCE(v_msg, 'Catatan 2 karakter berhasil'));
  END IF;

  -- ============================================================
  -- TC-82: Validasi Janji Bayar Wajib Tanggal & Larangan Masa Lalu
  -- ============================================================
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_catat_penagihan(v_plg_id, v_so_sales1, 'janji_bayar', 'Janji bayar tanpa tanggal', NULL);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Tanggal janji bayar wajib diisi%' THEN
    v_err := false; v_msg := NULL;
    BEGIN
      PERFORM public.rpc_catat_penagihan(v_plg_id, v_so_sales1, 'janji_bayar', 'Janji bayar kemarin', v_today - 1);
    EXCEPTION WHEN OTHERS THEN
      v_err := true; v_msg := SQLERRM;
    END;

    IF v_err AND v_msg LIKE '%Tanggal janji bayar tidak boleh di masa lalu%' THEN
      INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
      VALUES ('BR-17', 'TC-82', 'Janji bayar wajib tanggal dan tidak boleh di masa lalu', 'PASS', 'Tolak NULL & Masa Lalu');
    ELSE
      INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
      VALUES ('BR-17', 'TC-82', 'Janji bayar wajib tanggal dan tidak boleh di masa lalu', 'FAIL', 'Janji bayar masa lalu diterima');
    END IF;
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-17', 'TC-82', 'Janji bayar wajib tanggal dan tidak boleh di masa lalu', 'FAIL', 'Janji bayar tanpa tanggal diterima');
  END IF;

  -- ============================================================
  -- TC-83: Deteksi Dinamis Status Janji Terlewat
  -- ============================================================
  -- Masukkan janji bayar kemarin secara simulasi via insert langsung di database internal test
  -- Untuk menguji logika CASE view tanpa melewati rpc validasi masa lalu:
  ALTER TABLE public.catatan_penagihan DISABLE TRIGGER trg_catatan_penagihan_guard;
  INSERT INTO public.catatan_penagihan (
    pelanggan_id, pesanan_jual_id, jenis, isi, janji_bayar_tanggal, dibuat_oleh, dibuat_pada
  ) VALUES (
    v_plg_id, v_so_sales1, 'janji_bayar', 'Janji bayar kemarin yang belum lunas', v_today - 1, v_user_sales1, now() - interval '2 days'
  );
  ALTER TABLE public.catatan_penagihan ENABLE TRIGGER trg_catatan_penagihan_guard;

  SELECT status_janji INTO v_status_janji FROM public.v_tagihan WHERE pesanan_id = v_so_sales1;
  IF v_status_janji = 'terlewat' THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-17', 'TC-83', 'Janji bayar bertanggal lewat pada faktur belum lunas dideteksi terlewat', 'PASS', v_status_janji);
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-17', 'TC-83', 'Janji bayar bertanggal lewat pada faktur belum lunas dideteksi terlewat', 'FAIL', 'Diterima: ' || COALESCE(v_status_janji, 'NULL'));
  END IF;

  -- ============================================================
  -- TC-88: Dampak Pelunasan Manajer terhadap Daftar Tagihan
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_manajer::text)::text, true);

  -- Lunaskan v_so_sales1 via rpc_catat_pelunasan
  PERFORM public.rpc_catat_pelunasan(v_so_sales1);

  SELECT count(*) INTO v_count FROM public.v_tagihan WHERE pesanan_id = v_so_sales1;
  IF v_count = 0 THEN
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-07', 'TC-88', 'Faktur yang telah dicatat lunas seketika hilang dari v_tagihan', 'PASS', '0 faktur tersisa');
  ELSE
    INSERT INTO hasil_uji_penagihan (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-07', 'TC-88', 'Faktur yang telah dicatat lunas seketika hilang dari v_tagihan', 'FAIL', 'Faktur lunas masih muncul di tagihan');
  END IF;

END $$;

SELECT nomor, kode_br, kode_tc, deskripsi, status, pesan FROM hasil_uji_penagihan ORDER BY nomor;

ROLLBACK;
