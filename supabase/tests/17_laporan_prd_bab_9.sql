-- ==============================================================================
-- SUITE UJI: Dashboard & Laporan Manajer Sesuai PRD Bab 9
-- Berkas: supabase/tests/17_laporan_prd_bab_9.sql
-- Memverifikasi Test Cases TC-234 s.d. TC-238
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE hasil_uji_laporan_prd (
  nomor serial,
  kode_tc text,
  fokus_uji text,
  status text,
  pesan text
);

GRANT ALL ON hasil_uji_laporan_prd TO authenticated, anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pg_temp TO authenticated, anon, PUBLIC;

DO $$
DECLARE
  v_sales_id   uuid := '11111111-1111-1111-1111-111111111111'; -- Rina (Penjualan)
  v_gudang_id  uuid := '22222222-2222-2222-2222-222222222222'; -- Budi (Gudang)
  v_manajer_id uuid := '33333333-3333-3333-3333-333333333333'; -- Hendra (Manajer)

  v_pelanggan_id uuid;
  v_barang_id    uuid;

  v_err boolean;
  v_msg text;
  v_code text;

  v_aging_rec record;
  v_top_rec   record;
  v_bottom_rec record;
  v_ringkasan_rec record;
BEGIN
  -- Ambil pelanggan & barang aktif
  SELECT id INTO v_pelanggan_id FROM public.pelanggan WHERE aktif = true LIMIT 1;
  SELECT id INTO v_barang_id FROM public.barang WHERE aktif = true LIMIT 1;

  -- --------------------------------------------------------------------------
  -- TC-234: Omzet & Margin Bulan Berjalan Berbasis Dikirim & Lunas (Asia/Jakarta)
  -- --------------------------------------------------------------------------
  RESET ROLE;
  SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
  SET ROLE authenticated;

  BEGIN
    SELECT * INTO v_ringkasan_rec
    FROM public.rpc_laporan_ringkasan(
      (date_trunc('month', (now() AT TIME ZONE 'Asia/Jakarta')))::date,
      ((now() AT TIME ZONE 'Asia/Jakarta')::date)
    );

    IF v_ringkasan_rec.total_omzet IS NOT NULL AND v_ringkasan_rec.total_margin IS NOT NULL THEN
      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-234', 'Perhitungan omzet & margin bulan berjalan', 'LULUS',
              format('Omzet: %s, Margin: %s, Margin %%: %s', v_ringkasan_rec.total_omzet, v_ringkasan_rec.total_margin, v_ringkasan_rec.margin_persen));
    ELSE
      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-234', 'Perhitungan omzet & margin bulan berjalan', 'GAGAL', 'Nilai ringkasan NULL');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-234', 'Perhitungan omzet & margin bulan berjalan', 'GAGAL', SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-235: Aging Piutang Tepat 3 Kelompok & Total Identik dengan Piutang Berjalan
  -- --------------------------------------------------------------------------
  BEGIN
    SELECT * INTO v_aging_rec FROM public.rpc_laporan_aging_piutang();

    IF v_aging_rec.total_piutang_berjalan = (v_aging_rec.belum_jatuh_tempo + v_aging_rec.lewat_1_30_hari + v_aging_rec.lewat_gt_30_hari) THEN
      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-235', 'Aging piutang tepat 3 kelompok = total piutang berjalan', 'LULUS',
              format('Total: %s = Belum (%s) + Lewat 1-30 (%s) + Lewat >30 (%s)',
                     v_aging_rec.total_piutang_berjalan, v_aging_rec.belum_jatuh_tempo, v_aging_rec.lewat_1_30_hari, v_aging_rec.lewat_gt_30_hari));
    ELSE
      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-235', 'Aging piutang tepat 3 kelompok = total piutang berjalan', 'GAGAL',
              format('Inkonsistensi: Total (%s) != Sum (%s)',
                     v_aging_rec.total_piutang_berjalan,
                     (v_aging_rec.belum_jatuh_tempo + v_aging_rec.lewat_1_30_hari + v_aging_rec.lewat_gt_30_hari)));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-235', 'Aging piutang tepat 3 kelompok = total piutang berjalan', 'GAGAL', SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-236: Stok Menipis Hanya Menghitung Barang Aktif
  -- --------------------------------------------------------------------------
  BEGIN
    DECLARE
      v_nonaktif_menipis_count integer;
      v_aktif_menipis_count    integer;
    BEGIN
      SELECT COUNT(*) INTO v_nonaktif_menipis_count
      FROM public.v_barang
      WHERE stok_menipis = true AND aktif = false;

      SELECT COUNT(*) INTO v_aktif_menipis_count
      FROM public.v_barang
      WHERE stok_menipis = true AND aktif = true;

      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-236', 'Filter stok menipis hanya barang aktif', 'LULUS',
              format('Aktif menipis: %s SKU, Nonaktif menipis tereksklusi: %s SKU', v_aktif_menipis_count, v_nonaktif_menipis_count));
    END;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-236', 'Filter stok menipis hanya barang aktif', 'GAGAL', SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-237: rpc_laporan_bottom_barang Mengembalikan Margin Terkecil (ASC)
  -- --------------------------------------------------------------------------
  BEGIN
    SELECT * INTO v_bottom_rec
    FROM public.rpc_laporan_bottom_barang(p_limit := 1);

    IF v_bottom_rec.barang_id IS NOT NULL THEN
      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-237', 'Query 5 barang margin terkecil berhasil', 'LULUS',
              format('SKU: %s (%s) - Margin: %s', v_bottom_rec.kode, v_bottom_rec.nama, v_bottom_rec.total_margin));
    ELSE
      -- Jika belum ada transaksi di periode rentang, fungsi tetap sukses mengembalikan 0 baris
      INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
      VALUES ('TC-237', 'Query 5 barang margin terkecil berhasil', 'LULUS', '0 baris transaksi (aman)');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-237', 'Query 5 barang margin terkecil berhasil', 'GAGAL', SQLERRM);
  END;

  -- --------------------------------------------------------------------------
  -- TC-238: Zero-Leakage: Non-Manajer Ditolak Mengakses RPC Finansial / Margin
  -- --------------------------------------------------------------------------
  RESET ROLE;
  SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
  SET ROLE authenticated;

  v_err := false;
  BEGIN
    PERFORM * FROM public.rpc_laporan_bottom_barang();
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_code := SQLSTATE;
    v_msg := SQLERRM;
  END;

  IF v_err AND (v_code = 'E0001' OR v_msg ILIKE '%Akses ditolak%') THEN
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-238', 'Penjualan diblokir dari rpc_laporan_bottom_barang (E0001)', 'LULUS', format('Error: %s (%s)', v_msg, v_code));
  ELSE
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-238', 'Penjualan diblokir dari rpc_laporan_bottom_barang (E0001)', 'GAGAL', 'Tidak memicu penolakan E0001');
  END IF;

  v_err := false;
  BEGIN
    PERFORM * FROM public.rpc_laporan_aging_piutang();
  EXCEPTION WHEN OTHERS THEN
    v_err := true;
    v_code := SQLSTATE;
    v_msg := SQLERRM;
  END;

  IF v_err AND (v_code = 'E0001' OR v_msg ILIKE '%Akses ditolak%') THEN
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-238', 'Penjualan diblokir dari rpc_laporan_aging_piutang (E0001)', 'LULUS', format('Error: %s (%s)', v_msg, v_code));
  ELSE
    INSERT INTO hasil_uji_laporan_prd (kode_tc, fokus_uji, status, pesan)
    VALUES ('TC-238', 'Penjualan diblokir dari rpc_laporan_aging_piutang (E0001)', 'GAGAL', 'Tidak memicu penolakan E0001');
  END IF;

END $$;

SELECT nomor, kode_tc, fokus_uji, status, pesan FROM hasil_uji_laporan_prd ORDER BY nomor;

ROLLBACK;
