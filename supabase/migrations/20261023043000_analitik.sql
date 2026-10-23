-- ============================================================
-- Migrasi: Modul Analitik Pelanggan dan Performa Sales (Khusus Manajer)
-- Berkas: 20261023043000_analitik.sql
-- Sesuai: docs/fitur-analitik.md (N1 s.d. N10)
-- ============================================================

-- 1. rpc_analitik_performa_sales: Kinerja staf penjualan
CREATE OR REPLACE FUNCTION public.rpc_analitik_performa_sales(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL
)
RETURNS TABLE (
  sales_id           uuid,
  nama_sales         text,
  email              text,
  aktif              boolean,
  jumlah_pesanan     integer,
  pesanan_dikirim    integer,
  pesanan_lunas      integer,
  total_omzet        numeric,
  total_hpp          numeric,
  total_margin       numeric,
  margin_persen      numeric,
  piutang_berjalan   numeric,
  jumlah_draf        integer
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
  WITH sales_profiles AS (
    SELECT p.id, p.nama_lengkap, u.email, p.aktif
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.peran = 'penjualan'
  ),
  transaksi_periode AS (
    SELECT
      pj.dibuat_oleh AS sales_id,
      COUNT(pj.id)::integer AS jumlah_pesanan,
      COUNT(CASE WHEN pj.status = 'dikirim' THEN 1 END)::integer AS pesanan_dikirim,
      COUNT(CASE WHEN pj.status = 'lunas' THEN 1 END)::integer AS pesanan_lunas,
      COALESCE(SUM(pj.total), 0) AS total_omzet,
      COALESCE(SUM(ip_agregat.total_hpp_pesanan), 0) AS total_hpp
    FROM public.pesanan_jual pj
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS total_hpp_pesanan
      FROM public.item_pesanan_jual ip
      WHERE ip.pesanan_jual_id = pj.id
    ) ip_agregat ON true
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
    GROUP BY pj.dibuat_oleh
  ),
  status_terkini AS (
    SELECT
      pj.dibuat_oleh AS sales_id,
      COALESCE(SUM(CASE WHEN pj.status = 'dikirim' THEN pj.total ELSE 0 END), 0) AS piutang_berjalan,
      COUNT(CASE WHEN pj.status = 'draf' THEN 1 END)::integer AS jumlah_draf
    FROM public.pesanan_jual pj
    GROUP BY pj.dibuat_oleh
  )
  SELECT
    sp.id AS sales_id,
    sp.nama_lengkap AS nama_sales,
    COALESCE(sp.email, '-') AS email,
    sp.aktif,
    COALESCE(tp.jumlah_pesanan, 0) AS jumlah_pesanan,
    COALESCE(tp.pesanan_dikirim, 0) AS pesanan_dikirim,
    COALESCE(tp.pesanan_lunas, 0) AS pesanan_lunas,
    COALESCE(tp.total_omzet, 0) AS total_omzet,
    COALESCE(tp.total_hpp, 0) AS total_hpp,
    (COALESCE(tp.total_omzet, 0) - COALESCE(tp.total_hpp, 0)) AS total_margin,
    CASE
      WHEN COALESCE(tp.total_omzet, 0) > 0 THEN
        round(((COALESCE(tp.total_omzet, 0) - COALESCE(tp.total_hpp, 0)) / tp.total_omzet * 100.0), 2)
      ELSE 0
    END AS margin_persen,
    COALESCE(st.piutang_berjalan, 0) AS piutang_berjalan,
    COALESCE(st.jumlah_draf, 0) AS jumlah_draf
  FROM sales_profiles sp
  LEFT JOIN transaksi_periode tp ON tp.sales_id = sp.id
  LEFT JOIN status_terkini st ON st.sales_id = sp.id
  ORDER BY total_omzet DESC, total_margin DESC, sp.nama_lengkap ASC;
END;
$$;

