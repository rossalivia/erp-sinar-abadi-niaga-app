-- ============================================================
-- BUNDLE MIGRASI LANJUTAN CLOUD (24 Okt - 26 Okt 2026)
-- ============================================================

-- ------------------------------------------------------------
-- File: 20261024223000_pembatalan_pembelian.sql
-- ------------------------------------------------------------
-- ==============================================================================
-- Migrasi: Pembatalan Pembelian (PO) sesuai PRD Bab 6.2 & BR-09
-- Menambahkan status 'dibatalkan', kolom audit pembatalan, pembaruan view,
-- dan fungsi rpc_batalkan_pembelian dengan penegakan otorisasi ketat.
-- ==============================================================================

-- 1. Perbarui CHECK constraint status pembelian
ALTER TABLE public.pembelian
  DROP CONSTRAINT IF EXISTS pembelian_status_check;

ALTER TABLE public.pembelian
  ADD CONSTRAINT pembelian_status_check
  CHECK (status IN ('diajukan', 'disetujui', 'ditolak', 'diterima', 'dibatalkan'));

-- 2. Tambahkan kolom pembatalan
ALTER TABLE public.pembelian
  ADD COLUMN IF NOT EXISTS dibatalkan_oleh uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS dibatalkan_pada timestamptz,
  ADD COLUMN IF NOT EXISTS alasan_batal text;

-- 3. Perbarui view v_pembelian (non-manajer: tanpa harga_beli_satuan)
CREATE OR REPLACE VIEW public.v_pembelian AS
SELECT
  p.id,
  p.nomor,
  p.pemasok_id,
  p.barang_id,
  p.jumlah_dipesan,
  p.jumlah_diterima,
  p.status,
  p.alasan_tolak,
  p.diajukan_oleh,
  p.diajukan_pada,
  p.diputuskan_oleh,
  p.diputuskan_pada,
  p.diterima_oleh,
  p.diterima_pada,
  p.dibatalkan_oleh,
  p.dibatalkan_pada,
  p.alasan_batal
FROM public.pembelian p;

GRANT SELECT ON public.v_pembelian TO authenticated;

-- 4. Perbarui view v_pembelian_manajer (khusus manajer: memuat harga_beli_satuan)
DROP VIEW IF EXISTS public.v_pembelian_manajer;

CREATE VIEW public.v_pembelian_manajer AS
SELECT
  p.id,
  p.nomor,
  p.pemasok_id,
  p.barang_id,
  p.jumlah_dipesan,
  p.jumlah_diterima,
  p.harga_beli_satuan,
  p.status,
  p.alasan_tolak,
  p.diajukan_oleh,
  p.diajukan_pada,
  p.diputuskan_oleh,
  p.diputuskan_pada,
  p.diterima_oleh,
  p.diterima_pada,
  p.dibatalkan_oleh,
  p.dibatalkan_pada,
  p.alasan_batal,
  ((p.jumlah_dipesan)::numeric * COALESCE(p.harga_beli_satuan, (0)::numeric)) AS total_estimasi_beli
FROM public.pembelian p
WHERE (public.fn_is_manajer() = true);

GRANT SELECT ON public.v_pembelian_manajer TO authenticated;

-- 5. RPC rpc_batalkan_pembelian (Gudang & Manajer sesuai hak akses)
CREATE OR REPLACE FUNCTION public.rpc_batalkan_pembelian(
  p_pembelian_id uuid,
  p_alasan       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran        text;
  v_po           record;
  v_alasan_clean text;
BEGIN
  -- 1. Otorisasi peran dasar: hanya Gudang dan Manajer yang berwenang dalam pengadaan
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- 2. Kunci baris pembelian secara deterministik (FOR UPDATE)
  SELECT * INTO v_po FROM public.pembelian WHERE id = p_pembelian_id FOR UPDATE;
  IF v_po.id IS NULL THEN
    RAISE EXCEPTION 'Pembelian tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  -- 3. Validasi status yang dapat dibatalkan (hanya diajukan atau disetujui)
  IF v_po.status NOT IN ('diajukan', 'disetujui') THEN
    RAISE EXCEPTION 'Pembelian dengan status ini tidak dapat dibatalkan' USING ERRCODE = 'E0076';
  END IF;

  -- 4. Validasi aturan pembatalan per status sesuai PRD Bab 6.2 & BR-09:
  IF v_po.status = 'diajukan' THEN
    -- diajukan -> dibatalkan: HANYA pengaju PO (diajukan_oleh = auth.uid())
    IF v_po.diajukan_oleh <> auth.uid() THEN
      RAISE EXCEPTION 'Hanya pengaju yang berwenang membatalkan pengajuan pembelian' USING ERRCODE = 'E0074';
    END IF;
  ELSIF v_po.status = 'disetujui' THEN
    -- disetujui -> dibatalkan: HANYA Manajer, dengan syarat barang belum diterima
    IF NOT public.fn_is_manajer() THEN
      RAISE EXCEPTION 'Hanya Manajer yang berwenang membatalkan pembelian yang disetujui' USING ERRCODE = 'E0075';
    END IF;

    IF v_po.jumlah_diterima > 0 THEN
      RAISE EXCEPTION 'Pembelian yang sudah diterima barangnya tidak dapat dibatalkan' USING ERRCODE = 'E0077';
    END IF;
  END IF;

  v_alasan_clean := NULLIF(btrim(COALESCE(p_alasan, '')), '');

  -- 5. Mutasi status pembelian
  UPDATE public.pembelian
  SET status = 'dibatalkan',
      dibatalkan_oleh = auth.uid(),
      dibatalkan_pada = now(),
      alasan_batal = v_alasan_clean
  WHERE id = p_pembelian_id;

  -- 6. Tulis audit_log (nilai sebelum dan sesudah) tanpa membocorkan harga_beli
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'batalkan_pembelian',
    'pembelian',
    p_pembelian_id,
    jsonb_build_object('status', v_po.status),
    jsonb_build_object('status', 'dibatalkan', 'alasan', v_alasan_clean)
  );

  RETURN jsonb_build_object('id', p_pembelian_id, 'status', 'dibatalkan');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_batalkan_pembelian(uuid, text) TO authenticated;


