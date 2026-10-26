-- ============================================================
-- Test Suite 18: Penegasan BR-04 dan Pengetatan Diskon
-- Berkas: supabase/tests/18_penegasan_br04_dan_diskon.sql
-- Sesuai:
-- 1. SO-00043: Staf Penjualan BERHASIL konfirmasi (tidak ada baris di bawah HPP)
-- 2. SO-00044: Staf Penjualan DITOLAK (subtotal < HPP) dengan pesan persis
--    "Harga di bawah batas, minta persetujuan Manajer" (E0011)
-- 3. SO-00044: Meskipun tiket persetujuan disetujui, Staf Penjualan TETAP DITOLAK
-- 4. SO-00044: Manajer BERHASIL konfirmasi dan tiket ditandai terpakai
-- 5. Staf Penjualan simpan draf dengan diskon 11% DITOLAK keras dengan E0009
-- 6. Manajer simpan draf diskon 26% DITOLAK dengan E0010
-- 7. Draf diedit Manajer dengan diskon 15% dicoba konfirmasi oleh Staf DITOLAK E0009
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_sales_id uuid;
  v_manajer_id uuid;
  v_pesanan_43_id uuid;
  v_pesanan_44_id uuid;
  v_pesanan_test_id uuid;
  v_persetujuan_id uuid;
  v_pelanggan_id uuid;
  v_barang_id uuid;
  v_res jsonb;
