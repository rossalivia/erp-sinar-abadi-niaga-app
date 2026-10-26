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
