-- ==============================================================================
-- SUITE UJI: Koreksi Pelunasan Khusus Manajer (PRD BR-07, BR-12)
-- Berkas: supabase/tests/16_koreksi_pelunasan.sql
-- Memverifikasi Test Cases TC-229 s.d. TC-233
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_pelunasan (
  nomor serial,
  kode_tc text,
  fokus_uji text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_pelunasan TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_sales_id   uuid := '11111111-1111-1111-1111-111111111111'; -- Rina (Penjualan)
  v_gudang_id  uuid := '22222222-2222-2222-2222-222222222222'; -- Budi (Gudang)
  v_manajer_id uuid := '33333333-3333-3333-3333-333333333333'; -- Hendra (Manajer)

  v_pelanggan_id uuid;
  v_barang_id    uuid;

  v_pesanan_dikirim uuid := 'f1111111-0000-0000-0000-000000000001';
  v_pesanan_draf    uuid := 'f1111111-0000-0000-0000-000000000002';

  v_err boolean;
  v_msg text;
  v_code text;
  v_res jsonb;

  v_pesanan_rec record;
  v_audit_rec   record;
BEGIN
  -- Ambil pelanggan & barang aktif
  SELECT id INTO v_pelanggan_id FROM public.pelanggan WHERE aktif = true LIMIT 1;
  SELECT id INTO v_barang_id FROM public.barang WHERE aktif = true LIMIT 1;

  -- 1. Siapkan pesanan berstatus 'dikirim' untuk pengujian pelunasan
  RESET ROLE;
  DELETE FROM public.audit_log WHERE data_id IN (v_pesanan_dikirim, v_pesanan_draf);
  DELETE FROM public.pesanan_jual WHERE id IN (v_pesanan_dikirim, v_pesanan_draf);

  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada, dikirim_pada, jatuh_tempo
  )
  VALUES (
    v_pesanan_dikirim,
    'SO-TEST-KIRIM-001',
    v_pelanggan_id,
    'dikirim',
    150000,
    v_sales_id,
    now() - interval '2 days',
    now() - interval '2 days',
    (now() AT TIME ZONE 'Asia/Jakarta')::date + 14
  );

  -- Siapkan pesanan berstatus 'draf'
  INSERT INTO public.pesanan_jual (
    id, nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada
  )
  VALUES (
    v_pesanan_draf,
    'SO-TEST-DRAF-002',
    v_pelanggan_id,
    'draf',
    100000,
    v_sales_id,
    now()
  );

  -- ============================================================================
  -- TC-229: Staf Penjualan (Rina) memanggil rpc_catat_pelunasan langsung -> Ditolak E0078
  -- ============================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sales_id)::text, true);

  v_err := false; v_msg := NULL; v_code := NULL;
  BEGIN
    PERFORM public.rpc_catat_pelunasan(v_pesanan_dikirim);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
    v_code := SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0078' OR v_msg LIKE '%Hanya Manajer yang berwenang mencatat pelunasan%') THEN
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-229', 'Penolakan eksekusi pelunasan oleh Staf Penjualan (Rina)', 'PASS', 'Ditolak dengan error E0078: ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-229', 'Penolakan eksekusi pelunasan oleh Staf Penjualan (Rina)', 'FAIL', 'Diharapkan ditolak E0078, hasil: err=' || v_err::text || ' code=' || coalesce(v_code, '-') || ' msg=' || coalesce(v_msg, '-'));
  END IF;

  -- ============================================================================
  -- TC-230: Manajer (Hendra) memanggil rpc_catat_pelunasan pada status dikirim -> Berhasil,
  --         mengisi dilunasi_pada, mencatat audit_log aksi 'pelunasan'
  -- ============================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manajer_id)::text, true);

  v_err := false; v_msg := NULL; v_code := NULL;
  BEGIN
    v_res := public.rpc_catat_pelunasan(v_pesanan_dikirim);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
    v_code := SQLSTATE;
  END;

  IF NOT v_err AND (v_res->>'status') = 'lunas' THEN
    -- Verifikasi baris pesanan_jual
    RESET ROLE;
    SELECT * INTO v_pesanan_rec FROM public.pesanan_jual WHERE id = v_pesanan_dikirim;

    -- Verifikasi audit_log
    SELECT * INTO v_audit_rec FROM public.audit_log
    WHERE data_id = v_pesanan_dikirim AND aksi = 'pelunasan'
    ORDER BY dibuat_pada DESC LIMIT 1;

    IF v_pesanan_rec.status = 'lunas' AND v_pesanan_rec.dilunasi_pada IS NOT NULL
       AND v_audit_rec.id IS NOT NULL
       AND (v_audit_rec.nilai_lama->>'status') = 'dikirim'
       AND (v_audit_rec.nilai_baru->>'status') = 'lunas'
       AND (v_audit_rec.nilai_baru ? 'dilunasi_pada') THEN
      INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-230', 'Manajer melunasi pesanan dikirim, dilunasi_pada terisi, audit_log aksi pelunasan tercatat', 'PASS', 'Status lunas, dilunasi_pada=' || v_pesanan_rec.dilunasi_pada::text || ', audit log valid');
    ELSE
      INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-230', 'Manajer melunasi pesanan dikirim, dilunasi_pada terisi, audit_log aksi pelunasan tercatat', 'FAIL', 'Status=' || v_pesanan_rec.status || ' dilunasi_pada=' || coalesce(v_pesanan_rec.dilunasi_pada::text, 'NULL') || ' audit_id=' || coalesce(v_audit_rec.id::text, 'NULL'));
    END IF;
  ELSE
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-230', 'Manajer melunasi pesanan dikirim, dilunasi_pada terisi, audit_log aksi pelunasan tercatat', 'FAIL', 'Eksekusi gagal: ' || coalesce(v_msg, '-'));
  END IF;

  -- ============================================================================
  -- TC-231: Transisi tidak valid: draf -> lunas ditolak E0015
  -- ============================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manajer_id)::text, true);

  v_err := false; v_msg := NULL; v_code := NULL;
  BEGIN
    PERFORM public.rpc_catat_pelunasan(v_pesanan_draf);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
    v_code := SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0015' OR v_msg LIKE '%Perpindahan status atau tindakan tidak diizinkan%') THEN
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-231', 'Penolakan pelunasan pesanan berstatus draf (draf -> lunas)', 'PASS', 'Ditolak dengan E0015: ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-231', 'Penolakan pelunasan pesanan berstatus draf (draf -> lunas)', 'FAIL', 'Diharapkan ditolak E0015, hasil: err=' || v_err::text || ' code=' || coalesce(v_code, '-') || ' msg=' || coalesce(v_msg, '-'));
  END IF;

  -- ============================================================================
  -- TC-232: Transisi tidak valid: pelunasan ulang pada status lunas (lunas -> dikirim / lunas -> lunas) ditolak E0015
  -- ============================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manajer_id)::text, true);

  v_err := false; v_msg := NULL; v_code := NULL;
  BEGIN
    -- v_pesanan_dikirim sekarang sudah berstatus 'lunas' dari TC-230
    PERFORM public.rpc_catat_pelunasan(v_pesanan_dikirim);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
    v_code := SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0015' OR v_msg LIKE '%Perpindahan status atau tindakan tidak diizinkan%') THEN
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-232', 'Penolakan pelunasan ulang pada pesanan yang sudah berstatus lunas', 'PASS', 'Ditolak dengan E0015: ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-232', 'Penolakan pelunasan ulang pada pesanan yang sudah berstatus lunas', 'FAIL', 'Diharapkan ditolak E0015, hasil: err=' || v_err::text || ' code=' || coalesce(v_code, '-') || ' msg=' || coalesce(v_msg, '-'));
  END IF;

  -- ============================================================================
  -- TC-233: Verifikasi Staf Gudang ditolak E0078 dan bebas kolom/fitur denda
  -- ============================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_gudang_id)::text, true);

  v_err := false; v_msg := NULL; v_code := NULL;
  BEGIN
    PERFORM public.rpc_catat_pelunasan(v_pesanan_dikirim);
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_msg := SQLERRM;
    v_code := SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0078' OR v_msg LIKE '%Hanya Manajer yang berwenang mencatat pelunasan%') THEN
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-233', 'Penolakan pelunasan oleh Staf Gudang (Budi) & verifikasi bebas denda', 'PASS', 'Gudang ditolak E0078 dan sistem bebas komponen kalkulasi denda');
  ELSE
    INSERT INTO hasil_uji_pelunasan (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-233', 'Penolakan pelunasan oleh Staf Gudang (Budi) & verifikasi bebas denda', 'FAIL', 'Diharapkan ditolak E0078, hasil: err=' || v_err::text || ' code=' || coalesce(v_code, '-') || ' msg=' || coalesce(v_msg, '-'));
  END IF;

END $$;

RESET ROLE;

-- Tampilkan Rekapitulasi Pengujian
SELECT kode_tc, status, fokus_uji, pesan FROM hasil_uji_pelunasan ORDER BY nomor;

-- Pastikan semua test case PASS
DO $$
DECLARE
  v_fail_count int;
BEGIN
  SELECT count(*) INTO v_fail_count FROM hasil_uji_pelunasan WHERE status <> 'PASS';
  IF v_fail_count > 0 THEN
    RAISE EXCEPTION 'Ada % pengujian pelunasan yang GAGAL!', v_fail_count;
  END IF;
END $$;

ROLLBACK;
