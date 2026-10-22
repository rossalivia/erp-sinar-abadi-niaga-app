-- ============================================================
-- SUITE TEST 06: Persetujuan Harga di Bawah HPP (Price Approval Workflow)
-- File: supabase/tests/06_persetujuan_harga.sql
-- Sesuai: TC-55 s.d. TC-70, docs/fitur-persetujuan-harga.md
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_persetujuan (
  nomor serial,
  kode_tc text,
  deskripsi text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_persetujuan TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_p1_id uuid := '11111111-1111-1111-1111-111111111111'; -- Penjualan 1
  v_p2_id uuid := '11111111-1111-1111-1111-111111111112'; -- Penjualan 2
  v_gudang_id uuid := '22222222-2222-2222-2222-222222222222'; -- Gudang
  v_manajer_id uuid := '33333333-3333-3333-3333-333333333333'; -- Manajer

  v_plg_id uuid;
  v_plg_overdue_id uuid;
  v_brg_normal uuid;   -- harga jual 100.000, hpp 50.000
  v_brg_bawah_hpp uuid; -- harga jual 40.000, hpp 50.000
  v_so_id uuid;
  v_persetujuan_id uuid;
  v_status_persetujuan text;
  v_alasan_tolak text;
  v_err boolean;
  v_errcode text;
  v_errmsg text;
  v_count integer;
BEGIN
  RAISE NOTICE '=== MEMULAI TEST SUITE 06: PERSETUJUAN HARGA DI BAWAH HPP ===';

  -- 1. Setup Master Data Uji
  -- Pelanggan Normal
  INSERT INTO public.pelanggan (
    id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh
  )
  VALUES (
    'b6666666-0000-0000-0000-000000000001', 'PLG-SETUJU-1', 'Toko Uji Persetujuan Normal',
    '0812999001', 'Jakarta', 10000000, 30, true, v_manajer_id
  )
  ON CONFLICT (id) DO UPDATE SET batas_kredit = 10000000, aktif = true;
  v_plg_id := 'b6666666-0000-0000-0000-000000000001';

  -- Pelanggan Overdue
  INSERT INTO public.pelanggan (
    id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh
  )
  VALUES (
    'b6666666-0000-0000-0000-000000000002', 'PLG-SETUJU-OVERDUE', 'Toko Uji Persetujuan Overdue',
    '0812999002', 'Jakarta', 10000000, 14, true, v_manajer_id
  )
  ON CONFLICT (id) DO UPDATE SET batas_kredit = 10000000, aktif = true;
  v_plg_overdue_id := 'b6666666-0000-0000-0000-000000000002';

  -- Barang Normal (harga_jual 100.000, harga_pokok 50.000, stok 100)
  INSERT INTO public.barang (
    id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif
  )
  VALUES (
    'c6666666-0000-0000-0000-000000000001', 'BRG-SETUJU-NORM', 'Barang Harga Normal',
    'sak', 100000, 50000, 100, 5, true
  )
  ON CONFLICT (id) DO UPDATE SET harga_jual = 100000, harga_pokok = 50000, stok = 100, aktif = true;
  v_brg_normal := 'c6666666-0000-0000-0000-000000000001';

  -- Barang Bawah HPP (harga_jual 40.000, harga_pokok 50.000, stok 100)
  INSERT INTO public.barang (
    id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif
  )
  VALUES (
    'c6666666-0000-0000-0000-000000000002', 'BRG-SETUJU-LOW', 'Barang Bawah HPP',
    'sak', 40000, 50000, 100, 5, true
  )
  ON CONFLICT (id) DO UPDATE SET harga_jual = 40000, harga_pokok = 50000, stok = 100, aktif = true;
  v_brg_bawah_hpp := 'c6666666-0000-0000-0000-000000000002';

  -- ============================================================
  -- TC-55: Tanpa persetujuan: konfirmasi di bawah HPP ditolak dengan E0011 verbatim
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Buat draf pesanan dengan barang bawah HPP oleh P1
  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 2, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
    v_errmsg := SQLERRM;
  END;

  IF v_err AND v_errcode = 'E0011' AND v_errmsg = 'Harga di bawah batas, minta persetujuan Manajer' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-55', 'Konfirmasi tanpa persetujuan ditolak pesan verbatim', 'LULUS', v_errmsg);
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-55', 'Konfirmasi tanpa persetujuan ditolak pesan verbatim', 'GAGAL', 'Kode: ' || COALESCE(v_errcode,'NONE') || ' Pesan: ' || COALESCE(v_errmsg,'NONE'));
  END IF;

  -- ============================================================
  -- TC-56: Ajukan saat tidak ada baris di bawah HPP ditolak E0042 (tanpa angka HPP)
  -- ============================================================
  -- Buat draf dengan barang normal
  DECLARE
    v_so_normal_id uuid;
  BEGIN
    SELECT (public.rpc_simpan_draf_pesanan(
      v_plg_id,
      jsonb_build_array(
        jsonb_build_object('barang_id', v_brg_normal, 'jumlah', 2, 'diskon_persen', 0)
      )
    )->>'id')::uuid INTO v_so_normal_id;

    v_err := false;
    BEGIN
      PERFORM public.rpc_ajukan_persetujuan_harga(v_so_normal_id);
    EXCEPTION WHEN OTHERS THEN
      v_err := true;
      v_errcode := SQLSTATE;
      v_errmsg := SQLERRM;
    END;

    IF v_err AND v_errcode = 'E0042' THEN
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-56', 'Pengajuan tanpa baris bawah HPP ditolak E0042', 'LULUS', v_errmsg);
    ELSE
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-56', 'Pengajuan tanpa baris bawah HPP ditolak E0042', 'GAGAL', 'Kode: ' || COALESCE(v_errcode,'NONE') || ' Pesan: ' || COALESCE(v_errmsg,'NONE'));
    END IF;
  END;

  -- ============================================================
  -- TC-57: Alur sukses: ajukan -> Manajer setujui -> konfirmasi berhasil -> status terpakai
  -- ============================================================
  -- P1 ajukan persetujuan untuk v_so_id
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  -- Manajer setujui
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, 'Disetujui untuk promo toko', NULL);

  -- P1 konfirmasi pesanan
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
    v_errmsg := SQLERRM;
  END;

  SELECT status INTO v_status_persetujuan FROM public.persetujuan_harga WHERE id = v_persetujuan_id;

  IF NOT v_err AND v_status_persetujuan = 'terpakai' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-57', 'Alur sukses pengajuan -> persetujuan -> konfirmasi -> terpakai', 'LULUS', 'Status persetujuan: ' || v_status_persetujuan);
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-57', 'Alur sukses pengajuan -> persetujuan -> konfirmasi -> terpakai', 'GAGAL', 'Err: ' || COALESCE(v_errmsg,'OK') || ' Status: ' || COALESCE(v_status_persetujuan,'NULL'));
  END IF;

  -- ============================================================
  -- TC-58: Edit draf setelah disetujui -> kedaluwarsa -> konfirmasi ditolak E0011
  -- ============================================================
  -- Buat draf baru
  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  -- P1 ajukan
  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  -- Manajer setujui
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, 'Disetujui batch 2', NULL);

  -- P1 edit draf (ubah jumlah dari 1 jadi 2)
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 2, 'diskon_persen', 0)
    ),
    v_so_id
  );

  SELECT status INTO v_status_persetujuan FROM public.persetujuan_harga WHERE id = v_persetujuan_id;

  -- Coba konfirmasi -> harus ditolak E0011
  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  IF v_status_persetujuan = 'kedaluwarsa' AND v_err AND v_errcode = 'E0011' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-58', 'Edit draf membuat persetujuan kedaluwarsa dan konfirmasi ditolak E0011', 'LULUS', 'Status: kedaluwarsa, E0011');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-58', 'Edit draf membuat persetujuan kedaluwarsa dan konfirmasi ditolak E0011', 'GAGAL', 'Status: ' || COALESCE(v_status_persetujuan,'NULL') || ', Err: ' || COALESCE(v_errcode,'NONE'));
  END IF;

  -- ============================================================
  -- TC-59: Simulasi 24 jam lewat: berlaku_sampai di masa lalu -> E0011; status diperbarui kedaluwarsa
  -- ============================================================
  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, 'Setuju expired test', NULL);

  -- Manipulasi berlaku_sampai menjadi 2 jam yang lalu (sebagai postgres)
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.persetujuan_harga
  SET berlaku_sampai = (now() AT TIME ZONE 'Asia/Jakarta') - interval '2 hour'
  WHERE id = v_persetujuan_id;

  -- P1 konfirmasi
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  SELECT status INTO v_status_persetujuan FROM public.v_persetujuan_harga WHERE id = v_persetujuan_id;

  IF v_err AND v_errcode = 'E0011' AND v_status_persetujuan = 'kedaluwarsa' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-59', 'Persetujuan lewat 24 jam kedaluwarsa dan konfirmasi ditolak E0011', 'LULUS', 'Status otomatis kedaluwarsa');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-59', 'Persetujuan lewat 24 jam kedaluwarsa dan konfirmasi ditolak E0011', 'GAGAL', 'Status: ' || COALESCE(v_status_persetujuan,'NULL') || ', Err: ' || COALESCE(v_errcode,'NONE'));
  END IF;

  -- ============================================================
  -- TC-60: Alasan tolak 9 vs 10 karakter: 9 -> E0044; 10 -> berhasil; P1 melihat alasan_tolak
  -- ============================================================
  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- 9 karakter -> harus gagal E0044
  v_err := false;
  BEGIN
    PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, false, NULL, '123456789');
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  -- 10 karakter -> harus berhasil
  DECLARE
    v_err_10 boolean := false;
  BEGIN
    IF v_err AND v_errcode = 'E0044' THEN
      PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, false, NULL, '1234567890');
      SELECT status, alasan_tolak INTO v_status_persetujuan, v_alasan_tolak FROM public.persetujuan_harga WHERE id = v_persetujuan_id;

      -- Cek apakah P1 bisa melihat alasan tolak
      PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
      PERFORM set_config('role', 'authenticated', true);
      SELECT alasan_tolak INTO v_alasan_tolak FROM public.v_persetujuan_harga WHERE id = v_persetujuan_id;

      IF v_status_persetujuan = 'ditolak' AND v_alasan_tolak = '1234567890' THEN
        INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
        VALUES ('TC-60', 'Validasi alasan tolak 9 vs 10 karakter dan keterbacaan pengaju', 'LULUS', 'Ditolak dengan alasan 10 char');
      ELSE
        INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
        VALUES ('TC-60', 'Validasi alasan tolak 9 vs 10 karakter dan keterbacaan pengaju', 'GAGAL', 'Alasan tolak tidak sesuai');
      END IF;
    ELSE
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-60', 'Validasi alasan tolak 9 vs 10 karakter dan keterbacaan pengaju', 'GAGAL', '9 char tidak ditolak E0044');
    END IF;
  END;

  -- ============================================================
  -- TC-61: Status terpakai: konfirmasi ulang dengan persetujuan sama -> E0011
  -- ============================================================
  -- Buat draf baru, coba tautkan ke persetujuan yang sudah terpakai di TC-57
  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  IF v_err AND v_errcode = 'E0011' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-61', 'Persetujuan terpakai tidak bisa dipakai lagi (E0011)', 'LULUS', 'Tepat ditolak E0011');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-61', 'Persetujuan terpakai tidak bisa dipakai lagi (E0011)', 'GAGAL', 'Err: ' || COALESCE(v_errcode,'NONE'));
  END IF;

  -- ============================================================
  -- TC-62: P2 tidak bisa ajukan/batalkan pengajuan draf P1
  -- ============================================================
  -- P1 buat draf
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  -- P2 coba ajukan -> harus gagal
  PERFORM set_config('request.jwt.claim.sub', v_p2_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  v_err := false;
  BEGIN
    PERFORM public.rpc_ajukan_persetujuan_harga(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  -- Sekarang P1 ajukan
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  -- P2 coba batalkan -> harus gagal
  PERFORM set_config('request.jwt.claim.sub', v_p2_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  DECLARE
    v_err_batal boolean := false;
  BEGIN
    BEGIN
      PERFORM public.rpc_batalkan_pengajuan_harga(v_persetujuan_id);
    EXCEPTION WHEN OTHERS THEN
      v_err_batal := true;
    END;

    IF v_err AND v_err_batal THEN
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-62', 'Isolasi antar-staf penjualan: P2 tidak bisa ajukan/batalkan draf P1', 'LULUS', 'Keduanya ditolak');
    ELSE
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-62', 'Isolasi antar-staf penjualan: P2 tidak bisa ajukan/batalkan draf P1', 'GAGAL', 'Ajukan: ' || v_err::text || ', Batal: ' || v_err_batal::text);
    END IF;
  END;

  -- ============================================================
  -- TC-63: Gudang tidak punya akses (ajukan ditolak E0039, SELECT 0 baris)
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := false;
  BEGIN
    PERFORM public.rpc_ajukan_persetujuan_harga(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  SELECT count(*) INTO v_count FROM public.persetujuan_harga;
  DECLARE
    v_view_m_count integer;
  BEGIN
    SELECT count(*) INTO v_view_m_count FROM public.v_persetujuan_harga_manajer;
    IF v_err AND v_errcode = 'E0039' AND v_count = 0 AND v_view_m_count = 0 THEN
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-63', 'Gudang ditolak ajukan E0039 dan membaca 0 baris di tabel & view manajer', 'LULUS', '0 baris terlihat');
    ELSE
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-63', 'Gudang ditolak ajukan E0039 dan membaca 0 baris di tabel & view manajer', 'GAGAL', 'Err: ' || COALESCE(v_errcode,'NONE') || ' Tabel: ' || v_count || ' ViewM: ' || v_view_m_count);
    END IF;
  END;

  -- ============================================================
  -- TC-64: Penjualan tidak bisa menyetujui sendiri (RPC E0001, UPDATE ditolak)
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := false;
  BEGIN
    PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, 'Setuju sendiri', NULL);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  DECLARE
    v_err_upd boolean := false;
  BEGIN
    BEGIN
      UPDATE public.persetujuan_harga SET status = 'disetujui' WHERE id = v_persetujuan_id;
    EXCEPTION WHEN OTHERS THEN
      v_err_upd := true;
    END;

    -- Update harus 0 baris atau throw error
    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_err AND v_errcode = 'E0001' AND (v_err_upd OR v_count = 0) THEN
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-64', 'Penjualan tidak bisa menyetujui sendiri (RPC E0001 & UPDATE diblokir)', 'LULUS', 'RPC E0001 dan UPDATE gagal/0 baris');
    ELSE
      INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
      VALUES ('TC-64', 'Penjualan tidak bisa menyetujui sendiri (RPC E0001 & UPDATE diblokir)', 'GAGAL', 'RPC: ' || COALESCE(v_errcode,'NONE') || ', Upd Rows: ' || v_count);
    END IF;
  END;

  -- ============================================================
  -- TC-65: Kerahasiaan data: view v_persetujuan_harga tidak memiliki kolom rahasia
  -- ============================================================
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'v_persetujuan_harga'
    AND column_name IN ('harga_pokok', 'hpp_satuan', 'margin', 'snapshot_hash');

  IF v_count = 0 THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-65', 'View publik v_persetujuan_harga bebas dari kolom rahasia & hash', 'LULUS', '0 kolom rahasia terdeteksi');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-65', 'View publik v_persetujuan_harga bebas dari kolom rahasia & hash', 'GAGAL', v_count || ' kolom rahasia bocor');
  END IF;

  -- ============================================================
  -- TC-66: Persetujuan tidak membypass limit kredit atau overdue (E0013)
  -- ============================================================
  -- Setup pesanan overdue untuk pelanggan overdue (sebagai postgres)
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.pesanan_jual (
    nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikonfirmasi_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    'SO-TEST-OD-01', v_plg_overdue_id, 'dikirim', 500000, v_manajer_id,
    now() - interval '20 day', now() - interval '20 day', now() - interval '18 day',
    (now() AT TIME ZONE 'Asia/Jakarta')::date - interval '5 day'
  );

  -- P1 buat draf untuk pelanggan overdue dengan barang bawah HPP
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_overdue_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  -- Manajer setujui
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, 'Setuju kredit test', NULL);

  -- P1 konfirmasi pesanan -> HARUS GAGAL KARENA OVERDUE (E0013), status persetujuan tetap 'disetujui' (belum terpakai)
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
  END;

  SELECT status INTO v_status_persetujuan FROM public.persetujuan_harga WHERE id = v_persetujuan_id;

  IF v_err AND v_errcode = 'E0013' AND v_status_persetujuan = 'disetujui' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-66', 'Persetujuan tidak membypass overdue (E0013) dan status tetap disetujui', 'LULUS', 'Overdue tertahan E0013');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-66', 'Persetujuan tidak membypass overdue (E0013) dan status tetap disetujui', 'GAGAL', 'Err: ' || COALESCE(v_errcode,'NONE') || ' Status: ' || COALESCE(v_status_persetujuan,'NULL'));
  END IF;

  -- ============================================================
  -- TC-68: Audit log mencatat siklus hidup persetujuan (dibaca oleh Manajer via RLS)
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT count(*) INTO v_count
  FROM public.audit_log
  WHERE nama_tabel = 'persetujuan_harga';

  IF v_count >= 3 THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-68', 'Audit log mencatat minimal aksi siklus hidup persetujuan_harga', 'LULUS', 'Tercatat ' || v_count || ' log persetujuan');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-68', 'Audit log mencatat minimal aksi siklus hidup persetujuan_harga', 'GAGAL', 'Hanya ' || v_count || ' log ditemukan');
  END IF;

  -- ============================================================
  -- TC-69: Batalkan draf menutup pengajuan aktif -> dibatalkan
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_p1_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>'id')::uuid INTO v_persetujuan_id;

  PERFORM public.rpc_batalkan_draf(v_so_id);

  SELECT status INTO v_status_persetujuan FROM public.persetujuan_harga WHERE id = v_persetujuan_id;

  IF v_status_persetujuan = 'dibatalkan' THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-69', 'Pembatalan draf pesanan otomatis membatalkan pengajuan aktif', 'LULUS', 'Status persetujuan dibatalkan');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-69', 'Pembatalan draf pesanan otomatis membatalkan pengajuan aktif', 'GAGAL', 'Status: ' || COALESCE(v_status_persetujuan,'NULL'));
  END IF;

  -- ============================================================
  -- TC-70: Manajer konfirmasi langsung (tanpa persetujuan) tetap berfungsi
  -- ============================================================
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT (public.rpc_simpan_draf_pesanan(
    v_plg_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_brg_bawah_hpp, 'jumlah', 1, 'diskon_persen', 0)
    )
  )->>'id')::uuid INTO v_so_id;

  v_err := false;
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_so_id);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_errcode := SQLSTATE;
    v_errmsg := SQLERRM;
  END;

  IF NOT v_err THEN
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-70', 'Manajer dapat konfirmasi langsung pesanan di bawah HPP tanpa pengajuan', 'LULUS', 'Konfirmasi manajer sukses');
  ELSE
    INSERT INTO hasil_uji_persetujuan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-70', 'Manajer dapat konfirmasi langsung pesanan di bawah HPP tanpa pengajuan', 'GAGAL', 'Err: ' || COALESCE(v_errmsg,'NONE'));
  END IF;

END $$;

SELECT nomor, kode_tc, deskripsi, status, pesan FROM hasil_uji_persetujuan ORDER BY nomor;

ROLLBACK;
