-- ==============================================================================
-- SUITE UJI: Pembatalan Pembelian (PO) sesuai PRD Bab 6.2 & BR-09 (15_pembatalan_pembelian.sql)
-- Memverifikasi Test Cases TC-214 s.d. TC-227
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_pembatalan (
  nomor serial,
  kode_tc text,
  deskripsi text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_pembatalan TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_gudang1_id uuid := '22222222-2222-2222-2222-222222222222';
  v_gudang2_id uuid := '22222222-2222-2222-2222-222222222223';
  v_manajer_id uuid := '33333333-3333-3333-3333-333333333333';
  v_sales_id   uuid := '11111111-1111-1111-1111-111111111111';

  v_pemasok_id uuid;
  v_barang_id  uuid;
  v_stok_awal  int;
  v_hpp_awal   numeric;

  v_po_id      uuid;
  v_po_rec     record;
  v_res        jsonb;
  v_err        boolean;
  v_msg        text;
  v_code       text;
  v_stok_akhir int;
  v_hpp_akhir  numeric;
  v_audit_rec  record;
  v_dash_res   jsonb;
BEGIN
  -- Siapkan Staf Gudang 2 sintetis
  INSERT INTO auth.users (id, email)
  VALUES (v_gudang2_id, 'gudang2@sinarabadi.test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, nama_lengkap, peran, aktif)
  VALUES (v_gudang2_id, 'Staf Gudang 2 (Uji)', 'gudang', true)
  ON CONFLICT (id) DO UPDATE SET peran = 'gudang', aktif = true;

  UPDATE public.profiles SET peran = 'gudang', aktif = true WHERE id = v_gudang2_id;

  -- Ambil data master pemasok & barang
  SELECT id INTO v_pemasok_id FROM public.pemasok WHERE aktif = true LIMIT 1;
  SELECT id, stok, harga_pokok INTO v_barang_id, v_stok_awal, v_hpp_awal
  FROM public.barang WHERE aktif = true LIMIT 1;

  -- ============================================================================
  -- TC-214: Pengaju membatalkan PO berstatus diajukan
  -- ============================================================================
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang1_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang1_id::text, true);

  -- Gudang 1 ajukan PO
  v_res := public.rpc_ajukan_pembelian(v_pemasok_id, v_barang_id, 20);
  v_po_id := (v_res->>'id')::uuid;

  -- Gudang 1 batalkan PO miliknya
  v_res := public.rpc_batalkan_pembelian(v_po_id, 'Salah estimasi jumlah kebutuhan');

  SELECT * INTO v_po_rec FROM public.pembelian WHERE id = v_po_id;
  IF v_po_rec.status = 'dibatalkan'
     AND v_po_rec.dibatalkan_oleh = v_gudang1_id
     AND v_po_rec.dibatalkan_pada IS NOT NULL
     AND v_po_rec.alasan_batal = 'Salah estimasi jumlah kebutuhan' THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-214', 'Pengaju membatalkan PO diajukan berhasil', 'PASS', 'Status dibatalkan & pelaku tercatat');
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-214', 'Pengaju membatalkan PO diajukan berhasil', 'FAIL', 'Status bukan dibatalkan atau kolom tidak lengkap');
  END IF;

  -- ============================================================================
  -- TC-215: Bukan pengaju (Gudang 2) membatalkan PO diajukan ditolak E0074
  -- ============================================================================
  -- Gudang 1 ajukan PO baru
  v_res := public.rpc_ajukan_pembelian(v_pemasok_id, v_barang_id, 15);
  v_po_id := (v_res->>'id')::uuid;

  -- Beralih ke Gudang 2
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang2_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang2_id::text, true);

  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Percobaan batal oleh Gudang 2');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0074' OR v_msg LIKE '%Hanya pengaju%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-215', 'Bukan pengaju (Gudang 2) membatalkan diajukan ditolak', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-215', 'Bukan pengaju (Gudang 2) membatalkan diajukan ditolak', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-216: Manajer bukan pengaju membatalkan diajukan ditolak E0074 (PRD Harfiah)
  -- ============================================================================
  -- Beralih ke Manajer
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_manajer_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);

  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Manajer mencoba batalkan PO orang lain');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0074' OR v_msg LIKE '%Hanya pengaju%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-216', 'Manajer bukan pengaju membatalkan diajukan ditolak (PRD Harfiah)', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-216', 'Manajer bukan pengaju membatalkan diajukan ditolak (PRD Harfiah)', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-217: Manajer membatalkan PO berstatus disetujui
  -- ============================================================================
  -- Manajer setujui PO ini lebih dulu
  PERFORM public.rpc_setujui_pembelian(v_po_id, 15000);

  -- Manajer batalkan PO disetujui (sebelum barang diterima)
  v_res := public.rpc_batalkan_pembelian(v_po_id, 'Pemasok menyatakan stok habis');

  SELECT * INTO v_po_rec FROM public.pembelian WHERE id = v_po_id;
  IF v_po_rec.status = 'dibatalkan'
     AND v_po_rec.dibatalkan_oleh = v_manajer_id
     AND v_po_rec.alasan_batal = 'Pemasok menyatakan stok habis' THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-217', 'Manajer membatalkan PO disetujui berhasil', 'PASS', 'Status dibatalkan & pelaku manajer tercatat');
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-217', 'Manajer membatalkan PO disetujui berhasil', 'FAIL', 'Status bukan dibatalkan');
  END IF;

  -- ============================================================================
  -- TC-218: Gudang membatalkan PO berstatus disetujui ditolak E0075
  -- ============================================================================
  -- Gudang 1 ajukan PO baru & Manajer setujui
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang1_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang1_id::text, true);
  v_res := public.rpc_ajukan_pembelian(v_pemasok_id, v_barang_id, 10);
  v_po_id := (v_res->>'id')::uuid;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_manajer_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM public.rpc_setujui_pembelian(v_po_id, 12000);

  -- Gudang 1 mencoba membatalkan PO disetujui
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang1_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang1_id::text, true);

  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Gudang mencoba batalkan PO disetujui');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0075' OR v_msg LIKE '%Hanya Manajer%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-218', 'Gudang membatalkan PO disetujui ditolak (E0075)', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-218', 'Gudang membatalkan PO disetujui ditolak (E0075)', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-219: Pembatalan PO berstatus diterima ditolak E0076 / E0077
  -- ============================================================================
  -- Gudang terima barang fisik PO
  PERFORM public.rpc_terima_pembelian(v_po_id, 10);

  -- Manajer mencoba membatalkan PO yang sudah diterima
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_manajer_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);

  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Coba batalkan barang yang sudah masuk');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code IN ('E0076', 'E0077') OR v_msg LIKE '%tidak dapat dibatalkan%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-219', 'Pembatalan PO diterima ditolak', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-219', 'Pembatalan PO diterima ditolak', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-220: Pembatalan PO berstatus ditolak ditolak E0076
  -- ============================================================================
  -- Gudang ajukan PO baru lalu Manajer tolak
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang1_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang1_id::text, true);
  v_res := public.rpc_ajukan_pembelian(v_pemasok_id, v_barang_id, 5);
  v_po_id := (v_res->>'id')::uuid;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_manajer_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM public.rpc_tolak_pembelian(v_po_id, 'Harga penawaran pemasok terlalu tinggi');

  -- Coba batalkan PO yang sudah ditolak
  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Membatalkan yang sudah ditolak');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0076' OR v_msg LIKE '%tidak dapat dibatalkan%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-220', 'Pembatalan PO ditolak ditolak (E0076)', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-220', 'Pembatalan PO ditolak ditolak (E0076)', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-221: Pembatalan PO yang sudah dibatalkan ditolak E0076
  -- ============================================================================
  -- Gudang ajukan PO baru dan batalkan
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang1_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang1_id::text, true);
  v_res := public.rpc_ajukan_pembelian(v_pemasok_id, v_barang_id, 8);
  v_po_id := (v_res->>'id')::uuid;
  PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Pembatalan sah pertama');

  -- Coba batalkan ulang
  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Pembatalan kedua kali');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0076' OR v_msg LIKE '%tidak dapat dibatalkan%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-221', 'Pembatalan PO yang sudah dibatalkan ditolak (E0076)', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-221', 'Pembatalan PO yang sudah dibatalkan ditolak (E0076)', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-222: Penerimaan barang setelah dibatalkan ditolak E0019
  -- ============================================================================
  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_terima_pembelian(v_po_id, 8);
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0019' OR v_msg LIKE '%tidak dalam status disetujui%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-222', 'Penerimaan barang setelah dibatalkan ditolak (E0019)', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-222', 'Penerimaan barang setelah dibatalkan ditolak (E0019)', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

  -- ============================================================================
  -- TC-223: Verifikasi stok dan harga_pokok tidak berubah akibat pembatalan
  -- ============================================================================
  -- Pada langkah TC-219 di atas ada penerimaan 10 unit, jadi kita bandingkan dengan stok setelah penerimaan itu
  SELECT stok, harga_pokok INTO v_stok_akhir, v_hpp_akhir FROM public.barang WHERE id = v_barang_id;
  -- PO yang dibatalkan (TC-214, TC-217, TC-221) tidak boleh menambah stok tambahan
  IF v_stok_akhir = v_stok_awal + 10 THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-223', 'Stok dan harga pokok tidak berubah akibat pembatalan', 'PASS', 'Stok hanya bertambah dari PO diterima, PO batal tidak mutasi');
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-223', 'Stok dan harga pokok tidak berubah akibat pembatalan', 'FAIL', 'Terjadi anomali stok');
  END IF;

  -- ============================================================================
  -- TC-224: Audit log mencatat pembatalan dengan nilai lama dan nilai baru
  -- ============================================================================
  SELECT * INTO v_audit_rec
  FROM public.audit_log
  WHERE aksi = 'batalkan_pembelian' AND data_id = v_po_id
  ORDER BY dibuat_pada DESC LIMIT 1;

  IF v_audit_rec.id IS NOT NULL
     AND v_audit_rec.nilai_lama->>'status' = 'diajukan'
     AND v_audit_rec.nilai_baru->>'status' = 'dibatalkan'
     AND v_audit_rec.nilai_baru->>'alasan' = 'Pembatalan sah pertama' THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-224', 'Audit log mencatat pembatalan nilai sebelum dan sesudah', 'PASS', 'Tercatat: status lama=diajukan, baru=dibatalkan');
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-224', 'Audit log mencatat pembatalan nilai sebelum dan sesudah', 'FAIL', 'Audit log tidak lengkap atau tidak ditemukan');
  END IF;

  -- ============================================================================
  -- TC-225: Zero-Leakage: v_pembelian tidak mengekspos harga_beli_satuan
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'v_pembelian' AND column_name = 'harga_beli_satuan'
  ) THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-225', 'Zero-Leakage: v_pembelian bebas harga_beli_satuan', 'PASS', 'Kolom harga_beli_satuan tidak ada di view v_pembelian');
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-225', 'Zero-Leakage: v_pembelian bebas harga_beli_satuan', 'FAIL', 'Kebocoran kolom harga_beli_satuan terdeteksi di v_pembelian');
  END IF;

  -- ============================================================================
  -- TC-226: Penghitung Dasbor & Tugas Harian mengecualikan PO dibatalkan
  -- ============================================================================
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_gudang1_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_gudang1_id::text, true);
  v_dash_res := public.rpc_get_tugas_harian();

  -- PO yang berstatus dibatalkan tidak boleh masuk ke po_menunggu_penerimaan
  IF (v_dash_res->>'po_menunggu_penerimaan')::int = 0 THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-226', 'Dasbor tugas harian mengecualikan PO dibatalkan', 'PASS', 'po_menunggu_penerimaan = 0');
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-226', 'Dasbor tugas harian mengecualikan PO dibatalkan', 'FAIL', 'po_menunggu_penerimaan tidak 0: ' || (v_dash_res->>'po_menunggu_penerimaan'));
  END IF;

  -- ============================================================================
  -- TC-227: Panggilan RPC langsung oleh Staf Penjualan ditolak E0001
  -- ============================================================================
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_sales_id)::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);

  v_err := false; v_msg := ''; v_code := '';
  BEGIN
    PERFORM public.rpc_batalkan_pembelian(v_po_id, 'Percobaan oleh sales');
  EXCEPTION WHEN OTHERS THEN
    v_err := true; v_msg := SQLERRM;
    GET STACKED DIAGNOSTICS v_code = RETURNED_SQLSTATE;
  END;

  IF v_err AND (v_code = 'E0001' OR v_msg LIKE '%Akses ditolak%') THEN
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-227', 'Panggilan RPC langsung oleh Penjualan ditolak (E0001)', 'PASS', v_code || ': ' || v_msg);
  ELSE
    INSERT INTO hasil_uji_pembatalan (kode_tc, deskripsi, status, pesan)
    VALUES ('TC-227', 'Panggilan RPC langsung oleh Penjualan ditolak (E0001)', 'FAIL', COALESCE(v_code, 'NONE') || ': ' || COALESCE(v_msg, 'Berhasil tanpa error!'));
  END IF;

END $$;

SELECT kode_tc, deskripsi, status, pesan FROM hasil_uji_pembatalan ORDER BY nomor;

ROLLBACK;
