-- ============================================================
-- Migrasi: Pusat Tugas Harian dan Daftar Ambil Barang (Picking List)
-- 1. rpc_get_tugas_harian(): Agregasi status tugas dasbor per peran
-- 2. rpc_ambil_daftar_picking(p_pesanan_ids uuid[]): Agregat barang & rincian picking list
-- ============================================================

-- 1. rpc_get_tugas_harian
CREATE OR REPLACE FUNCTION public.rpc_get_tugas_harian()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_uid uuid;
  v_today date;
  v_res jsonb;
BEGIN
  v_peran := public.fn_peran();
  v_uid := auth.uid();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  -- Penjaga anonim: fn_peran() mengembalikan 'penjualan' sebagai fallback,
  -- sehingga identitas auth.uid() wajib diperiksa lebih dulu.
  IF v_uid IS NULL OR v_peran IS NULL THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF v_peran = 'penjualan' THEN
    SELECT jsonb_build_object(
      'peran', 'penjualan',
      'draf_saya', COALESCE((
        SELECT count(*)::int FROM public.pesanan_jual
        WHERE dibuat_oleh = v_uid AND status = 'draf'
      ), 0),
      'menunggu_kirim_saya', COALESCE((
        SELECT count(*)::int FROM public.pesanan_jual
        WHERE dibuat_oleh = v_uid AND status = 'dikonfirmasi'
      ), 0),
      'persetujuan_harga_menunggu_saya', COALESCE((
        SELECT count(*)::int FROM public.persetujuan_harga
        WHERE diajukan_oleh = v_uid AND status = 'menunggu'
      ), 0),
      'tagihan_tempo_hari_ini_saya', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE dibuat_oleh = v_uid AND klasifikasi = 'hari_ini'
      ), 0),
      'tagihan_overdue_saya', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE dibuat_oleh = v_uid AND klasifikasi LIKE 'overdue%'
      ), 0)
    ) INTO v_res;

  ELSIF v_peran = 'gudang' THEN
    SELECT jsonb_build_object(
      'peran', 'gudang',
      'pesanan_siap_kirim', COALESCE((
        SELECT count(*)::int FROM public.pesanan_jual
        WHERE status = 'dikonfirmasi'
      ), 0),
      'umur_pesanan_tertua_hari', GREATEST(COALESCE((
        SELECT max(v_today - (dikonfirmasi_pada AT TIME ZONE 'Asia/Jakarta')::date)::int
        FROM public.pesanan_jual
        WHERE status = 'dikonfirmasi' AND dikonfirmasi_pada IS NOT NULL
      ), 0), 0),
      'po_menunggu_penerimaan', COALESCE((
        SELECT count(*)::int FROM public.pembelian
        WHERE status = 'disetujui'
      ), 0),
      'stok_menipis', COALESCE((
        SELECT count(*)::int FROM public.v_barang
        WHERE stok_menipis = true
      ), 0),
      'opname_draf', COALESCE((
        SELECT count(*)::int FROM public.opname_stok
        WHERE status = 'draf'
      ), 0)
    ) INTO v_res;

  ELSIF v_peran = 'manajer' THEN
    SELECT jsonb_build_object(
      'peran', 'manajer',
      'persetujuan_harga_menunggu', COALESCE((
        SELECT count(*)::int FROM public.persetujuan_harga
        WHERE status = 'menunggu'
      ), 0),
      'po_menunggu_persetujuan', COALESCE((
        SELECT count(*)::int FROM public.pembelian
        WHERE status = 'diajukan'
      ), 0),
      'opname_menunggu_persetujuan', COALESCE((
        SELECT count(*)::int FROM public.opname_stok
        WHERE status = 'diajukan'
      ), 0),
      'tagihan_overdue', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE klasifikasi LIKE 'overdue%'
      ), 0),
      'tagihan_tempo_hari_ini', COALESCE((
        SELECT count(*)::int FROM public.v_tagihan
        WHERE klasifikasi = 'hari_ini'
      ), 0),
      'stok_menipis', COALESCE((
        SELECT count(*)::int FROM public.v_barang
        WHERE stok_menipis = true
      ), 0)
    ) INTO v_res;
  ELSE
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  RETURN v_res;
END;
$$;