BEGIN
  RAISE NOTICE '=== Memulai Test Suite 18: Penegasan BR-04 & Pengetatan Diskon ===';

  -- 1. Ambil Profil Sales (Rina) dan Manajer (Hendra)
  SELECT id INTO v_sales_id FROM public.profiles WHERE peran = 'penjualan' AND aktif = true LIMIT 1;
  SELECT id INTO v_manajer_id FROM public.profiles WHERE peran = 'manajer' AND aktif = true LIMIT 1;

  -- 2. Ambil ID SO-00043 dan SO-00044 dari seed
  SELECT id INTO v_pesanan_43_id FROM public.pesanan_jual WHERE nomor = 'SO-00043';
  SELECT id INTO v_pesanan_44_id FROM public.pesanan_jual WHERE nomor = 'SO-00044';

  SELECT id INTO v_pelanggan_id FROM public.pelanggan WHERE aktif = true LIMIT 1;
  SELECT id INTO v_barang_id FROM public.barang WHERE aktif = true AND stok >= 20 LIMIT 1;

  -- Jika data seed belum dimuat, siapkan data uji
  IF v_pesanan_43_id IS NULL THEN
    RAISE NOTICE 'Data SO-00043 belum ada di DB, skip eksekusi langsung seed spesifik';
  ELSE
    -- Set pembuat pesanan SO-00043 dan SO-00044 ke sales_id agar sales berhak mengakses
    UPDATE public.pesanan_jual SET dibuat_oleh = v_sales_id WHERE id IN (v_pesanan_43_id, v_pesanan_44_id);

    -- ============================================================
    -- UJI 1: SO-00043 (Staf Penjualan Berhasil Konfirmasi)
    -- ============================================================
    RAISE NOTICE '--- UJI 1: SO-00043 dikonfirmasi oleh Staf Penjualan ---';
    PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);

    v_res := public.rpc_konfirmasi_pesanan(v_pesanan_43_id);
    ASSERT (v_res->>'status') = 'dikonfirmasi', 'FAIL: SO-00043 seharusnya berhasil dikonfirmasi';
    RAISE NOTICE 'PASS: SO-00043 berhasil dikonfirmasi oleh Staf Penjualan';

    -- ============================================================
    -- UJI 2: SO-00044 (Staf Penjualan Ditolak dengan E0011)
    -- ============================================================
    RAISE NOTICE '--- UJI 2: SO-00044 konfirmasi oleh Staf Penjualan Ditolak ---';
    PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);

    BEGIN
      PERFORM public.rpc_konfirmasi_pesanan(v_pesanan_44_id);
      RAISE EXCEPTION 'FAIL: SO-00044 seharusnya ditolak untuk Staf Penjualan';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = 'E0011' AND SQLERRM = 'Harga di bawah batas, minta persetujuan Manajer' THEN
        RAISE NOTICE 'PASS: SO-00044 ditolak dengan pesan persis E0011: %', SQLERRM;
      ELSE
        RAISE EXCEPTION 'FAIL: Expected E0011, got %: %', SQLSTATE, SQLERRM;
      END IF;
    END;

    -- ============================================================
    -- UJI 3: Tiket Disetujui, Staf Penjualan TETAP Ditolak
    -- ============================================================
    RAISE NOTICE '--- UJI 3: Staf Penjualan tetap ditolak meskipun tiket disetujui ---';
    -- Sales mengajukan tiket
    PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);
    v_res := public.rpc_ajukan_persetujuan_harga(v_pesanan_44_id, 'Mohon persetujuan');
    v_persetujuan_id := (v_res->>'id')::uuid;

    -- Manajer menyetujui tiket
    PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
    PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, 'Disetujui');

    -- Sales mencoba konfirmasi lagi -> WAJIB TETAP DITOLAK!
    PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);
    BEGIN
      PERFORM public.rpc_konfirmasi_pesanan(v_pesanan_44_id);
      RAISE EXCEPTION 'FAIL: Staf Penjualan seharusnya tetap ditolak mengonfirmasi pesanan di bawah HPP';
    EXCEPTION WHEN OTHERS THEN
      IF SQLSTATE = 'E0011' THEN
        RAISE NOTICE 'PASS: Staf Penjualan tetap ditolak mengonfirmasi pesanan tiket disetujui';
      ELSE
        RAISE EXCEPTION 'FAIL: Expected E0011, got %: %', SQLSTATE, SQLERRM;
      END IF;
    END;

    -- ============================================================
    -- UJI 4: Manajer Berhasil Konfirmasi SO-00044 & Tiket Terpakai
    -- ============================================================
    RAISE NOTICE '--- UJI 4: Manajer Berhasil Konfirmasi SO-00044 ---';
    PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);

    v_res := public.rpc_konfirmasi_pesanan(v_pesanan_44_id);
    ASSERT (v_res->>'status') = 'dikonfirmasi', 'FAIL: Manajer seharusnya berhasil konfirmasi SO-00044';

    PERFORM 1 FROM public.persetujuan_harga WHERE id = v_persetujuan_id AND status = 'terpakai';
    ASSERT FOUND, 'FAIL: Tiket persetujuan harus berstatus terpakai';
    RAISE NOTICE 'PASS: Manajer berhasil konfirmasi SO-00044 dan tiket terpakai';
  END IF;

  -- ============================================================
  -- UJI 5: Staf Penjualan Simpan Draf Diskon 11% DITOLAK (E0009)
  -- ============================================================
  RAISE NOTICE '--- UJI 5: Diskon 11%% oleh Staf Penjualan ditolak ---';
  PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);

  BEGIN
    PERFORM public.rpc_simpan_draf_pesanan(
      v_pelanggan_id,
      jsonb_build_array(
        jsonb_build_object('barang_id', v_barang_id, 'jumlah', 1, 'diskon_persen', 11)
      )
    );
    RAISE EXCEPTION 'FAIL: Diskon 11%% seharusnya ditolak untuk Staf Penjualan';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0009' THEN
      RAISE NOTICE 'PASS: Diskon 11%% ditolak dengan E0009';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0009, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- UJI 6: Manajer Simpan Draf Diskon > 25% DITOLAK (E0010)
  -- ============================================================
  RAISE NOTICE '--- UJI 6: Diskon 26%% oleh Manajer ditolak ---';
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);

  BEGIN
    PERFORM public.rpc_simpan_draf_pesanan(
      v_pelanggan_id,
      jsonb_build_array(
        jsonb_build_object('barang_id', v_barang_id, 'jumlah', 1, 'diskon_persen', 26)
      )
    );
    RAISE EXCEPTION 'FAIL: Diskon 26%% seharusnya ditolak untuk Manajer';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0010' THEN
      RAISE NOTICE 'PASS: Diskon 26%% ditolak dengan E0010';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0010, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  -- ============================================================
  -- UJI 7: Draf Diskon 15% Diedit Manajer, Konfirmasi oleh Staf Ditolak
  -- ============================================================
  RAISE NOTICE '--- UJI 7: Konfirmasi draf diskon 15%% oleh Staf Penjualan ditolak ---';
  -- Manajer simpan draf dengan diskon 15% (sah)
  v_res := public.rpc_simpan_draf_pesanan(
    v_pelanggan_id,
    jsonb_build_array(
      jsonb_build_object('barang_id', v_barang_id, 'jumlah', 1, 'diskon_persen', 15)
    )
  );
  v_pesanan_test_id := (v_res->>'id')::uuid;

  -- Ubah pembuat draf ke sales agar sales berhak akses draf tersebut
  UPDATE public.pesanan_jual SET dibuat_oleh = v_sales_id WHERE id = v_pesanan_test_id;

  -- Staf mencoba konfirmasi draf diskon 15% -> Ditolak E0009
  PERFORM set_config('request.jwt.claim.sub', v_sales_id::text, true);
  BEGIN
    PERFORM public.rpc_konfirmasi_pesanan(v_pesanan_test_id);
    RAISE EXCEPTION 'FAIL: Konfirmasi draf diskon 15%% oleh Staf Penjualan seharusnya ditolak';
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'E0009' THEN
      RAISE NOTICE 'PASS: Konfirmasi draf diskon 15%% oleh Staf Penjualan sukses ditolak dengan E0009';
    ELSE
      RAISE EXCEPTION 'FAIL: Expected E0009, got %: %', SQLSTATE, SQLERRM;
    END IF;
  END;

  RAISE NOTICE '=== SEMUA UJI SUITE 18 BERHASIL DILALUI ===';
END $$;

ROLLBACK;