-- ------------------------------------------------------------
-- File: 20261026150000_koreksi_pelunasan_manajer.sql
-- ------------------------------------------------------------
-- ============================================================
-- Migrasi: Koreksi Pelunasan Khusus Manajer (PRD BR-07, BR-12)
-- 1. rpc_catat_pelunasan:
--    - Tolak peran selain Manajer dengan error E0078
--    - Hanya izinkan status 'dikirim' -> 'lunas' (bila bukan, tolak E0015)
--    - Mengisi kolom dilunasi_pada
--    - Auto-close tagihan Mayar jika ada (M9)
--    - Catat audit_log dengan aksi 'pelunasan':
--      nilai_lama: {"status": "dikirim"}
--      nilai_baru: {"status": "lunas", "dilunasi_pada": ...}
-- 2. rpc_lunasi_pesanan (alias):
--    - Mengarahkan ke rpc_catat_pelunasan
-- 3. Pencabutan izin EXECUTE dari PUBLIC & anon
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_catat_pelunasan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pesanan record;
  v_dilunasi_pada timestamptz;
BEGIN
  -- 1. Penegakan wewenang: HANYA Manajer (PRD BR-07 / BR-12)
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Hanya Manajer yang berwenang mencatat pelunasan' USING ERRCODE = 'E0078';
  END IF;

  -- 2. Kunci baris pesanan jual untuk integritas & cegah race condition
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Data tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  -- 3. Transisi status yang valid HANYA dikirim -> lunas
  IF v_pesanan.status <> 'dikirim' THEN
    RAISE EXCEPTION 'Perpindahan status atau tindakan tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  v_dilunasi_pada := clock_timestamp();

  -- 4. Tandai pesanan lunas dan catat timestamp pelunasan
  UPDATE public.pesanan_jual
  SET status = 'lunas',
      dilunasi_pada = v_dilunasi_pada
  WHERE id = p_pesanan_id;

  -- 5. Tutup otomatis tagihan Mayar aktif jika ada (M9)
  UPDATE public.tagihan_mayar
  SET status = 'ditutup',
      catatan_tinjau = 'Ditutup otomatis karena pesanan telah dilunasi manual oleh Manajer',
      diperbarui_pada = now()
  WHERE pesanan_jual_id = p_pesanan_id
    AND status = 'dibuat';

  -- 6. Tulis audit log aksi 'pelunasan' (PRD BR-12)
  INSERT INTO public.audit_log (
    pelaku_id,
    aksi,
    nama_tabel,
    data_id,
    nilai_lama,
    nilai_baru
  )
  VALUES (
    auth.uid(),
    'pelunasan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'dikirim'),
    jsonb_build_object('status', 'lunas', 'dilunasi_pada', v_dilunasi_pada)
  );

  RETURN jsonb_build_object(
    'id', p_pesanan_id,
    'status', 'lunas',
    'dilunasi_pada', v_dilunasi_pada
  );
END;
$$;

-- Alias fungsi rpc_lunasi_pesanan
CREATE OR REPLACE FUNCTION public.rpc_lunasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.rpc_catat_pelunasan(p_pesanan_id);
$$;

