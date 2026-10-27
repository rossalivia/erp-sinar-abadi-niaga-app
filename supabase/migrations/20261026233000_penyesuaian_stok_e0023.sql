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
