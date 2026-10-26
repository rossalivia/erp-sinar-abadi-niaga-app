-- ============================================================
-- Migrasi: Penyesuaian Dashboard & Laporan Manajer Sesuai PRD Bab 9
-- CV Sinar Abadi Niaga
-- ============================================================

-- 1. rpc_laporan_bottom_barang: 5 Barang dengan margin terkecil (PRD Bab 9 §3)
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
  ORDER BY total_margin ASC, total_omzet ASC
  LIMIT p_limit;
END;
$$;

-- 2. rpc_laporan_aging_piutang: Rekapitulasi tepat 3 kelompok umur tagihan (PRD Bab 9 §4)
-- Total aging = belum_jatuh_tempo + lewat_1_30_hari + lewat_gt_30_hari = total_piutang_berjalan (dikonfirmasi + dikirim)
DROP FUNCTION IF EXISTS public.rpc_laporan_aging_piutang();

CREATE OR REPLACE FUNCTION public.rpc_laporan_aging_piutang()
RETURNS TABLE (
  total_piutang_berjalan        numeric,
  total_piutang_dikirim         numeric,
  belum_jatuh_tempo             numeric,
  lewat_1_30_hari               numeric,
  lewat_gt_30_hari              numeric,
  jumlah_pesanan_lewat_tempo    integer,
  total_pesanan                 integer,
  total_pesanan_dikirim         integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    COALESCE(SUM(pj.total), 0) AS total_piutang_berjalan,
    COALESCE(SUM(pj.total), 0) AS total_piutang_dikirim,
    COALESCE(SUM(CASE WHEN pj.status = 'dikonfirmasi' OR pj.jatuh_tempo >= v_hari_ini THEN pj.total ELSE 0 END), 0) AS belum_jatuh_tempo,
    COALESCE(SUM(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini AND (v_hari_ini - pj.jatuh_tempo) <= 30 THEN pj.total ELSE 0 END), 0) AS lewat_1_30_hari,
    COALESCE(SUM(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini AND (v_hari_ini - pj.jatuh_tempo) > 30 THEN pj.total ELSE 0 END), 0) AS lewat_gt_30_hari,
    COUNT(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini THEN 1 END)::integer AS jumlah_pesanan_lewat_tempo,
    COUNT(pj.id)::integer AS total_pesanan,
    COUNT(pj.id)::integer AS total_pesanan_dikirim
  FROM public.pesanan_jual pj
  WHERE pj.status IN ('dikonfirmasi', 'dikirim');
END;
$$;

-- 3. rpc_laporan_piutang: Rekapitulasi piutang berjalan per pelanggan dengan 3 kelompok umur (PRD Bab 9 §4)
DROP FUNCTION IF EXISTS public.rpc_laporan_piutang();

CREATE OR REPLACE FUNCTION public.rpc_laporan_piutang()
RETURNS TABLE (
  pelanggan_id              uuid,
  kode                      text,
  nama_toko                 text,
  batas_kredit              numeric,
  termin_hari               integer,
  total_piutang             numeric,
  piutang_belum_jatuh_tempo numeric,
  piutang_lewat_1_30        numeric,
  piutang_lewat_gt_30       numeric,
  piutang_lewat_jatuh_tempo numeric,
  ada_lewat_jatuh_tempo     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.batas_kredit,
    p.termin_hari,
    COALESCE(SUM(pj.total), 0) AS total_piutang,
    COALESCE(SUM(CASE WHEN pj.status = 'dikonfirmasi' OR pj.jatuh_tempo >= v_hari_ini THEN pj.total ELSE 0 END), 0) AS piutang_belum_jatuh_tempo,
    COALESCE(SUM(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini AND (v_hari_ini - pj.jatuh_tempo) <= 30 THEN pj.total ELSE 0 END), 0) AS piutang_lewat_1_30,
    COALESCE(SUM(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini AND (v_hari_ini - pj.jatuh_tempo) > 30 THEN pj.total ELSE 0 END), 0) AS piutang_lewat_gt_30,
    COALESCE(SUM(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini THEN pj.total ELSE 0 END), 0) AS piutang_lewat_jatuh_tempo,
    EXISTS (
      SELECT 1 FROM public.pesanan_jual pj2
      WHERE pj2.pelanggan_id = p.id
        AND pj2.status = 'dikirim'
        AND pj2.jatuh_tempo < v_hari_ini
    ) AS ada_lewat_jatuh_tempo
  FROM public.pelanggan p
  LEFT JOIN public.pesanan_jual pj ON pj.pelanggan_id = p.id AND pj.status IN ('dikonfirmasi', 'dikirim')
  GROUP BY p.id, p.kode, p.nama_toko, p.batas_kredit, p.termin_hari
  ORDER BY total_piutang DESC, p.nama_toko ASC;
END;
$$;

-- 4. rpc_laporan_piutang_pesanan: Daftar pesanan belum lunas ('dikonfirmasi' & 'dikirim') beserta aging 3 kelompok
DROP FUNCTION IF EXISTS public.rpc_laporan_piutang_pesanan(uuid);

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
SET search_path = public, pg_temp
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
    CASE
      WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini THEN (v_hari_ini - pj.jatuh_tempo)::integer
      ELSE 0
    END AS hari_lewat,
    CASE
      WHEN pj.status = 'dikonfirmasi' OR pj.jatuh_tempo >= v_hari_ini THEN 'belum_jatuh_tempo'
      WHEN (v_hari_ini - pj.jatuh_tempo) <= 30 THEN '1-30_hari'
      ELSE '>30_hari'
    END AS kategori_aging
  FROM public.pesanan_jual pj
  JOIN public.pelanggan p ON p.id = pj.pelanggan_id
  WHERE pj.status IN ('dikonfirmasi', 'dikirim')
    AND (p_pelanggan_id IS NULL OR pj.pelanggan_id = p_pelanggan_id)
  ORDER BY
    CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_hari_ini THEN 0 ELSE 1 END,
    pj.jatuh_tempo ASC NULLS LAST,
    pj.nomor ASC;
END;
$$;

-- Hak Akses Eksekusi: Cabut dari PUBLIC/anon, berikan ke authenticated
REVOKE ALL ON FUNCTION public.rpc_laporan_bottom_barang(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_bottom_barang(date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_aging_piutang() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_aging_piutang() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_piutang() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_piutang() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_laporan_piutang_pesanan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_laporan_piutang_pesanan(uuid) TO authenticated;