-- Cabut EXECUTE dari PUBLIC dan anon
REVOKE ALL ON FUNCTION public.rpc_catat_pelunasan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_catat_pelunasan(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_lunasi_pesanan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_lunasi_pesanan(uuid) TO authenticated;


-- ------------------------------------------------------------
-- File: 20261026160000_dashboard_laporan_prd_bab_9.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- File: 20261026210000_perbaikan_integrasi_mayar.sql
-- ------------------------------------------------------------
-- ============================================================
-- Migrasi: Perbaikan Integrasi Mayar (PRD 11.3)
-- Timestamp: 20261026210000
-- ============================================================

-- 1. Fungsi Cek Idempotensi Webhook Event Selesai
CREATE OR REPLACE FUNCTION public.rpc_sistem_cek_webhook_event_selesai(
  p_kunci_unik text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.mayar_webhook_event
    WHERE kunci_unik = p_kunci_unik
      AND hasil IN ('diproses', 'diabaikan')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sistem_cek_webhook_event_selesai(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_cek_webhook_event_selesai(text) TO service_role;

-- 2. Fungsi Transaksional Pelunasan Otomatis dari Mayar
CREATE OR REPLACE FUNCTION public.rpc_sistem_lunaskan_dari_mayar(
  p_tagihan_id uuid,
  p_referensi_transaksi text,
  p_jumlah_terverifikasi numeric,
  p_kunci_unik text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tagihan record;
  v_pesanan record;
  v_anomali text := NULL;
  v_round_verified numeric;
  v_round_tagihan numeric;
  v_round_pesanan numeric;
BEGIN
  -- Ambil data tagihan awal
  SELECT * INTO v_tagihan
  FROM public.tagihan_mayar
  WHERE id = p_tagihan_id;

  IF v_tagihan.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'tidak_ditemukan',
      'message', 'Tagihan Mayar tidak ditemukan di basis data'
    );
  END IF;

  -- URUTAN PENGUNCIAN BARIS ANTI-DEADLOCK (AGENTS.md 8.1):
  -- 1. Kunci pesanan_jual terlebih dahulu
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = v_tagihan.pesanan_jual_id
  FOR UPDATE;

  -- 2. Kunci tagihan_mayar kedua
  SELECT * INTO v_tagihan
  FROM public.tagihan_mayar
  WHERE id = p_tagihan_id
  FOR UPDATE;

  -- Pembulatan ke bilangan bulat Rupiah (sesuai spesifikasi)
  v_round_verified := round(COALESCE(p_jumlah_terverifikasi, 0));
  v_round_tagihan  := round(COALESCE(v_tagihan.jumlah, 0));
  v_round_pesanan  := round(COALESCE(v_pesanan.total, 0));

  -- Validasi Syarat Pelunasan Otomatis
  IF v_pesanan.status = 'lunas' THEN
    v_anomali := 'Pesanan sudah berstatus lunas (potensi pembayaran ganda)';
  ELSIF v_pesanan.status <> 'dikirim' THEN
    v_anomali := 'Status pesanan bukan dikirim (status saat ini: ' || v_pesanan.status || ')';
  ELSIF v_tagihan.status <> 'dibuat' AND v_tagihan.status <> 'kedaluwarsa' THEN
    v_anomali := 'Status tagihan bukan dibuat atau kedaluwarsa (status saat ini: ' || v_tagihan.status || ')';
  ELSIF v_round_verified <> v_round_tagihan OR v_round_verified <> v_round_pesanan THEN
    v_anomali := 'Nominal terverifikasi (' || v_round_verified || ') tidak sesuai dengan tagihan (' || v_round_tagihan || ') atau total pesanan (' || v_round_pesanan || ')';
  END IF;

  -- JIKA ADA ANOMALI:
  IF v_anomali IS NOT NULL THEN
    -- Update tagihan menjadi perlu_tinjau
    UPDATE public.tagihan_mayar
    SET status = 'perlu_tinjau',
        catatan_tinjau = v_anomali,
        mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi),
        diperbarui_pada = now()
    WHERE id = p_tagihan_id;

    -- Catat audit log anomali
    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      NULL,
      'anomali_pembayaran_mayar',
      'tagihan_mayar',
      p_tagihan_id,
      jsonb_build_object('status', v_tagihan.status),
      jsonb_build_object(
        'status', 'perlu_tinjau',
        'anomali', v_anomali,
        'referensi', p_referensi_transaksi,
        'jumlah_diterima', v_round_verified
      )
    );

    -- Tandai event selesai/diabaikan jika ada kunci unik agar tidak berulang
    IF p_kunci_unik IS NOT NULL THEN
      INSERT INTO public.mayar_webhook_event (
        kunci_unik, jenis_event, referensi_id, hasil, status_mayar, jumlah_tercatat, dibuat_pada
      )
      VALUES (
        p_kunci_unik, 'payment.received', v_tagihan.mayar_invoice_id, 'diabaikan', 'perlu_tinjau', v_round_verified, now()
      )
      ON CONFLICT (kunci_unik) DO UPDATE SET
        hasil = 'diabaikan',
        status_mayar = 'perlu_tinjau';
    END IF;

    -- Pesanan TIDAK diubah
    RETURN jsonb_build_object(
      'success', false,
      'status', 'perlu_tinjau',
      'message', v_anomali
    );
  END IF;

  -- JIKA SUKSES (LUNAS):
  -- 1. Update pesanan_jual
  UPDATE public.pesanan_jual
  SET status = 'lunas',
      dilunasi_pada = now()
  WHERE id = v_pesanan.id;

  -- 2. Update tagihan_mayar
  UPDATE public.tagihan_mayar
  SET status = 'dibayar',
      dibayar_pada = now(),
      mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi),
      diperbarui_pada = now()
  WHERE id = p_tagihan_id;

  -- 3. Catat audit_log dengan aksi 'pelunasan' (pelaku NULL = Sistem Mayar)
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    NULL,
    'pelunasan',
    'pesanan_jual',
    v_pesanan.id,
    jsonb_build_object('status', 'dikirim'),
    jsonb_build_object(
      'status', 'lunas',
      'metode', 'mayar',
      'keterangan', 'Pelunasan via Mayar',
      'tagihan_id', p_tagihan_id,
      'referensi', p_referensi_transaksi,
      'jumlah', v_round_verified
    )
  );

  -- 4. Tandai kunci webhook event sebagai diproses dalam transaksi yang sama
  IF p_kunci_unik IS NOT NULL THEN
    INSERT INTO public.mayar_webhook_event (
      kunci_unik, jenis_event, referensi_id, hasil, status_mayar, jumlah_tercatat, dibuat_pada
    )
    VALUES (
      p_kunci_unik, 'payment.received', v_tagihan.mayar_invoice_id, 'diproses', 'paid', v_round_verified, now()
    )
    ON CONFLICT (kunci_unik) DO UPDATE SET
      hasil = 'diproses',
      status_mayar = 'paid';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'lunas',
    'message', 'Pesanan berhasil dilunasi via Mayar'
  );
