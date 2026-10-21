-- ============================================================
-- SUITE UJI MODUL LIMIT KREDIT DINAMIS & BLOKIR OTOMATIS
-- File: supabase/tests/04_kredit_overdue.sql
-- Memverifikasi BR-13, BR-14, D1 s.d. D9, dan Test Case TC-29 s.d. TC-39
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_kredit (
  nomor serial,
  kode_br text,
  kode_tc text,
  deskripsi text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_kredit TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_err boolean := false;
  v_msg text;
  v_so jsonb;
  v_so_id uuid;
  v_so_id2 uuid;
  v_plg_id uuid;
  v_plg_overdue uuid;
  v_brg_id uuid := 'c1111111-0000-0000-0000-000000000001'; -- BRG-A: harga 10.000, stok 100
  v_kredit record;
  v_today date;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  -- Persiapan Pelanggan Uji Khusus Suite Ini
  -- PLG-KREDIT-1: batas kredit Rp100.000, termin 14
  INSERT INTO public.pelanggan (
    id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh
  )
  VALUES (
    'b2222222-0000-0000-0000-000000000001', 'PLG-KREDIT-1', 'Toko Uji Kredit 1',
    '0812345678', 'Bekasi', 100000, 14, true, '33333333-3333-3333-3333-333333333333'
  )
  ON CONFLICT (id) DO UPDATE SET batas_kredit = 100000, aktif = true;

  v_plg_id := 'b2222222-0000-0000-0000-000000000001';

  -- PLG-KREDIT-2: batas kredit Rp500.000, termin 14
  INSERT INTO public.pelanggan (
    id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh
  )
  VALUES (
    'b2222222-0000-0000-0000-000000000002', 'PLG-KREDIT-2', 'Toko Uji Kredit Overdue',
    '0812345679', 'Bekasi', 500000, 14, true, '33333333-3333-3333-3333-333333333333'
  )
  ON CONFLICT (id) DO UPDATE SET batas_kredit = 500000, aktif = true;

  v_plg_overdue := 'b2222222-0000-0000-0000-000000000002';

  -- Bersihkan pesanan uji sebelumnya untuk dua pelanggan ini
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
    SELECT id FROM public.pesanan_jual WHERE pelanggan_id IN (v_plg_id, v_plg_overdue)
  );
  DELETE FROM public.pesanan_jual WHERE pelanggan_id IN (v_plg_id, v_plg_overdue);

  -- ============================================================
  -- TC-29: Total pesanan = sisa kredit persis -> Berhasil (D7)
  -- ============================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- Buat pesanan: 10 item BRG-A x Rp10.000 = Rp100.000 (persis batas kredit Rp100.000)
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 10, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF NOT v_err THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-29', 'Total pesanan = sisa kredit persis (Rp100.000) -> Sukses', 'PASS', 'Konfirmasi berhasil');
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-29', 'Total pesanan = sisa kredit persis (Rp100.000) -> Sukses', 'FAIL', v_msg);
  END IF;

  -- ============================================================
  -- TC-30: Total pesanan = sisa kredit + Rp1 -> Ditolak E0006 (D7)
  -- ============================================================
  -- Sisa kredit sekarang Rp0 (karena ada pesanan terkonfirmasi Rp100.000).
  -- Pesanan baru Rp10.000 (1 unit) -> pasti melebihi plafon.
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id2 := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id2, v_brg_id, 1, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id2);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%E0006: Batas kredit pelanggan terlampaui%' THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-30', 'Total pesanan melebihi sisa kredit ditolak dengan E0006', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-30', 'Total pesanan melebihi sisa kredit ditolak dengan E0006', 'FAIL', COALESCE(v_msg, 'Berhasil konfirmasi melebihi plafon!'));
  END IF;

  -- ============================================================
  -- TC-31: Ada faktur overdue padahal sisa kredit cukup -> Ditolak E0007
  -- ============================================================
  -- Set fixture pesanan dikirim dengan jatuh_tempo = kemarin pada PLG-KREDIT-2
  RESET ROLE;
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-OD-1', v_plg_overdue, 'dikirim', 50000, '11111111-1111-1111-1111-111111111111',
    now() - interval '20 days', now() - interval '20 days', v_today - 1
  );

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- PLG-KREDIT-2 punya limit Rp500.000, terpakai Rp50.000, sisa Rp450.000 (cukup banyak).
  -- Pesanan baru hanya Rp20.000 (2 unit).
  v_so := public.rpc_buat_pesanan(v_plg_overdue);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 2, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir%' THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-31', 'Ada faktur overdue sisa kredit cukup ditolak E0007', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-31', 'Ada faktur overdue sisa kredit cukup ditolak E0007', 'FAIL', COALESCE(v_msg, 'Berhasil konfirmasi saat ada overdue!'));
  END IF;

  -- ============================================================
  -- TC-32: Kedua kondisi sekaligus (Overdue + Melebihi Plafon) -> Ditolak E0007 (D4)
  -- ============================================================
  -- Buat pesanan baru Rp600.000 (60 unit > batas Rp500.000) pada PLG-KREDIT-2 (yang punya overdue)
  v_so := public.rpc_buat_pesanan(v_plg_overdue);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 60, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir%' THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-32', 'Prioritas D4: Overdue dan overlimit sekaligus -> Error E0007', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-32', 'Prioritas D4: Overdue dan overlimit sekaligus -> Error E0007', 'FAIL', COALESCE(v_msg, 'Tidak menghasilkan E0007'));
  END IF;

  -- ============================================================
  -- TC-33: Batas Tanggal Overdue (D2)
  -- ============================================================
  -- Uji batas hari ini: buat pesanan dikirim dengan jatuh tempo = HARI INI
  RESET ROLE;
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id IN (
    SELECT id FROM public.pesanan_jual WHERE pelanggan_id = v_plg_overdue
  );
  DELETE FROM public.pesanan_jual WHERE pelanggan_id = v_plg_overdue;

  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-TODAY', v_plg_overdue, 'dikirim', 50000, '11111111-1111-1111-1111-111111111111',
    now() - interval '5 days', now() - interval '5 days', v_today
  );

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  -- Pesanan baru Rp20.000 -> harusnya SUKSES karena jatuh_tempo = hari ini belum lewat tempo
  v_so := public.rpc_buat_pesanan(v_plg_overdue);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 2, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF NOT v_err THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-33', 'Jatuh tempo = hari ini (Asia/Jakarta) belum dianggap overdue -> Sukses', 'PASS', 'Konfirmasi berhasil');
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-33', 'Jatuh tempo = hari ini (Asia/Jakarta) belum dianggap overdue -> Sukses', 'FAIL', v_msg);
  END IF;

  -- ============================================================
  -- TC-34: Pesanan dikonfirmasi belum dikirim -> tidak overdue tapi masuk piutang (D1)
  -- ============================================================
  -- v_so_id saat ini berstatus 'dikonfirmasi' sebesar Rp20.000. Ditambah SO-TEST-TODAY Rp50.000 = total piutang Rp70.000.
  SELECT * INTO v_kredit FROM public.fn_hitung_kredit_pelanggan(v_plg_overdue);
  IF v_kredit.piutang_terkonfirmasi = 20000 AND v_kredit.piutang_berjalan = 70000 AND v_kredit.punya_overdue = false THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-34', 'Dikonfirmasi belum dikirim masuk piutang tapi tidak overdue', 'PASS', format('Terkonfirmasi: %s, Piutang: %s', v_kredit.piutang_terkonfirmasi, v_kredit.piutang_berjalan));
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-34', 'Dikonfirmasi belum dikirim masuk piutang tapi tidak overdue', 'FAIL', format('Terkonfirmasi: %s, Piutang: %s', v_kredit.piutang_terkonfirmasi, v_kredit.piutang_berjalan));
  END IF;

  -- ============================================================
  -- TC-35: Pelunasan faktur menunggak oleh Manajer membuka blokir (Alur B2)
  -- ============================================================
  -- Buat faktur overdue kemarin
  RESET ROLE;
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'e1111111-0000-0000-0000-000000000099', 'SO-OD-BAYAR', v_plg_overdue, 'dikirim', 30000,
    '11111111-1111-1111-1111-111111111111', now() - interval '10 days', now() - interval '10 days', v_today - 1
  );

  -- Manajer melunasi pesanan menunggak
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  PERFORM public.rpc_catat_pelunasan('e1111111-0000-0000-0000-000000000099');

  -- Staf Penjualan konfirmasi pesanan baru -> Sekarang harusnya sukses!
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  v_so := public.rpc_buat_pesanan(v_plg_overdue);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 1, 0);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF NOT v_err THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-35', 'Pelunasan faktur overdue oleh Manajer membuka blokir pesanan baru', 'PASS', 'Konfirmasi berhasil setelah pelunasan');
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-14', 'TC-35', 'Pelunasan faktur overdue oleh Manajer membuka blokir pesanan baru', 'FAIL', v_msg);
  END IF;

  -- ============================================================
  -- TC-36: Manajer menaikkan batas kredit membuka blokir plafon (Alur B1)
  -- ============================================================
  -- PLG-KREDIT-1 memiliki batas kredit Rp100.000 dan piutang Rp100.000 (sisa Rp0).
  -- Draf baru Rp50.000 terblokir E0006.
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 5, 0);

  -- Manajer menaikkan batas kredit menjadi Rp200.000
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  PERFORM public.rpc_set_batas_kredit(v_plg_id, 200000);

  -- Penjualan mengonfirmasi draf -> Sekarang harusnya sukses!
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF NOT v_err THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-36', 'Manajer menaikkan batas kredit membuka blokir konfirmasi pesanan', 'PASS', 'Konfirmasi berhasil setelah limit dinaikkan');
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-36', 'Manajer menaikkan batas kredit membuka blokir konfirmasi pesanan', 'FAIL', v_msg);
  END IF;

  -- ============================================================
  -- TC-37: Manajer juga diblokir saat overlimit / overdue (D5 Non-Bypass)
  -- ============================================================
  -- Buat pesanan baru Rp300.000 pada PLG-KREDIT-1 (piutang sudah Rp150.000, limit Rp200.000)
  v_so := public.rpc_buat_pesanan(v_plg_id);
  v_so_id := (v_so->>'id')::uuid;
  PERFORM public.rpc_simpan_item_pesanan(v_so_id, v_brg_id, 30, 0);

  -- Manajer mencoba mengonfirmasi langsung
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%E0006: Batas kredit pelanggan terlampaui%' THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-37', 'Manajer juga ditolak E0006 tanpa bypass peran (D5)', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('BR-13', 'TC-37', 'Manajer juga ditolak E0006 tanpa bypass peran (D5)', 'FAIL', COALESCE(v_msg, 'Manajer berhasil bypass limit kredit!'));
  END IF;

  -- ============================================================
  -- TC-38: Staf Penjualan dilarang ubah batas kredit atau pelunasan
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);

  v_err := false; v_msg := NULL;
  BEGIN
    PERFORM public.rpc_set_batas_kredit(v_plg_id, 9999999);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
  END;

  IF v_err AND v_msg LIKE '%Akses ditolak%' THEN
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('RBAC', 'TC-38', 'Penjualan ditolak saat mencoba ubah batas kredit', 'PASS', v_msg);
  ELSE
    INSERT INTO hasil_uji_kredit (kode_br, kode_tc, deskripsi, status, pesan)
    VALUES ('RBAC', 'TC-38', 'Penjualan ditolak saat mencoba ubah batas kredit', 'FAIL', COALESCE(v_msg, 'Penjualan berhasil ubah batas kredit!'));
  END IF;

END $$;

SELECT nomor, kode_br, kode_tc, deskripsi, status, pesan FROM hasil_uji_kredit ORDER BY nomor;

ROLLBACK;