-- 2. rpc_ambil_daftar_picking
CREATE OR REPLACE FUNCTION public.rpc_ambil_daftar_picking(p_pesanan_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_uid uuid;
  v_nama_user text;
  v_valid_count int;
  v_input_count int;
  v_ringkasan jsonb;
  v_rincian jsonb;
  v_total_kuantitas int;
BEGIN
  v_peran := public.fn_peran();
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'E0065: Hanya Staf Gudang dan Manajer yang berwenang mengakses daftar ambil barang';
  END IF;

  IF p_pesanan_ids IS NULL OR array_length(p_pesanan_ids, 1) IS NULL OR array_length(p_pesanan_ids, 1) = 0 THEN
    RAISE EXCEPTION 'E0063: Pilih minimal satu pesanan untuk membuat daftar ambil barang';
  END IF;

  -- Elemen NULL tidak boleh ikut lolos validasi hitungan.
  IF array_position(p_pesanan_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'E0064: Terdapat pesanan yang tidak valid atau bukan berstatus dikonfirmasi';
  END IF;

  SELECT count(DISTINCT x) INTO v_input_count FROM unnest(p_pesanan_ids) x;

  -- Validasi seluruh pesanan berstatus dikonfirmasi
  SELECT count(DISTINCT id) INTO v_valid_count
  FROM public.pesanan_jual
  WHERE id = ANY(p_pesanan_ids) AND status = 'dikonfirmasi';

  IF v_valid_count <> v_input_count THEN
    RAISE EXCEPTION 'E0064: Terdapat pesanan yang tidak valid atau bukan berstatus dikonfirmasi';
  END IF;

  SELECT nama_lengkap INTO v_nama_user
  FROM public.profiles
  WHERE id = v_uid;

  -- 1. Agregat per barang unik (diurutkan kode_barang ASC)
  -- PENTING: Zero-leakage: TIDAK mengambil harga_satuan, diskon, subtotal, hpp_satuan, dll.
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'barang_id', agg.barang_id,
        'kode_barang', agg.kode,
        'nama_barang', agg.nama,
        'satuan', agg.satuan,
        'total_diambil', agg.total_diambil,
        'stok_saat_ini', agg.stok,
        'stok_cukup', (agg.stok >= agg.total_diambil)
      ) ORDER BY agg.kode ASC
    ), '[]'::jsonb),
    COALESCE(SUM(agg.total_diambil), 0)
  INTO v_ringkasan, v_total_kuantitas
  FROM (
    SELECT
      b.id AS barang_id,
      b.kode,
      b.nama,
      b.satuan,
      b.stok,
      SUM(ip.jumlah)::int AS total_diambil
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = ANY(p_pesanan_ids)
    GROUP BY b.id, b.kode, b.nama, b.satuan, b.stok
  ) agg;

  -- 2. Rincian per pesanan (diurutkan nomor ASC)
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'pesanan_id', p.id,
        'nomor', p.nomor,
        'dikonfirmasi_pada', CASE
          WHEN p.dikonfirmasi_pada IS NULL THEN NULL
          ELSE to_char(p.dikonfirmasi_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS') || '+07:00'
        END,
        'pelanggan_kode', plg.kode,
        'pelanggan_nama', plg.nama_toko,
        'items', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'barang_id', b2.id,
              'kode_barang', b2.kode,
              'nama_barang', b2.nama,
              'satuan', b2.satuan,
              'jumlah', ip2.jumlah
            ) ORDER BY b2.kode ASC
          ), '[]'::jsonb)
          FROM public.item_pesanan_jual ip2
          JOIN public.barang b2 ON b2.id = ip2.barang_id
          WHERE ip2.pesanan_jual_id = p.id
        )
      ) ORDER BY p.nomor ASC
    ), '[]'::jsonb)
  INTO v_rincian
  FROM public.pesanan_jual p
  JOIN public.pelanggan plg ON plg.id = p.pelanggan_id
  WHERE p.id = ANY(p_pesanan_ids);

  RETURN jsonb_build_object(
    'metadata', jsonb_build_object(
      'total_pesanan', v_input_count,
      'total_item_barang', jsonb_array_length(v_ringkasan),
      'total_kuantitas', v_total_kuantitas,
      'dibuat_pada', to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD"T"HH24:MI:SS') || '+07:00',
      'dibuat_oleh_nama', COALESCE(v_nama_user, 'Petugas'),
      'dibuat_oleh_peran', v_peran
    ),
    'ringkasan_barang', v_ringkasan,
    'rincian_pesanan', v_rincian
  );
END;
$$;

-- Hak Akses Eksekusi
REVOKE ALL ON FUNCTION public.rpc_get_tugas_harian() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_tugas_harian() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_ambil_daftar_picking(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_ambil_daftar_picking(uuid[]) TO authenticated;