END;
$$;

-- Cabut hak akses dari publik dan authenticated, berikan HANYA ke service_role
REVOKE ALL ON FUNCTION public.rpc_sistem_lunaskan_dari_mayar(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_lunaskan_dari_mayar(uuid, text, numeric, text) TO service_role;


-- ------------------------------------------------------------
-- File: 20261026220000_perketat_diskon_dan_br04.sql
-- ------------------------------------------------------------
-- ============================================================
-- MIGRASI: Perketat Aturan Diskon dan Penegasan BR-04 Persetujuan Harga
-- Berkas: supabase/migrations/20261026220000_perketat_diskon_dan_br04.sql
-- Sesuai:
-- 1. rpc_konfirmasi_pesanan oleh Staf Penjualan SELALU ditolak jika subtotal < hpp * jumlah
--    dengan pesan persis "Harga di bawah batas, minta persetujuan Manajer" (E0011).
--    Staf tidak boleh mengonfirmasi pesanan meskipun tiketnya disetujui. Konfirmasi dilakukan oleh Manajer.
-- 2. Diskon: database MENOLAK keras (bukan clamp) diskon > 10% untuk Staf Penjualan (E0009)
--    dan diskon > 25% untuk semua peran (E0010).
-- 3. Konfirmasi oleh Staf Penjualan ditolak jika ada baris diskon > 10% (mencegah draf diedit Manajer
--    lalu dikonfirmasi staf).
-- 4. zero-leakage: respons dan view tiket untuk staf tidak memuat hpp/margin.
-- ============================================================

-- 1. PEMBARUAN: rpc_simpan_draf_pesanan (Penolakan Keras Batas Diskon Tanpa Clamp)
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items jsonb,
  p_pesanan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran         text;
  v_pesanan_id    uuid;
  v_nomor         text;
  v_item_count    integer;
  v_item          jsonb;
  v_barang_id     uuid;
  v_barang_ids    uuid[] := '{}';
  v_jumlah        integer;
  v_diskon        numeric;
  v_harga_satuan  numeric;
  v_barang_aktif  boolean;
  v_subtotal      numeric;
  v_total         numeric := 0;
  v_pelanggan_ada boolean;
  v_pelanggan_aktif boolean;
  v_pesanan_status text;
  v_pesanan_pembuat uuid;
BEGIN
  -- Periksa peran pemanggil: hanya staf penjualan dan manajer
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi pelanggan ada & aktif (BR-01, E07)
  SELECT true, aktif INTO v_pelanggan_ada, v_pelanggan_aktif
  FROM public.pelanggan WHERE id = p_pelanggan_id;

  IF v_pelanggan_ada IS NULL OR v_pelanggan_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- Validasi jumlah item 1 s.d. 20 (BR-02, E03)
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- Update draf eksisting vs Insert draf baru
  IF p_pesanan_id IS NOT NULL THEN
    -- P9 Urutan Kunci 1: pesanan_jual FOR UPDATE
    SELECT status, dibuat_oleh, nomor INTO v_pesanan_status, v_pesanan_pembuat, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id
    FOR UPDATE;

    IF v_pesanan_status IS NULL THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    -- Validasi wewenang edit
    IF v_peran = 'penjualan' AND v_pesanan_pembuat <> auth.uid() THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    IF v_pesanan_status <> 'draf' THEN
      RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
    END IF;

    v_pesanan_id := p_pesanan_id;

    UPDATE public.pesanan_jual
    SET pelanggan_id = p_pelanggan_id
    WHERE id = v_pesanan_id;

    -- Jika draf diubah, batalkan pengajuan persetujuan harga yang sedang aktif
    UPDATE public.persetujuan_harga
    SET status = 'kedaluwarsa'
    WHERE pesanan_jual_id = v_pesanan_id
      AND status IN ('menunggu', 'disetujui');
  ELSE
    -- Generate nomor baru SO-YYYY-NNNNNN
    v_nomor := format(
      'SO-%s-%s',
      to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
      lpad(nextval('public.seq_pesanan_jual')::text, 6, '0')
    );

    INSERT INTO public.pesanan_jual (
      nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_nomor, p_pelanggan_id, 'draf', 0, auth.uid(), now()
    )
    RETURNING id INTO v_pesanan_id;
  END IF;

  -- Hapus item lama terlebih dahulu untuk penggantian bersih
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id = v_pesanan_id;

  -- Iterasi & validasi item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_barang_id := (v_item->>'barang_id')::uuid;
    v_jumlah    := COALESCE((v_item->>'jumlah')::integer, 0);
    v_diskon    := COALESCE((v_item->>'diskon_persen')::numeric, 0);

    -- BR-02: jumlah >= 1
    IF v_jumlah < 1 THEN
      RAISE EXCEPTION 'Jumlah minimal 1' USING ERRCODE = 'E0004';
    END IF;

    -- BR-02: barang unik per pesanan
    IF v_barang_id = ANY(v_barang_ids) THEN
      RAISE EXCEPTION 'Barang sudah ada di pesanan ini' USING ERRCODE = 'E0005';
    END IF;
    v_barang_ids := array_append(v_barang_ids, v_barang_id);

    -- Cek keberadaan & keaktifan barang
    SELECT harga_jual, aktif INTO v_harga_satuan, v_barang_aktif
    FROM public.barang WHERE id = v_barang_id;

    IF v_harga_satuan IS NULL OR v_barang_aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- BR-03: Batas diskon per peran (DITOLAK KERAS TANPA CLAMP DIAM-DIAM)
    IF v_peran = 'penjualan' THEN
      IF v_diskon < 0 OR v_diskon > 10 THEN
        RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
      END IF;
    ELSE -- manajer
      IF v_diskon < 0 OR v_diskon > 25 THEN
        RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
      END IF;
    END IF;

    -- BR-03: Subtotal = ROUND(jumlah * harga_satuan * (100 - diskon) / 100)
    v_subtotal := round(v_jumlah * v_harga_satuan * (100.0 - v_diskon) / 100.0);
    v_total    := v_total + v_subtotal;

    INSERT INTO public.item_pesanan_jual (
      pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal
    )
    VALUES (
      v_pesanan_id, v_barang_id, v_jumlah, v_harga_satuan, v_diskon, v_subtotal
    );
  END LOOP;

  -- Perbarui total pesanan
  UPDATE public.pesanan_jual SET total = v_total WHERE id = v_pesanan_id;

  RETURN jsonb_build_object(
    'id',    v_pesanan_id,
    'nomor', v_nomor,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) TO authenticated;

-- 2. PEMBARUAN: rpc_konfirmasi_pesanan (Penegasan BR-04 & Wewenang Manajer)
CREATE OR REPLACE FUNCTION public.rpc_konfirmasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran                 text;
  v_pesanan               record;
  v_persetujuan           record;
  v_pelanggan             record;
  v_item_count            integer;
  v_item                  record;
  v_stok_sesudah          integer;
  v_kredit                record;
  v_ada_bawah_hpp         boolean := false;
  v_current_hash          text;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- P9 Urutan Kunci 1: pesanan_jual FOR UPDATE
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_peran = 'penjualan' AND v_pesanan.dibuat_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'draf' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- P9 Urutan Kunci 2: persetujuan_harga FOR UPDATE (jika ada yang aktif)
  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE pesanan_jual_id = p_pesanan_id
    AND status IN ('menunggu', 'disetujui')
  ORDER BY diajukan_pada DESC
  LIMIT 1
  FOR UPDATE;

  -- Validasi jumlah baris 1 s.d. 20 (BR-02, E03)
  SELECT count(*) INTO v_item_count
  FROM public.item_pesanan_jual
  WHERE pesanan_jual_id = p_pesanan_id;

  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- P9 Urutan Kunci 3: pelanggan FOR UPDATE
  SELECT * INTO v_pelanggan
  FROM public.pelanggan
  WHERE id = v_pesanan.pelanggan_id
  FOR UPDATE;

  IF v_pelanggan.id IS NULL OR v_pelanggan.aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- P9 Urutan Kunci 4: barang FOR UPDATE ORDER BY id (BR-06)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id
  FOR UPDATE;

  -- Validasi keaktifan setiap barang, diskon, dan deteksi baris di bawah HPP
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok, b.aktif
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- Validasi diskon Staf Penjualan (mencegah draf yang diedit Manajer dikonfirmasi staf)
    IF v_peran = 'penjualan' AND v_item.diskon_persen > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;

    -- Validasi diskon maksimal semua peran (25%)
    IF v_item.diskon_persen > 25 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
    END IF;

    -- Deteksi baris di bawah HPP (COALESCE NULL = 0 per A5)
    IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
      v_ada_bawah_hpp := true;
    END IF;
  END LOOP;

  -- PENEGASAN MUTLAK BR-04 UNTUK STAF PENJUALAN:
  -- Staf Penjualan SELALU DITOLAK bila ada baris di bawah HPP dengan pesan persis
  -- "Harga di bawah batas, minta persetujuan Manajer" (E0011).
  -- Tiket persetujuan hanya permintaan ke Manajer; setelah disetujui, yang mengonfirmasi tetap Manajer.
  -- Staf tidak boleh mengonfirmasi pesanan yang tiketnya disetujui.
  IF v_peran = 'penjualan' AND v_ada_bawah_hpp THEN
    RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
  END IF;

  -- Hitung kredit dan overdue pelanggan
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  -- Prioritas Overdue diperiksa terlebih dahulu (E0013)
  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

  -- Plafon Kredit diperiksa berikutnya (E0012)
  IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
    RAISE EXCEPTION 'Batas kredit pelanggan terlampaui'
      USING ERRCODE = 'E0012';
  END IF;

  -- Validasi kecukupan stok seluruh item (BR-02, E14)
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.stok < v_item.jumlah THEN
      RAISE EXCEPTION 'Stok barang tidak mencukupi untuk memenuhi pesanan'
        USING ERRCODE = 'E0014';
    END IF;
  END LOOP;

  -- Eksekusi pengurangan stok, mutasi stok, dan HPP snapshot
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    UPDATE public.barang
    SET stok = stok - v_item.jumlah,
        diperbarui_pada = now()
    WHERE id = v_item.barang_id
    RETURNING stok INTO v_stok_sesudah;

    INSERT INTO public.mutasi_stok (
      barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_item.barang_id,
      'pesanan',
      -v_item.jumlah,
      v_stok_sesudah,
      v_pesanan.nomor,
      auth.uid(),
      now()
    );

    UPDATE public.item_pesanan_jual
    SET hpp_satuan = v_item.harga_pokok
    WHERE id = v_item.id;
  END LOOP;

  -- Jika dikonfirmasi oleh Manajer dan memiliki tiket persetujuan aktif, tandai terpakai
  IF v_persetujuan.id IS NOT NULL THEN
    UPDATE public.persetujuan_harga
    SET status = 'terpakai',
        dipakai_pada = now()
    WHERE id = v_persetujuan.id;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      auth.uid(),
      'pakai_persetujuan_harga',
      'persetujuan_harga',
      v_persetujuan.id,
      jsonb_build_object('status', v_persetujuan.status),
      jsonb_build_object('status', 'terpakai', 'pesanan_jual_id', p_pesanan_id)
    );
  END IF;

  -- Update status pesanan ke dikonfirmasi
  UPDATE public.pesanan_jual
  SET status = 'dikonfirmasi',
      dikonfirmasi_pada = now()
  WHERE id = p_pesanan_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'konfirmasi',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'draf'),
    jsonb_build_object('status', 'dikonfirmasi', 'total', v_pesanan.total)
  );

  RETURN jsonb_build_object(
    'id',    p_pesanan_id,
    'nomor', v_pesanan.nomor,
    'status', 'dikonfirmasi',
    'total', v_pesanan.total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_konfirmasi_pesanan(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_konfirmasi_pesanan(uuid) TO authenticated;


-- ------------------------------------------------------------
-- File: 20261026230000_audit_perbaikan_prd.sql
-- ------------------------------------------------------------
-- ============================================================
-- Migrasi: Perbaikan Celah Audit PRD
-- File: supabase/migrations/20261026230000_audit_perbaikan_prd.sql
-- Sesuai: PRD Butir 2 (Visibilitas Gudang) & Butir 8 (Penolakan Akun Nonaktif di RLS)
-- ============================================================

-- 1. Perbaiki fn_peran(): akun nonaktif (aktif = false) atau id tidak valid
-- mengembalikan NULL, BUKAN fallback ke 'penjualan'.
CREATE OR REPLACE FUNCTION public.fn_peran()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
BEGIN
  SELECT peran INTO v_peran
  FROM public.profiles
  WHERE id = auth.uid() AND aktif = true;
  
  -- Mengembalikan NULL jika pengguna tidak ditemukan atau aktif = false
  RETURN v_peran;
END;
$$;

-- 2. Perbarui policy pesanan_jual_select untuk peran Gudang:
-- Sesuai Butir 2: Gudang hanya melihat pesanan dengan dikonfirmasi_pada IS NOT NULL
DROP POLICY IF EXISTS "pesanan_jual_select" ON public.pesanan_jual;
CREATE POLICY "pesanan_jual_select"
  ON public.pesanan_jual FOR SELECT
  TO authenticated
  USING (
    public.fn_peran() = 'manajer'
    OR (public.fn_peran() = 'penjualan' AND dibuat_oleh = auth.uid())
    OR (public.fn_peran() = 'gudang' AND dikonfirmasi_pada IS NOT NULL)
  );


-- ------------------------------------------------------------
-- File: 20261026231000_audit_dan_penyelarasan_laporan_bab9.sql
-- ------------------------------------------------------------
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


-- ------------------------------------------------------------
-- File: 20261026233000_penyesuaian_stok_e0023.sql
-- ------------------------------------------------------------
-- ============================================================
-- Migrasi: Penegakan Pengecekan Alasan Penyesuaian Stok (E0023)
-- dan Memastikan Constraint CHECK (stok >= 0) Aktif pada Tabel Barang
-- ============================================================

-- 1. Pastikan Constraint CHECK (stok >= 0) Aktif pada Tabel Barang
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.barang'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%stok >= 0%'
  ) THEN
    ALTER TABLE public.barang ADD CONSTRAINT chk_barang_stok_non_negatif CHECK (stok >= 0);
  END IF;
END $$;

-- 2. Update RPC rpc_penyesuaian_stok
CREATE OR REPLACE FUNCTION public.rpc_penyesuaian_stok(
  p_barang_id uuid,
  p_stok_baru integer,
  p_alasan    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran        text;
  v_barang       record;
  v_delta        integer;
  v_nomor_adj    text;
  v_alasan_clean text;
BEGIN
  -- Validasi peran (Gudang atau Manajer)
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi stok baru tidak boleh negatif
  IF p_stok_baru < 0 THEN
    RAISE EXCEPTION 'Stok hasil penyesuaian tidak boleh negatif' USING ERRCODE = 'E0021';
  END IF;

  -- Validasi alasan penyesuaian stok minimal 10 karakter (E0023)
  IF p_alasan IS NULL OR length(trim(p_alasan)) < 10 THEN
    RAISE EXCEPTION 'Alasan penyesuaian stok minimal 10 karakter' USING ERRCODE = 'E0023';
  END IF;

  v_alasan_clean := trim(p_alasan);

  -- Kunci baris barang untuk mencegah race condition
  SELECT * INTO v_barang FROM public.barang WHERE id = p_barang_id FOR UPDATE;
  IF v_barang.id IS NULL THEN
    RAISE EXCEPTION 'Barang tidak ditemukan' USING ERRCODE = 'E0006';
  END IF;

  v_delta := p_stok_baru - v_barang.stok;

  -- Nomor dokumen penyesuaian ADJ-YYYY-NNNNNN
  v_nomor_adj := format(
    'ADJ-%s-%s',
    to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
    lpad(nextval('public.seq_penyesuaian')::text, 6, '0')
  );

  -- Buka kunci trigger perlindungan mutasi stok
  PERFORM set_config('app.mutasi_stok', '1', true);

  -- Mutasi stok barang
  UPDATE public.barang
  SET stok = p_stok_baru,
      diperbarui_pada = now()
  WHERE id = p_barang_id;

  -- Catat riwayat mutasi stok
  INSERT INTO public.mutasi_stok (
    barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
  )
  VALUES (
    p_barang_id, 'penyesuaian', v_delta, p_stok_baru, v_nomor_adj,
    v_alasan_clean, auth.uid(), now()
  );

  -- Catat jejak audit
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'sesuaikan_stok',
    'barang',
    p_barang_id,
    jsonb_build_object('stok', v_barang.stok),
    jsonb_build_object('stok', p_stok_baru, 'delta', v_delta, 'alasan', v_alasan_clean)
  );

  RETURN jsonb_build_object(
    'barang_id', p_barang_id,
    'stok_lama', v_barang.stok,
    'stok_baru', p_stok_baru,
    'delta', v_delta,
    'nomor_dokumen', v_nomor_adj
  );
END;
$$;

-- 3. Alias rpc_sesuaikan_stok
CREATE OR REPLACE FUNCTION public.rpc_sesuaikan_stok(
  p_barang_id uuid,
  p_stok_baru integer,
  p_alasan    text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.rpc_penyesuaian_stok(p_barang_id, p_stok_baru, p_alasan);
$$;

-- 4. Izin Eksekusi
REVOKE ALL ON FUNCTION public.rpc_penyesuaian_stok(uuid, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_penyesuaian_stok(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_sesuaikan_stok(uuid, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_sesuaikan_stok(uuid, integer, text) TO authenticated;

-- ------------------------------------------------------------
-- File: 20261028091000_izinkan_draf_diskon_pengajuan.sql
-- ------------------------------------------------------------
-- 1. PEMBARUAN: rpc_simpan_draf_pesanan (Izinkan diskon s.d. 25% saat simpan draf)
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items jsonb,
  p_pesanan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran         text;
  v_pesanan_id    uuid;
  v_nomor         text;
  v_item_count    integer;
  v_item          jsonb;
  v_barang_id     uuid;
  v_barang_ids    uuid[] := '{}';
  v_jumlah        integer;
  v_diskon        numeric;
  v_harga_satuan  numeric;
  v_barang_aktif  boolean;
  v_subtotal      numeric;
  v_total         numeric := 0;
  v_pelanggan_ada boolean;
  v_pelanggan_aktif boolean;
  v_pesanan_status text;
  v_pesanan_pembuat uuid;
BEGIN
  -- Periksa peran pemanggil: hanya staf penjualan dan manajer
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi pelanggan ada & aktif (BR-01, E07)
  SELECT true, aktif INTO v_pelanggan_ada, v_pelanggan_aktif
  FROM public.pelanggan WHERE id = p_pelanggan_id;

  IF v_pelanggan_ada IS NULL OR v_pelanggan_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- Validasi jumlah item 1 s.d. 20 (BR-02, E03)
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- Update draf eksisting vs Insert draf baru
  IF p_pesanan_id IS NOT NULL THEN
    SELECT status, dibuat_oleh, nomor INTO v_pesanan_status, v_pesanan_pembuat, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id
    FOR UPDATE;

    IF v_pesanan_status IS NULL THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    -- Validasi wewenang edit
    IF v_peran = 'penjualan' AND v_pesanan_pembuat <> auth.uid() THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    IF v_pesanan_status <> 'draf' THEN
      RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
    END IF;

    v_pesanan_id := p_pesanan_id;

    UPDATE public.pesanan_jual
    SET pelanggan_id = p_pelanggan_id
    WHERE id = v_pesanan_id;

    -- Jika draf diubah, batalkan pengajuan persetujuan harga yang sedang aktif
    UPDATE public.persetujuan_harga
    SET status = 'kedaluwarsa'
    WHERE pesanan_jual_id = v_pesanan_id
      AND status IN ('menunggu', 'disetujui');
  ELSE
    -- Generate nomor baru SO-YYYY-NNNNNN
    v_nomor := format(
      'SO-%s-%s',
      to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
      lpad(nextval('public.seq_pesanan_jual')::text, 6, '0')
    );

    INSERT INTO public.pesanan_jual (
      nomor, pelanggan_id, status, total, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_nomor, p_pelanggan_id, 'draf', 0, auth.uid(), now()
    )
    RETURNING id INTO v_pesanan_id;
  END IF;

  -- Hapus item lama terlebih dahulu untuk penggantian bersih
  DELETE FROM public.item_pesanan_jual WHERE pesanan_jual_id = v_pesanan_id;

  -- Iterasi & validasi item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_barang_id := (v_item->>'barang_id')::uuid;
    v_jumlah    := COALESCE((v_item->>'jumlah')::integer, 0);
    v_diskon    := COALESCE((v_item->>'diskon_persen')::numeric, 0);

    -- BR-02: jumlah >= 1
    IF v_jumlah < 1 THEN
      RAISE EXCEPTION 'Jumlah minimal 1' USING ERRCODE = 'E0004';
    END IF;

    -- BR-02: barang unik per pesanan
    IF v_barang_id = ANY(v_barang_ids) THEN
      RAISE EXCEPTION 'Barang sudah ada di pesanan ini' USING ERRCODE = 'E0005';
    END IF;
    v_barang_ids := array_append(v_barang_ids, v_barang_id);

    -- Cek keberadaan & keaktifan barang
    SELECT harga_jual, aktif INTO v_harga_satuan, v_barang_aktif
    FROM public.barang WHERE id = v_barang_id;

    IF v_harga_satuan IS NULL OR v_barang_aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    -- Batas diskon mutlak draf 0% sampai 25% untuk semua peran
    IF v_diskon < 0 OR v_diskon > 25 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
    END IF;

    -- BR-03: Subtotal = ROUND(jumlah * harga_satuan * (100 - diskon) / 100)
    v_subtotal := round(v_jumlah * v_harga_satuan * (100.0 - v_diskon) / 100.0);
    v_total    := v_total + v_subtotal;

    INSERT INTO public.item_pesanan_jual (
      pesanan_jual_id, barang_id, jumlah, harga_satuan, diskon_persen, subtotal
    )
    VALUES (
      v_pesanan_id, v_barang_id, v_jumlah, v_harga_satuan, v_diskon, v_subtotal
    );
  END LOOP;

  -- Perbarui total pesanan
  UPDATE public.pesanan_jual SET total = v_total WHERE id = v_pesanan_id;

  RETURN jsonb_build_object(
    'id',    v_pesanan_id,
    'nomor', v_nomor,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_simpan_draf_pesanan(uuid, jsonb, uuid) TO authenticated;

-- 2. PEMBARUAN: rpc_ajukan_persetujuan_harga (Izinkan jika subtotal < HPP * qty ATAU diskon > 10%)
CREATE OR REPLACE FUNCTION public.rpc_ajukan_persetujuan_harga(
  p_pesanan_id uuid,
  p_catatan text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pesanan record;
  v_perlu_persetujuan boolean;
  v_hash text;
  v_id uuid;
BEGIN
  IF NOT public.fn_is_penjualan() THEN
    RAISE EXCEPTION 'Hanya Staf Penjualan yang dapat mengajukan persetujuan harga' USING ERRCODE = 'E0039';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL OR v_pesanan.dibuat_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'draf' THEN
    RAISE EXCEPTION 'Pengajuan hanya dapat dilakukan pada pesanan berstatus draf' USING ERRCODE = 'E0040';
  END IF;

  -- Periksa dan tandai kedaluwarsa jika sebelumnya ada yang disetujui tapi lewat 24 jam
  UPDATE public.persetujuan_harga
  SET status = 'kedaluwarsa'
  WHERE pesanan_jual_id = p_pesanan_id
    AND status = 'disetujui'
    AND (now() AT TIME ZONE 'Asia/Jakarta') >= berlaku_sampai;

  IF EXISTS (
    SELECT 1 FROM public.persetujuan_harga
    WHERE pesanan_jual_id = p_pesanan_id
      AND status IN ('menunggu', 'disetujui')
  ) THEN
    RAISE EXCEPTION 'Pesanan sudah memiliki pengajuan persetujuan yang aktif' USING ERRCODE = 'E0041';
  END IF;

  -- Memerlukan persetujuan jika: ada subtotal < (HPP * jumlah) ATAU ada item dengan diskon > 10%
  SELECT EXISTS (
    SELECT 1
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
      AND (
        ip.subtotal < (COALESCE(b.harga_pokok, 0) * ip.jumlah)
        OR ip.diskon_persen > 10
      )
  ) INTO v_perlu_persetujuan;

  IF NOT v_perlu_persetujuan THEN
    RAISE EXCEPTION 'Tidak ada harga yang memerlukan persetujuan' USING ERRCODE = 'E0042';
  END IF;

  v_hash := public.fn_hitung_hash_pesanan(p_pesanan_id);

  INSERT INTO public.persetujuan_harga (
    pesanan_jual_id, status, diajukan_oleh, diajukan_pada, catatan_pengaju, snapshot_hash
  )
  VALUES (
    p_pesanan_id, 'menunggu', auth.uid(), now(), btrim(p_catatan), v_hash
  )
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_baru
  )
  VALUES (
    auth.uid(),
    'ajukan_persetujuan_harga',
    'persetujuan_harga',
    v_id,
    jsonb_build_object('pesanan_jual_id', p_pesanan_id, 'status', 'menunggu')
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'status', 'menunggu'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ajukan_persetujuan_harga(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_ajukan_persetujuan_harga(uuid, text) TO authenticated;