-- 2. rpc_analitik_top_pelanggan: Pelanggan teratas beserta kontribusi omzet & status kredit
CREATE OR REPLACE FUNCTION public.rpc_analitik_top_pelanggan(
  p_dari   date DEFAULT NULL,
  p_sampai date DEFAULT NULL,
  p_limit  integer DEFAULT 10
)
RETURNS TABLE (
  pelanggan_id            uuid,
  kode                    text,
  nama_toko               text,
  telepon                 text,
  jumlah_pesanan          integer,
  total_omzet             numeric,
  total_hpp               numeric,
  total_margin            numeric,
  margin_persen           numeric,
  kontribusi_omzet_persen numeric,
  batas_kredit            numeric,
  sisa_kredit             numeric,
  status_kredit           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dari        date;
  v_sampai      date;
  v_total_semua numeric;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_sampai := COALESCE(p_sampai, (now() AT TIME ZONE 'Asia/Jakarta')::date);
  v_dari   := COALESCE(p_dari, v_sampai - interval '7 weeks');

  -- Hitung total keseluruhan omzet pada periode ini untuk pembagi kontribusi %
  SELECT COALESCE(SUM(pj.total), 0)
  INTO v_total_semua
  FROM public.pesanan_jual pj
  WHERE pj.status IN ('dikirim', 'lunas')
    AND pj.dikirim_pada IS NOT NULL
    AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai;

  RETURN QUERY
  WITH pelanggan_omzet AS (
    SELECT
      pj.pelanggan_id,
      COUNT(DISTINCT pj.id)::integer AS jml_pesanan,
      COALESCE(SUM(pj.total), 0) AS omzet_cust,
      COALESCE(SUM(ip_sub.hpp_total), 0) AS hpp_cust
    FROM public.pesanan_jual pj
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(ip.hpp_satuan, 0) * ip.jumlah) AS hpp_total
      FROM public.item_pesanan_jual ip
      WHERE ip.pesanan_jual_id = pj.id
    ) ip_sub ON true
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
      AND (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date BETWEEN v_dari AND v_sampai
    GROUP BY pj.pelanggan_id
  )
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.telepon,
    po.jml_pesanan AS jumlah_pesanan,
    po.omzet_cust AS total_omzet,
    po.hpp_cust AS total_hpp,
    (po.omzet_cust - po.hpp_cust) AS total_margin,
    CASE
      WHEN po.omzet_cust > 0 THEN
        round(((po.omzet_cust - po.hpp_cust) / po.omzet_cust * 100.0), 2)
      ELSE 0
    END AS margin_persen,
    CASE
      WHEN v_total_semua > 0 THEN
        round((po.omzet_cust / v_total_semua * 100.0), 2)
      ELSE 0
    END AS kontribusi_omzet_persen,
    p.batas_kredit,
    kr.sisa_kredit,
    CASE
      WHEN kr.punya_overdue THEN 'overdue'
      WHEN kr.sisa_kredit < 0 AND p.batas_kredit > 0 THEN 'overlimit'
      ELSE 'lancar'
    END AS status_kredit
  FROM pelanggan_omzet po
  JOIN public.pelanggan p ON p.id = po.pelanggan_id
  CROSS JOIN LATERAL public.fn_hitung_kredit_pelanggan(p.id) kr
  ORDER BY po.omzet_cust DESC, total_margin DESC
  LIMIT LEAST(GREATEST(1, p_limit), 50);
END;
$$;

