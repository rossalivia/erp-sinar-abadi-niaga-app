-- ============================================================
-- Test Suite 12: Notifikasi Email Stok Menipis Harian (PRD 11.1)
-- Menguji: TC-156 s.d. TC-160, TC-162, TC-163, TC-170, TC-171
-- ============================================================

BEGIN;

-- Setup Data Uji Khusus
-- 1. Buat barang uji untuk memvalidasi kriteria stok menipis (E1)
INSERT INTO public.barang (id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
VALUES
  ('c9999999-0000-0000-0000-000000000001', 'TST-EQ', 'Barang Stok Sama Min', 'pcs', 10000, 8000, 10, 10, true),   -- TC-156: stok = minimum (10 <= 10)
  ('c9999999-0000-0000-0000-000000000002', 'TST-GT', 'Barang Stok Di Atas Min', 'pcs', 10000, 8000, 15, 10, true),  -- TC-157: stok > minimum (15 > 10)
  ('c9999999-0000-0000-0000-000000000003', 'TST-OFF', 'Barang Nonaktif Rendah', 'pcs', 10000, 8000, 2, 10, false), -- TC-158: nonaktif (2 <= 10 tapi nonaktif)
  ('c9999999-0000-0000-0000-000000000004', 'TST-ZERO', 'Barang Nol dan Nol', 'pcs', 10000, 8000, 0, 0, true)        -- TC-159: stok 0, min 0 (0 <= 0)
ON CONFLICT (id) DO UPDATE
SET stok = EXCLUDED.stok, stok_minimum = EXCLUDED.stok_minimum, aktif = EXCLUDED.aktif;

-- ------------------------------------------------------------
-- TC-156: Barang Stok Sama Dengan Minimum Disertakan
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rpc_sistem_daftar_stok_menipis()
  WHERE kode = 'TST-EQ';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TC-156 GAGAL: Barang dengan stok = minimum seharusnya disertakan';
  END IF;
  RAISE NOTICE 'TC-156 LULUS: Barang stok = minimum berhasil disertakan';
END $$;

-- ------------------------------------------------------------
-- TC-157: Barang Stok Di Atas Minimum Dieksklusi
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rpc_sistem_daftar_stok_menipis()
  WHERE kode = 'TST-GT';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TC-157 GAGAL: Barang dengan stok > minimum seharusnya dieksklusi';
  END IF;
  RAISE NOTICE 'TC-157 LULUS: Barang stok > minimum berhasil dieksklusi';
END $$;

-- ------------------------------------------------------------
-- TC-158: Barang Nonaktif Dieksklusi dari Daftar
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rpc_sistem_daftar_stok_menipis()
  WHERE kode = 'TST-OFF';

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TC-158 GAGAL: Barang nonaktif seharusnya dieksklusi';
  END IF;
  RAISE NOTICE 'TC-158 LULUS: Barang nonaktif berhasil dieksklusi';
END $$;

-- ------------------------------------------------------------
-- TC-159: Barang Stok Nol dan Minimum Nol Disertakan (0 <= 0)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.rpc_sistem_daftar_stok_menipis()
  WHERE kode = 'TST-ZERO';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TC-159 GAGAL: Barang dengan stok 0 dan min 0 seharusnya disertakan (0 <= 0)';
  END IF;
  RAISE NOTICE 'TC-159 LULUS: Barang stok 0 dan min 0 berhasil disertakan';
END $$;

-- ------------------------------------------------------------
-- TC-160: Penerima Notifikasi Hanya Manajer dan Gudang Aktif
-- ------------------------------------------------------------
DO $$
DECLARE
  v_penjualan_count integer;
  v_nonaktif_count integer;
  v_manajer_count integer;
  v_gudang_count integer;
BEGIN
  SELECT count(*) INTO v_penjualan_count
  FROM public.rpc_sistem_penerima_notifikasi_stok()
  WHERE peran = 'penjualan';

  IF v_penjualan_count > 0 THEN
    RAISE EXCEPTION 'TC-160 GAGAL: Penjualan tidak boleh menerima notifikasi stok';
  END IF;

  SELECT count(*) INTO v_nonaktif_count
  FROM public.rpc_sistem_penerima_notifikasi_stok()
  WHERE email = 'nonaktif@sinarabadi.test';

  IF v_nonaktif_count > 0 THEN
    RAISE EXCEPTION 'TC-160 GAGAL: Akun nonaktif tidak boleh menerima notifikasi';
  END IF;

  SELECT count(*) INTO v_manajer_count
  FROM public.rpc_sistem_penerima_notifikasi_stok()
  WHERE email = 'manajer@sinarabadi.test';

  SELECT count(*) INTO v_gudang_count
  FROM public.rpc_sistem_penerima_notifikasi_stok()
  WHERE email = 'gudang@sinarabadi.test';

  IF v_manajer_count = 0 OR v_gudang_count = 0 THEN
    RAISE EXCEPTION 'TC-160 GAGAL: Manajer dan Gudang aktif harus terdaftar sebagai penerima';
  END IF;

  RAISE NOTICE 'TC-160 LULUS: Daftar penerima hanya manajer dan gudang aktif';
END $$;

-- ------------------------------------------------------------
-- TC-162: Idempotensi Harian (Klaim Ganda Tanggal Sama)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_res1 record;
  v_res2 record;
  v_test_date date := '2026-10-25'::date;
BEGIN
  -- Bersihkan log tanggal uji jika ada
  DELETE FROM public.notifikasi_email_log
  WHERE jenis = 'stok_menipis' AND tanggal_bisnis = v_test_date;

  -- Panggilan 1: Harus boleh kirim
  SELECT * INTO v_res1
  FROM public.rpc_sistem_klaim_notifikasi('stok_menipis', v_test_date);

  IF v_res1.boleh_kirim <> true OR v_res1.log_id IS NULL THEN
    RAISE EXCEPTION 'TC-162 GAGAL: Klaim pertama seharusnya berhasil';
  END IF;

  -- Selesaikan panggilan 1 sebagai 'terkirim'
  PERFORM public.rpc_sistem_selesaikan_notifikasi(v_res1.log_id, 'terkirim', 5, 2, NULL);

  -- Panggilan 2: Harus ditolak (boleh_kirim = false)
  SELECT * INTO v_res2
  FROM public.rpc_sistem_klaim_notifikasi('stok_menipis', v_test_date);

  IF v_res2.boleh_kirim <> false THEN
    RAISE EXCEPTION 'TC-162 GAGAL: Klaim kedua pada tanggal sama harus ditolak (idempotensi)';
  END IF;

  RAISE NOTICE 'TC-162 LULUS: Idempotensi harian berhasil mencegah klaim ganda';
END $$;

-- ------------------------------------------------------------
-- TC-163: Retry pada Status 'gagal' Diizinkan
-- ------------------------------------------------------------
DO $$
DECLARE
  v_res1 record;
  v_res2 record;
  v_test_date date := '2026-10-26'::date;
BEGIN
  -- Bersihkan log tanggal uji
  DELETE FROM public.notifikasi_email_log
  WHERE jenis = 'stok_menipis' AND tanggal_bisnis = v_test_date;

  -- Panggilan 1: Klaim
  SELECT * INTO v_res1
  FROM public.rpc_sistem_klaim_notifikasi('stok_menipis', v_test_date);

  -- Tandai panggilan 1 sebagai 'gagal'
  PERFORM public.rpc_sistem_selesaikan_notifikasi(v_res1.log_id, 'gagal', 5, 2, 'Koneksi Resend timeout');

  -- Panggilan 2: Harus diizinkan retry (boleh_kirim = true)
  SELECT * INTO v_res2
  FROM public.rpc_sistem_klaim_notifikasi('stok_menipis', v_test_date);

  IF v_res2.boleh_kirim <> true OR v_res2.log_id <> v_res1.log_id THEN
    RAISE EXCEPTION 'TC-163 GAGAL: Retry pada log berstatus gagal seharusnya diizinkan';
  END IF;

  RAISE NOTICE 'TC-163 LULUS: Retry klaim setelah kegagalan berhasil diizinkan';
END $$;

-- ------------------------------------------------------------
-- TC-170: Hak Akses Database (rpc_sistem_* Ditolak untuk authenticated & anon)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_has_exec boolean;
BEGIN
  -- Periksa apakah role authenticated memiliki hak execute pada rpc_sistem_daftar_stok_menipis
  SELECT has_function_privilege('authenticated', 'public.rpc_sistem_daftar_stok_menipis()', 'EXECUTE')
  INTO v_has_exec;

  IF v_has_exec THEN
    RAISE EXCEPTION 'TC-170 GAGAL: authenticated tidak boleh memiliki hak EXECUTE pada rpc_sistem_daftar_stok_menipis';
  END IF;

  -- Periksa anon
  SELECT has_function_privilege('anon', 'public.rpc_sistem_daftar_stok_menipis()', 'EXECUTE')
  INTO v_has_exec;

  IF v_has_exec THEN
    RAISE EXCEPTION 'TC-170 GAGAL: anon tidak boleh memiliki hak EXECUTE pada rpc_sistem_daftar_stok_menipis';
  END IF;

  -- Periksa service_role
  SELECT has_function_privilege('service_role', 'public.rpc_sistem_daftar_stok_menipis()', 'EXECUTE')
  INTO v_has_exec;

  IF NOT v_has_exec THEN
    RAISE EXCEPTION 'TC-170 GAGAL: service_role wajib memiliki hak EXECUTE pada rpc_sistem_daftar_stok_menipis';
  END IF;

  RAISE NOTICE 'TC-170 LULUS: Hak akses rpc_sistem_* terisolasi hanya untuk service_role';
END $$;

-- ------------------------------------------------------------
-- TC-171: Otorisasi Riwayat Notifikasi Manajer
-- ------------------------------------------------------------
DO $$
DECLARE
  v_manajer_id uuid := '33333333-3333-3333-3333-333333333333';
  v_penjualan_id uuid := '11111111-1111-1111-1111-111111111111';
  v_count integer;
  v_err boolean := false;
BEGIN
  -- Tes sebagai Manajer: Berhasil
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_count
  FROM public.rpc_riwayat_notifikasi_manajer();

  RAISE NOTICE 'TC-171 (Manajer): Sukses membaca riwayat log (% baris)', v_count;

  -- Tes sebagai Penjualan: Ditolak dengan E0001
  PERFORM set_config('request.jwt.claim.sub', v_penjualan_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    PERFORM * FROM public.rpc_riwayat_notifikasi_manajer();
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0001' THEN
      v_err := true;
    ELSE
      RAISE EXCEPTION 'TC-171 GAGAL: Error code bukan E0001 melainkan %', SQLSTATE;
    END IF;
  END;

  IF NOT v_err THEN
    RAISE EXCEPTION 'TC-171 GAGAL: Penjualan seharusnya ditolak saat memanggil rpc_riwayat_notifikasi_manajer';
  END IF;

  RAISE NOTICE 'TC-171 LULUS: rpc_riwayat_notifikasi_manajer menolak Penjualan dengan E0001';
END $$;

ROLLBACK;
