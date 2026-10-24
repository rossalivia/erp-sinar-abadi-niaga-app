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
