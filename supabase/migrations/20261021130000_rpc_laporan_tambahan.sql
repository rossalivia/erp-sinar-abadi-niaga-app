-- ============================================================
-- Migrasi: RPC Laporan Tambahan (Khusus Manajer)
-- CV Sinar Abadi Niaga
-- ============================================================

-- 1. rpc_laporan_ringkasan: Agregat KPI omzet, HPP, margin, margin %, dan jumlah pesanan
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
SET search_path = public
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

  RETURN QUERY
  WITH pesanan_periode AS (
    SELECT
      pj.id,
      pj.total,
      pj.status
    FROM public.pesanan_jual pj
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
  ),
  item_periode AS (
    SELECT
      COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0) AS hpp_total
    FROM public.item_pesanan_jual ip
    JOIN pesanan_periode pp ON pp.id = ip.pesanan_jual_id
  )
  SELECT
    COALESCE(SUM(pp.total), 0) AS total_omzet,
    COALESCE(ip.hpp_total, 0) AS total_hpp,
    (COALESCE(SUM(pp.total), 0) - COALESCE(ip.hpp_total, 0)) AS total_margin,
    CASE
      WHEN COALESCE(SUM(pp.total), 0) > 0 THEN
        round(((COALESCE(SUM(pp.total), 0) - COALESCE(ip.hpp_total, 0)) / SUM(pp.total) * 100.0), 2)
      ELSE 0
    END AS margin_persen,
    COUNT(pp.id)::integer AS jumlah_pesanan,
    COUNT(CASE WHEN pp.status = 'dikirim' THEN 1 END)::integer AS pesanan_dikirim,
    COUNT(CASE WHEN pp.status = 'lunas' THEN 1 END)::integer AS pesanan_lunas
  FROM pesanan_periode pp
  CROSS JOIN item_periode ip
  GROUP BY ip.hpp_total;
END;
$$;

-- 2. rpc_laporan_top_barang: Top 10 barang berdasarkan total margin
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
SET search_path = public
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

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

-- 3. rpc_laporan_top_pelanggan: Top 10 pelanggan berdasarkan total omzet
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
SET search_path = public
AS $$
DECLARE
  v_dari   date;
  v_sampai date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

  RETURN QUERY
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    COUNT(DISTINCT pj.id)::integer AS jumlah_pesanan,
    COALESCE(SUM(pj.total), 0) AS total_omzet,
    (COALESCE(SUM(pj.total), 0) - COALESCE(SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah), 0)) AS total_margin
  FROM public.pesanan_jual pj
  JOIN public.pelanggan p ON p.id = pj.pelanggan_id
  LEFT JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
  WHERE pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL
    AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
  GROUP BY p.id, p.kode, p.nama_toko
  ORDER BY total_omzet DESC, total_margin DESC
  LIMIT p_limit;
END;
$$;

-- 4. rpc_laporan_aging_piutang: Rekapitulasi umur piutang berjalan pesanan status 'dikirim'
CREATE OR REPLACE FUNCTION public.rpc_laporan_aging_piutang()
RETURNS TABLE (
  total_piutang_dikirim         numeric,
  belum_jatuh_tempo             numeric,
  lewat_1_7_hari                numeric,
  lewat_8_30_hari               numeric,
  lewat_gt_30_hari              numeric,
  jumlah_pesanan_lewat_tempo    integer,
  total_pesanan_dikirim         integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hari_ini date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  SELECT
    COALESCE(SUM(pj.total), 0) AS total_piutang_dikirim,
    COALESCE(SUM(CASE WHEN pj.jatuh_tempo >= v_hari_ini THEN pj.total ELSE 0 END), 0) AS belum_jatuh_tempo,
    COALESCE(SUM(CASE WHEN (v_hari_ini - pj.jatuh_tempo) BETWEEN 1 AND 7 THEN pj.total ELSE 0 END), 0) AS lewat_1_7_hari,
    COALESCE(SUM(CASE WHEN (v_hari_ini - pj.jatuh_tempo) BETWEEN 8 AND 30 THEN pj.total ELSE 0 END), 0) AS lewat_8_30_hari,
    COALESCE(SUM(CASE WHEN (v_hari_ini - pj.jatuh_tempo) > 30 THEN pj.total ELSE 0 END), 0) AS lewat_gt_30_hari,
    COUNT(CASE WHEN pj.jatuh_tempo < v_hari_ini THEN 1 END)::integer AS jumlah_pesanan_lewat_tempo,
    COUNT(pj.id)::integer AS total_pesanan_dikirim
  FROM public.pesanan_jual pj
  WHERE pj.status = 'dikirim';
END;
$$;

-- 5. rpc_laporan_piutang_pesanan: Daftar pesanan belum lunas ('dikirim') beserta aging
CREATE OR REPLACE FUNCTION public.rpc_laporan_piutang_pesanan(
  p_pelanggan_id uuid DEFAULT NULL
)
RETURNS TABLE (
  pesanan_id     uuid,
  nomor          text,
  pelanggan_id   uuid,
  nama_toko      text,
  telepon        text,
  total          numeric,
  dikirim_pada   timestamptz,
  jatuh_tempo    date,
  hari_lewat     integer,
  kategori_aging text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hari_ini date;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  SELECT
    pj.id AS pesanan_id,
    pj.nomor,
    p.id AS pelanggan_id,
    p.nama_toko,
    p.telepon,
    pj.total,
    pj.dikirim_pada,
    pj.jatuh_tempo,
    GREATEST(0, (v_hari_ini - pj.jatuh_tempo))::integer AS hari_lewat,
    CASE
      WHEN pj.jatuh_tempo >= v_hari_ini THEN 'belum_jatuh_tempo'
      WHEN (v_hari_ini - pj.jatuh_tempo) BETWEEN 1 AND 7 THEN '1-7_hari'
      WHEN (v_hari_ini - pj.jatuh_tempo) BETWEEN 8 AND 30 THEN '8-30_hari'
      ELSE '>30_hari'
    END AS kategori_aging
  FROM public.pesanan_jual pj
  JOIN public.pelanggan p ON p.id = pj.pelanggan_id
  WHERE pj.status = 'dikirim'
    AND (p_pelanggan_id IS NULL OR pj.pelanggan_id = p_pelanggan_id)
  ORDER BY pj.jatuh_tempo ASC, pj.nomor ASC;
END;
$$;

-- ============================================================
-- Hak Akses: Cabut dari public/anon, grant ke authenticated
-- ============================================================
REVOKE ALL ON FUNCTION public.rpc_laporan_ringkasan(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_ringkasan(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_top_barang(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_top_barang(date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_top_pelanggan(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_top_pelanggan(date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_aging_piutang() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_aging_piutang() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_piutang_pesanan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_piutang_pesanan(uuid) TO authenticated;
