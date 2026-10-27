-- ============================================================
-- MIGRASI: Penyelarasan Penuh Dashboard, Laporan, & HPP/Margin
-- Berkas: supabase/migrations/20261026231000_audit_dan_penyelarasan_laporan_bab9.sql
-- Sesuai: PRD Bab 9, BR-06, BR-12, dan ERD CV Sinar Abadi Niaga
-- ============================================================

-- 1. FUNGSI: rpc_laporan_ringkasan (PRD Bab 9 §1)
-- Menghitung agregat Omzet, HPP, Margin Kotor, dan % Margin bulan/periode berjalan
-- Berdasarkan pesanan status 'dikirim' dan 'lunas' pada tanggal kirim (Asia/Jakarta)
CREATE OR REPLACE FUNCTION public.rpc_laporan_ringkasan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL
)
RETURNS TABLE (
  total_omzet      numeric,
  total_hpp        numeric,
  total_margin     numeric,
  margin_persen    numeric,
  jumlah_pesanan   integer,
  pesanan_dikirim  integer,
  pesanan_lunas    integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  -- Default dari: awal bulan berjalan jika tidak ditentukan
  v_dari   := COALESCE(p_dari, date_trunc('month', v_sampai)::date);

  RETURN QUERY
  WITH item_sah AS (
    SELECT
      pj.id AS pesanan_id,
      pj.status,
      ip.subtotal,
      (COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS hpp_baris
    FROM public.pesanan_jual pj
    JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
  )
  SELECT
    COALESCE(SUM(its.subtotal), 0) AS total_omzet,
    COALESCE(SUM(its.hpp_baris), 0) AS total_hpp,
    (COALESCE(SUM(its.subtotal), 0) - COALESCE(SUM(its.hpp_baris), 0)) AS total_margin,
    CASE
      WHEN COALESCE(SUM(its.subtotal), 0) > 0 THEN
        round(((COALESCE(SUM(its.subtotal), 0) - COALESCE(SUM(its.hpp_baris), 0)) / SUM(its.subtotal) * 100.0), 2)
      ELSE 0
    END AS margin_persen,
    COUNT(DISTINCT its.pesanan_id)::integer AS jumlah_pesanan,
    COUNT(DISTINCT CASE WHEN its.status = 'dikirim' THEN its.pesanan_id END)::integer AS pesanan_dikirim,
    COUNT(DISTINCT CASE WHEN its.status = 'lunas' THEN its.pesanan_id END)::integer AS pesanan_lunas
  FROM item_sah its;
END;
$$;

-- 2. FUNGSI: rpc_laporan_margin_mingguan (PRD Bab 9 §2)
-- Grafik batang omzet dan margin mingguan tepat 8 minggu terakhir
CREATE OR REPLACE FUNCTION public.rpc_laporan_margin_mingguan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL
)
RETURNS TABLE (
  minggu        date,
  omzet         numeric,
  hpp           numeric,
  margin        numeric,
  margin_persen numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sampai_akhir_minggu date;
  v_dari_awal_minggu    date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Default 8 minggu terakhir berujung pada minggu berjalan (ISO week: Senin s.d. Minggu)
  v_sampai_akhir_minggu := date_trunc('week', COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date))::date;
  v_dari_awal_minggu    := COALESCE(
    CASE WHEN p_dari IS NOT NULL THEN date_trunc('week', p_dari)::date END,
    v_sampai_akhir_minggu - interval '7 weeks'
  );

  RETURN QUERY
  WITH deret_minggu AS (
    SELECT date_trunc('week', d)::date AS awal_minggu
    FROM generate_series(
      v_dari_awal_minggu,
      v_sampai_akhir_minggu,
      interval '1 week'
    ) d
  ),
  data_item_mingguan AS (
    SELECT
      date_trunc('week', pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date AS awal_minggu,
      SUM(ip.subtotal) AS total_omzet,
      SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS total_hpp
    FROM public.pesanan_jual pj
    JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date >= v_dari_awal_minggu
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date <= (v_sampai_akhir_minggu + interval '6 days')::date
    GROUP BY date_trunc('week', pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date
  )
  SELECT
    dm.awal_minggu AS minggu,
    COALESCE(dim.total_omzet, 0) AS omzet,
    COALESCE(dim.total_hpp, 0) AS hpp,
    (COALESCE(dim.total_omzet, 0) - COALESCE(dim.total_hpp, 0)) AS margin,
    CASE
      WHEN COALESCE(dim.total_omzet, 0) > 0 THEN
        round(((COALESCE(dim.total_omzet, 0) - COALESCE(dim.total_hpp, 0)) / dim.total_omzet * 100.0), 2)
      ELSE 0
    END AS margin_persen
  FROM deret_minggu dm
  LEFT JOIN data_item_mingguan dim ON dim.awal_minggu = dm.awal_minggu
  ORDER BY dm.awal_minggu ASC;
END;
$$;

-- 3. FUNGSI: rpc_laporan_top_barang (PRD Bab 9 §3 - Top 10 Barang Margin Terbesar)
CREATE OR REPLACE FUNCTION public.rpc_laporan_top_barang(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL,
  p_limit  integer DEFAULT 10
)
RETURNS TABLE (
  barang_id      uuid,
  kode           text,
  nama           text,
  satuan         text,
  jumlah_terjual bigint,
  total_omzet    numeric,
  total_hpp      numeric,
  total_margin   numeric,
  margin_persen  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, date_trunc('month', v_sampai)::date);

  RETURN QUERY
  SELECT
    b.id AS barang_id,
    b.kode,
    b.nama,
    b.satuan,
    COALESCE(SUM(ip.jumlah), 0)::bigint AS jumlah_terjual,
    COALESCE(SUM(ip.subtotal), 0) AS total_omzet,
    COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0) AS total_hpp,
    (COALESCE(SUM(ip.subtotal), 0) - COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0)) AS total_margin,
    CASE
      WHEN COALESCE(SUM(ip.subtotal), 0) > 0 THEN
        round(((COALESCE(SUM(ip.subtotal), 0) - COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0)) / SUM(ip.subtotal) * 100.0), 2)
      ELSE 0
    END AS margin_persen
  FROM public.item_pesanan_jual ip
  JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
  JOIN public.barang b ON b.id = ip.barang_id
  WHERE pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL
    AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
  GROUP BY b.id, b.kode, b.nama, b.satuan
  ORDER BY total_margin DESC, total_omzet DESC
  LIMIT p_limit;