-- 3. rpc_analitik_pelanggan_tidak_aktif: Akun pasif / at-risk churn
CREATE OR REPLACE FUNCTION public.rpc_analitik_pelanggan_tidak_aktif(
  p_ambang_hari integer DEFAULT 30
)
RETURNS TABLE (
  pelanggan_id             uuid,
  kode                     text,
  nama_toko                text,
  telepon                  text,
  alamat                   text,
  terdaftar_pada           timestamptz,
  pesanan_terakhir_pada    timestamptz,
  nomor_pesanan_terakhir   text,
  hari_tidak_aktif         integer,
  total_pesanan_historis   integer,
  total_omzet_historis     numeric,
  piutang_berjalan         numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hari_ini   date;
  v_ambang     integer;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_ambang := GREATEST(7, COALESCE(p_ambang_hari, 30));
  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  WITH order_terakhir AS (
    SELECT DISTINCT ON (pj.pelanggan_id)
      pj.pelanggan_id,
      pj.nomor,
      pj.dikirim_pada,
      (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date AS tgl_kirim
    FROM public.pesanan_jual pj
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
    ORDER BY pj.pelanggan_id, pj.dikirim_pada DESC
  ),
  rekap_historis AS (
    SELECT
      pj.pelanggan_id,
      COUNT(pj.id)::integer AS total_order,
      COALESCE(SUM(pj.total), 0) AS total_omzet,
      COALESCE(SUM(CASE WHEN pj.status = 'dikirim' THEN pj.total ELSE 0 END), 0) AS outstanding_piutang
    FROM public.pesanan_jual pj
    WHERE pj.status IN ('dikirim', 'lunas')
    GROUP BY pj.pelanggan_id
  )
  SELECT
    p.id AS pelanggan_id,
    p.kode,
    p.nama_toko,
    p.telepon,
    p.alamat,
    p.dibuat_pada AS terdaftar_pada,
    ot.dikirim_pada AS pesanan_terakhir_pada,
    ot.nomor AS nomor_pesanan_terakhir,
    CASE
      WHEN ot.tgl_kirim IS NOT NULL THEN (v_hari_ini - ot.tgl_kirim)::integer
      ELSE (v_hari_ini - (p.dibuat_pada AT TIME ZONE 'Asia/Jakarta')::date)::integer
    END AS hari_tidak_aktif,
    COALESCE(rh.total_order, 0) AS total_pesanan_historis,
    COALESCE(rh.total_omzet, 0) AS total_omzet_historis,
    COALESCE(rh.outstanding_piutang, 0) AS piutang_berjalan
  FROM public.pelanggan p
  LEFT JOIN order_terakhir ot ON ot.pelanggan_id = p.id
  LEFT JOIN rekap_historis rh ON rh.pelanggan_id = p.id
  WHERE p.aktif = true
    AND (
      ot.tgl_kirim IS NULL
      OR (v_hari_ini - ot.tgl_kirim) >= v_ambang
    )
  ORDER BY hari_tidak_aktif DESC, total_omzet_historis DESC;
END;
$$;

-- 4. rpc_analitik_barang_tidak_bergerak: Dead stock & modal tertahan
CREATE OR REPLACE FUNCTION public.rpc_analitik_barang_tidak_bergerak(
  p_ambang_hari integer DEFAULT 30
)
RETURNS TABLE (
  barang_id                uuid,
  kode                     text,
  nama                     text,
  satuan                   text,
  stok_saat_ini            integer,
  stok_minimum             integer,
  harga_pokok              numeric,
  harga_jual               numeric,
  nilai_stok_mengendap     numeric,
  penjualan_terakhir_pada  timestamptz,
  nomor_pesanan_terakhir   text,
  hari_mengendap           integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hari_ini   date;
  v_ambang     integer;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_ambang := GREATEST(7, COALESCE(p_ambang_hari, 30));
  v_hari_ini := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  WITH pertama_masuk AS (
    SELECT
      ms.barang_id,
      MIN(ms.dibuat_pada) AS pertama_masuk_pada,
      (MIN(ms.dibuat_pada) AT TIME ZONE 'Asia/Jakarta')::date AS tgl_masuk
    FROM public.mutasi_stok ms
    GROUP BY ms.barang_id
  ),
  penjualan_terakhir AS (
    SELECT DISTINCT ON (ip.barang_id)
      ip.barang_id,
      pj.nomor,
      pj.dikirim_pada,
      (pj.dikirim_pada AT TIME ZONE 'Asia/Jakarta')::date AS tgl_kirim
    FROM public.item_pesanan_jual ip
    JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
    WHERE pj.status IN ('dikirim', 'lunas')
      AND pj.dikirim_pada IS NOT NULL
    ORDER BY ip.barang_id, pj.dikirim_pada DESC
  )
  SELECT
    b.id AS barang_id,
    b.kode,
    b.nama,
    b.satuan,
    b.stok AS stok_saat_ini,
    b.stok_minimum,
    b.harga_pokok,
    b.harga_jual,
    (b.stok * b.harga_pokok) AS nilai_stok_mengendap,
    pt.dikirim_pada AS penjualan_terakhir_pada,
    pt.nomor AS nomor_pesanan_terakhir,
    CASE
      WHEN pt.tgl_kirim IS NOT NULL THEN (v_hari_ini - pt.tgl_kirim)::integer
      WHEN pm.tgl_masuk IS NOT NULL THEN (v_hari_ini - pm.tgl_masuk)::integer
      ELSE (v_hari_ini - (b.diperbarui_pada AT TIME ZONE 'Asia/Jakarta')::date)::integer
    END AS hari_mengendap
  FROM public.barang b
  LEFT JOIN penjualan_terakhir pt ON pt.barang_id = b.id
  LEFT JOIN pertama_masuk pm ON pm.barang_id = b.id
  WHERE b.aktif = true
    AND b.stok > 0
    AND (
      pt.tgl_kirim IS NULL
      OR (v_hari_ini - pt.tgl_kirim) >= v_ambang
    )
  ORDER BY nilai_stok_mengendap DESC, hari_mengendap DESC;
END;
$$;

-- Hak Akses: Cabut dari public & anon, grant ke authenticated
REVOKE ALL ON FUNCTION public.rpc_analitik_performa_sales(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_analitik_performa_sales(date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_analitik_top_pelanggan(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_analitik_top_pelanggan(date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_analitik_pelanggan_tidak_aktif(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_analitik_pelanggan_tidak_aktif(integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_analitik_barang_tidak_bergerak(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_analitik_barang_tidak_bergerak(integer) TO authenticated;