END;
$$;

-- 4. FUNGSI: rpc_laporan_bottom_barang (PRD Bab 9 §3 - 5 Barang Margin Terkecil)
CREATE OR REPLACE FUNCTION public.rpc_laporan_bottom_barang(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL,
  p_limit  integer DEFAULT 5
)
RETURNS TABLE (
  barang_id      uuid,
  kode           text,
  nama           text,
  satuan         text,
  jumlah_terjual bigint,
  total_omzet    numeric,
  total_hpp      numeric,
  total_margin   numeric,
  margin_persen  numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, date_trunc('month', v_sampai)::date);

  RETURN QUERY
  SELECT
    b.id AS barang_id,
    b.kode,
    b.nama,
    b.satuan,
    COALESCE(SUM(ip.jumlah), 0)::bigint AS jumlah_terjual,
    COALESCE(SUM(ip.subtotal), 0) AS total_omzet,
    COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0) AS total_hpp,
    (COALESCE(SUM(ip.subtotal), 0) - COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0)) AS total_margin,
    CASE
      WHEN COALESCE(SUM(ip.subtotal), 0) > 0 THEN
        round(((COALESCE(SUM(ip.subtotal), 0) - COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0)) / SUM(ip.subtotal) * 100.0), 2)
      ELSE 0
    END AS margin_persen
  FROM public.item_pesanan_jual ip
  JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
  JOIN public.barang b ON b.id = ip.barang_id
  WHERE pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL
    AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
  GROUP BY b.id, b.kode, b.nama, b.satuan
  ORDER BY total_margin ASC, total_omzet ASC
  LIMIT p_limit;
END;
$$;

-- 5. FUNGSI: rpc_laporan_top_pelanggan (Perbaikan Bebas Bug Cartesian Join)
CREATE OR REPLACE FUNCTION public.rpc_laporan_top_pelanggan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL,
  p_limit  integer DEFAULT 10
)
RETURNS TABLE (
  pelanggan_id   uuid,
  kode           text,
  nama_toko      text,
  jumlah_pesanan integer,
  total_omzet    numeric,
  total_margin   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, date_trunc('month', v_sampai)::date);

  RETURN QUERY
  WITH item_pelanggan AS (
    SELECT
      pj.pelanggan_id,
      pj.id AS pesanan_id,
      ip.subtotal,
      (ip.subtotal - (COALESCE(ip.hpp_satuan, 0) * ip.jumlah)) AS margin_baris
    FROM public.pesanan_jual pj
    JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
  )
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    COUNT(DISTINCT ipel.pesanan_id)::integer AS jumlah_pesanan,
    COALESCE(SUM(ipel.subtotal), 0) AS total_omzet,
    COALESCE(SUM(ipel.margin_baris), 0) AS total_margin
  FROM public.pelanggan p
  JOIN item_pelanggan ipel ON ipel.pelanggan_id = p.id
  GROUP BY p.id, p.kode, p.nama_toko
  ORDER BY total_omzet DESC, total_margin DESC
  LIMIT p_limit;
END;
$$;

-- 6. HAK AKSES EKSEKUSI (REVOKE DARI PUBLIC & ANON, GRANT KE AUTHENTICATED)
REVOKE ALL ON FUNCTION public.rpc_laporan_ringkasan(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_ringkasan(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_margin_mingguan(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_margin_mingguan(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_top_barang(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_top_barang(date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_bottom_barang(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_bottom_barang(date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_top_pelanggan(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_top_pelanggan(date, date, integer) TO authenticated;
