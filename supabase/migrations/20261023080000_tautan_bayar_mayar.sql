-- ============================================================
-- Migrasi: Tautan Bayar Piutang lewat Mayar Sandbox (PRD 11.3)
-- Timestamp: 20261023080000
-- ============================================================

-- 1. Relaksasi audit_log.pelaku_id agar mendukung aksi sistem otomatis (M8)
ALTER TABLE public.audit_log ALTER COLUMN pelaku_id DROP NOT NULL;

-- 2. Tipe ENUM untuk Tagihan Mayar dan Webhook Event (M3)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_tagihan_mayar') THEN
    CREATE TYPE public.status_tagihan_mayar AS ENUM (
      'dibuat',
      'dibayar',
      'kedaluwarsa',
      'ditutup',
      'perlu_tinjau'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hasil_webhook_mayar') THEN
    CREATE TYPE public.hasil_webhook_mayar AS ENUM (
      'diproses',
      'diabaikan',
      'ditolak',
      'tidak_dikenal',
      'gagal_verifikasi'
    );
  END IF;
END $$;

-- 3. Tabel tagihan_mayar (M2, M3)
CREATE TABLE IF NOT EXISTS public.tagihan_mayar (
  id                    uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_jual_id       uuid                      NOT NULL REFERENCES public.pesanan_jual(id) ON DELETE RESTRICT,
  mayar_invoice_id      text                      NOT NULL,
  mayar_transaction_id  text                      NULL,
  tautan                text                      NOT NULL,
  jumlah                numeric(15, 0)            NOT NULL CHECK (jumlah > 0),
  status                public.status_tagihan_mayar NOT NULL DEFAULT 'dibuat',
  email_penerima        text                      NOT NULL,
  berlaku_sampai        timestamptz               NOT NULL,
  dibuat_oleh           uuid                      NOT NULL REFERENCES public.profiles(id),
  dibuat_pada           timestamptz               NOT NULL DEFAULT now(),
  dibayar_pada          timestamptz               NULL,
  catatan_tinjau        text                      NULL,
  diperbarui_pada       timestamptz               NOT NULL DEFAULT now(),
  CONSTRAINT ck_tagihan_mayar_email CHECK (email_penerima ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Partial Unique Index: Hanya boleh 1 tagihan AKTIF ('dibuat') per pesanan (M2)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tagihan_mayar_pesanan_aktif 
  ON public.tagihan_mayar (pesanan_jual_id) 
  WHERE (status = 'dibuat');

CREATE INDEX IF NOT EXISTS idx_tagihan_mayar_invoice_id ON public.tagihan_mayar (mayar_invoice_id);
CREATE INDEX IF NOT EXISTS idx_tagihan_mayar_transaction_id ON public.tagihan_mayar (mayar_transaction_id) WHERE mayar_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tagihan_mayar_status ON public.tagihan_mayar (status);
CREATE INDEX IF NOT EXISTS idx_tagihan_mayar_pesanan ON public.tagihan_mayar (pesanan_jual_id);

-- 4. Tabel mayar_webhook_event (Idempotensi Webhook, M3 / M7.4b)
CREATE TABLE IF NOT EXISTS public.mayar_webhook_event (
  id              uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  kunci_unik      text                      NOT NULL,
  jenis_event     text                      NOT NULL,
  referensi_id    text                      NULL,
  hasil           public.hasil_webhook_mayar NOT NULL,
  status_mayar    text                      NULL,
  jumlah_tercatat numeric(15, 0)            NULL,
  dibuat_pada     timestamptz               NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mayar_webhook_event_kunci ON public.mayar_webhook_event (kunci_unik);
CREATE INDEX IF NOT EXISTS idx_mayar_webhook_event_dibuat ON public.mayar_webhook_event (dibuat_pada DESC);

-- 5. Fungsi status efektif tagihan mayar on-the-fly (M10)
CREATE OR REPLACE FUNCTION public.fn_status_efektif_tagihan_mayar(
  p_status public.status_tagihan_mayar,
  p_berlaku_sampai timestamptz
)
RETURNS public.status_tagihan_mayar
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'dibuat' AND p_berlaku_sampai < now() THEN 'kedaluwarsa'::public.status_tagihan_mayar
    ELSE p_status
  END;
$$;

-- 6. RLS & Grants (M1)
ALTER TABLE public.tagihan_mayar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayar_webhook_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tagihan_mayar_select_manajer" ON public.tagihan_mayar;
CREATE POLICY "tagihan_mayar_select_manajer"
  ON public.tagihan_mayar FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer());

DROP POLICY IF EXISTS "tagihan_mayar_modify_block" ON public.tagihan_mayar;
CREATE POLICY "tagihan_mayar_modify_block"
  ON public.tagihan_mayar FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "mayar_webhook_event_select_manajer" ON public.mayar_webhook_event;
CREATE POLICY "mayar_webhook_event_select_manajer"
  ON public.mayar_webhook_event FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer());

DROP POLICY IF EXISTS "mayar_webhook_event_modify_block" ON public.mayar_webhook_event;
CREATE POLICY "mayar_webhook_event_modify_block"
  ON public.mayar_webhook_event FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.tagihan_mayar FROM PUBLIC, anon;
GRANT SELECT ON public.tagihan_mayar TO authenticated;

REVOKE ALL ON public.mayar_webhook_event FROM PUBLIC, anon;
GRANT SELECT ON public.mayar_webhook_event TO authenticated;

-- ============================================================
-- 7. RPC: rpc_siapkan_tagihan_mayar (Fase 1 Pembuatan, M5)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_siapkan_tagihan_mayar(
  p_pesanan_id uuid
)
RETURNS TABLE (
  pesanan_id uuid,
  nomor_pesanan text,
  kode_pelanggan text,
  nama_toko text,
  telepon_pelanggan text,
  total_tagihan numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pesanan record;
  v_tagihan_aktif record;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Kunci pesanan_jual untuk validasi status
  SELECT pj.id, pj.nomor, pj.status, pj.total, plg.kode, plg.nama_toko, plg.telepon
  INTO v_pesanan
  FROM public.pesanan_jual pj
  JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
  WHERE pj.id = p_pesanan_id
  FOR UPDATE OF pj;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Data tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'dikirim' THEN
    RAISE EXCEPTION 'Tagihan Mayar hanya dapat dibuat untuk pesanan berstatus dikirim' USING ERRCODE = 'E0066';
  END IF;

  IF v_pesanan.total <= 0 THEN
    RAISE EXCEPTION 'Total pesanan harus lebih besar dari 0 untuk membuat tagihan' USING ERRCODE = 'E0068';
  END IF;

  -- Periksa apakah sudah ada tagihan aktif yang belum kedaluwarsa
  SELECT id, mayar_invoice_id, berlaku_sampai INTO v_tagihan_aktif
  FROM public.tagihan_mayar
  WHERE pesanan_jual_id = p_pesanan_id
    AND status = 'dibuat'
    AND berlaku_sampai > now();

  IF v_tagihan_aktif.id IS NULL THEN
    -- Jika ada tagihan berstatus 'dibuat' tetapi sudah lewat waktu berlaku, otomatis tandai kedaluwarsa
    UPDATE public.tagihan_mayar
    SET status = 'kedaluwarsa', diperbarui_pada = now()
    WHERE pesanan_jual_id = p_pesanan_id
      AND status = 'dibuat'
      AND berlaku_sampai <= now();
  ELSE
    RAISE EXCEPTION 'Pesanan sudah memiliki tagihan Mayar aktif' USING ERRCODE = 'E0067';
  END IF;

  RETURN QUERY
  SELECT 
    v_pesanan.id,
    v_pesanan.nomor,
    v_pesanan.kode,
    v_pesanan.nama_toko,
    v_pesanan.telepon,
    v_pesanan.total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_siapkan_tagihan_mayar(uuid) TO authenticated;

-- ============================================================
-- 8. RPC: rpc_simpan_tagihan_mayar (Fase 2 Pembuatan, M5)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_simpan_tagihan_mayar(
  p_pesanan_id uuid,
  p_mayar_invoice_id text,
  p_mayar_transaction_id text,
  p_tautan text,
  p_jumlah numeric,
  p_email_penerima text,
  p_berlaku_sampai timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pesanan record;
  v_tagihan_id uuid;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Kunci baris pesanan_jual
  SELECT id, nomor, status, total INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Data tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'dikirim' THEN
    RAISE EXCEPTION 'Tagihan Mayar hanya dapat dibuat untuk pesanan berstatus dikirim' USING ERRCODE = 'E0066';
  END IF;

  IF v_pesanan.total <> p_jumlah THEN
    RAISE EXCEPTION 'Jumlah tagihan tidak sesuai dengan total pesanan' USING ERRCODE = 'E0072';
  END IF;

  -- Bersihkan tagihan aktif lama jika sudah kedaluwarsa
  UPDATE public.tagihan_mayar
  SET status = 'kedaluwarsa', diperbarui_pada = now()
  WHERE pesanan_jual_id = p_pesanan_id
    AND status = 'dibuat'
    AND berlaku_sampai <= now();

  INSERT INTO public.tagihan_mayar (
    pesanan_jual_id,
    mayar_invoice_id,
    mayar_transaction_id,
    tautan,
    jumlah,
    status,
    email_penerima,
    berlaku_sampai,
    dibuat_oleh,
    dibuat_pada,
    diperbarui_pada
  )
  VALUES (
    p_pesanan_id,
    p_mayar_invoice_id,
    p_mayar_transaction_id,
    p_tautan,
    p_jumlah,
    'dibuat',
    p_email_penerima,
    p_berlaku_sampai,
    auth.uid(),
    now(),
    now()
  )
  RETURNING id INTO v_tagihan_id;

  -- Catat audit_log
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'buat_tagihan_mayar',
    'tagihan_mayar',
    v_tagihan_id,
    NULL,
    jsonb_build_object(
      'pesanan_id', p_pesanan_id,
      'nomor_pesanan', v_pesanan.nomor,
      'mayar_invoice_id', p_mayar_invoice_id,
      'jumlah', p_jumlah,
      'berlaku_sampai', p_berlaku_sampai
    )
  );

  RETURN jsonb_build_object(
    'id', v_tagihan_id,
    'tautan', p_tautan,
    'status', 'dibuat'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_simpan_tagihan_mayar(uuid, text, text, text, numeric, text, timestamptz) TO authenticated;

-- ============================================================
-- 9. RPC: rpc_tutup_tagihan_mayar (Manajer, M5 / M11)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_tutup_tagihan_mayar(
  p_tagihan_id uuid,
  p_alasan text DEFAULT 'Dibatalkan oleh Manajer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tagihan record;
  v_pesanan record;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_tagihan
  FROM public.tagihan_mayar
  WHERE id = p_tagihan_id;

  IF v_tagihan.id IS NULL THEN
    RAISE EXCEPTION 'Data tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  -- Kunci pesanan lalu tagihan
  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = v_tagihan.pesanan_jual_id
  FOR UPDATE;

  SELECT * INTO v_tagihan
  FROM public.tagihan_mayar
  WHERE id = p_tagihan_id
  FOR UPDATE;

  IF v_tagihan.status <> 'dibuat' THEN
    RAISE EXCEPTION 'Tagihan Mayar tidak aktif' USING ERRCODE = 'E0071';
  END IF;

  UPDATE public.tagihan_mayar
  SET status = 'ditutup',
      catatan_tinjau = p_alasan,
      diperbarui_pada = now()
  WHERE id = p_tagihan_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'tutup_tagihan_mayar',
    'tagihan_mayar',
    p_tagihan_id,
    jsonb_build_object('status', 'dibuat'),
    jsonb_build_object('status', 'ditutup', 'alasan', p_alasan)
  );

  RETURN jsonb_build_object(
    'id', p_tagihan_id,
    'status', 'ditutup'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_tutup_tagihan_mayar(uuid, text) TO authenticated;

-- ============================================================
-- 10. RPC: rpc_sistem_lunaskan_dari_mayar (HANYA service_role, M8)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sistem_lunaskan_dari_mayar(
  p_tagihan_id uuid,
  p_referensi_transaksi text,
  p_jumlah_terverifikasi numeric
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
BEGIN
  -- Ambil ID pesanan dari tagihan
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

  -- URUTAN PENGUNCIAN BARIS ANTI-DEADLOCK (M8):
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

  -- Validasi Syarat Pelunasan Otomatis
  IF v_pesanan.status = 'lunas' THEN
    v_anomali := 'Pesanan sudah berstatus lunas (potensi pembayaran ganda)';
  ELSIF v_pesanan.status <> 'dikirim' THEN
    v_anomali := 'Status pesanan bukan dikirim (status saat ini: ' || v_pesanan.status || ')';
  ELSIF v_tagihan.status <> 'dibuat' AND v_tagihan.status <> 'kedaluwarsa' THEN
    v_anomali := 'Status tagihan bukan dibuat atau kedaluwarsa (status saat ini: ' || v_tagihan.status || ')';
  ELSIF v_tagihan.jumlah <> p_jumlah_terverifikasi OR v_pesanan.total <> p_jumlah_terverifikasi THEN
    v_anomali := 'Nominal terverifikasi (' || p_jumlah_terverifikasi || ') tidak sesuai dengan tagihan (' || v_tagihan.jumlah || ') atau total pesanan (' || v_pesanan.total || ')';
  END IF;

  -- PERCABANGAN HASIL
  IF v_anomali IS NOT NULL THEN
    -- Anomali terdeteksi: JANGAN ubah status pesanan; tandai tagihan perlu_tinjau
    UPDATE public.tagihan_mayar
    SET status = 'perlu_tinjau',
        catatan_tinjau = v_anomali,
        mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi),
        diperbarui_pada = now()
    WHERE id = p_tagihan_id;

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
        'jumlah_diterima', p_jumlah_terverifikasi
      )
    );

    RETURN jsonb_build_object(
      'success', false,
      'status', 'perlu_tinjau',
      'message', v_anomali
    );
  END IF;

  -- KASUS SUKSES: Lunaskan pesanan dan tandai tagihan dibayar
  UPDATE public.pesanan_jual
  SET status = 'lunas',
      dilunasi_pada = now()
  WHERE id = v_pesanan.id;

  UPDATE public.tagihan_mayar
  SET status = 'dibayar',
      dibayar_pada = now(),
      mayar_transaction_id = COALESCE(mayar_transaction_id, p_referensi_transaksi),
      diperbarui_pada = now()
  WHERE id = p_tagihan_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    NULL,
    'lunasi_pesanan_mayar',
    'pesanan_jual',
    v_pesanan.id,
    jsonb_build_object('status', 'dikirim'),
    jsonb_build_object(
      'status', 'lunas',
      'metode', 'mayar',
      'tagihan_id', p_tagihan_id,
      'referensi', p_referensi_transaksi,
      'jumlah', p_jumlah_terverifikasi
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'lunas',
    'message', 'Pesanan berhasil dilunasi via Mayar'
  );
END;
$$;

-- Cabut izin dari umum dan hanya berikan ke service_role (M8)
REVOKE ALL ON FUNCTION public.rpc_sistem_lunaskan_dari_mayar(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_lunaskan_dari_mayar(uuid, text, numeric) TO service_role;

-- ============================================================
-- 11. RPC Pembantu Sistem untuk Webhook Handler (HANYA service_role)
-- Agar admin client TIDAK PERNAH query tabel langsung (E5)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sistem_rekam_webhook_event(
  p_kunci_unik text,
  p_jenis_event text,
  p_referensi_id text,
  p_hasil public.hasil_webhook_mayar,
  p_status_mayar text,
  p_jumlah_tercatat numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.mayar_webhook_event (
    kunci_unik,
    jenis_event,
    referensi_id,
    hasil,
    status_mayar,
    jumlah_tercatat,
    dibuat_pada
  )
  VALUES (
    p_kunci_unik,
    p_jenis_event,
    p_referensi_id,
    p_hasil,
    p_status_mayar,
    p_jumlah_tercatat,
    now()
  )
  ON CONFLICT (kunci_unik) DO NOTHING;

  -- Mengembalikan true jika baris baru berhasil disisipkan (bukan duplikat)
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sistem_rekam_webhook_event(text, text, text, public.hasil_webhook_mayar, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_rekam_webhook_event(text, text, text, public.hasil_webhook_mayar, text, numeric) TO service_role;

-- RPC untuk mencocokkan kandidat ID webhook ke tagihan_mayar (HANYA service_role)
CREATE OR REPLACE FUNCTION public.rpc_sistem_cari_tagihan_mayar(
  p_candidate_ids text[]
)
RETURNS TABLE (
  id uuid,
  pesanan_jual_id uuid,
  mayar_invoice_id text,
  mayar_transaction_id text,
  tautan text,
  jumlah numeric,
  status public.status_tagihan_mayar,
  berlaku_sampai timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tm.id,
    tm.pesanan_jual_id,
    tm.mayar_invoice_id,
    tm.mayar_transaction_id,
    tm.tautan,
    tm.jumlah,
    tm.status,
    tm.berlaku_sampai
  FROM public.tagihan_mayar tm
  WHERE (tm.mayar_invoice_id = ANY(p_candidate_ids) OR tm.mayar_transaction_id = ANY(p_candidate_ids))
  ORDER BY tm.dibuat_pada DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_sistem_cari_tagihan_mayar(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_cari_tagihan_mayar(text[]) TO service_role;

-- ============================================================
-- 12. RPC Monitoring Manajer: rpc_riwayat_tagihan_mayar_manajer (M10, M11)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_riwayat_tagihan_mayar_manajer(
  p_pesanan_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  pesanan_jual_id uuid,
  nomor_pesanan text,
  kode_pelanggan text,
  nama_toko text,
  mayar_invoice_id text,
  mayar_transaction_id text,
  tautan text,
  jumlah numeric,
  status text,
  status_efektif text,
  email_penerima text,
  berlaku_sampai timestamptz,
  dibuat_pada timestamptz,
  dibayar_pada timestamptz,
  catatan_tinjau text,
  pembuat_nama text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  RETURN QUERY
  SELECT 
    tm.id,
    tm.pesanan_jual_id,
    pj.nomor AS nomor_pesanan,
    plg.kode AS kode_pelanggan,
    plg.nama_toko,
    tm.mayar_invoice_id,
    tm.mayar_transaction_id,
    tm.tautan,
    tm.jumlah,
    tm.status::text,
    public.fn_status_efektif_tagihan_mayar(tm.status, tm.berlaku_sampai)::text AS status_efektif,
    tm.email_penerima,
    tm.berlaku_sampai,
    tm.dibuat_pada,
    tm.dibayar_pada,
    tm.catatan_tinjau,
    prof.nama_lengkap AS pembuat_nama
  FROM public.tagihan_mayar tm
  JOIN public.pesanan_jual pj ON pj.id = tm.pesanan_jual_id
  JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
  JOIN public.profiles prof ON prof.id = tm.dibuat_oleh
  WHERE (p_pesanan_id IS NULL OR tm.pesanan_jual_id = p_pesanan_id)
  ORDER BY tm.dibuat_pada DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_riwayat_tagihan_mayar_manajer(uuid) TO authenticated;

-- ============================================================
-- 13. Pembaruan rpc_catat_pelunasan untuk Auto-Close Tagihan Mayar (M9)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_catat_pelunasan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pesanan record;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_pesanan
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_pesanan.id IS NULL THEN
    RAISE EXCEPTION 'Data tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_pesanan.status <> 'dikirim' THEN
    RAISE EXCEPTION 'Perpindahan status atau tindakan tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- 1. Tandai pesanan lunas
  UPDATE public.pesanan_jual
  SET status = 'lunas',
      dilunasi_pada = now()
  WHERE id = p_pesanan_id;

  -- 2. Tutup otomatis tagihan Mayar aktif jika ada (M9)
  UPDATE public.tagihan_mayar
  SET status = 'ditutup',
      catatan_tinjau = 'Ditutup otomatis karena pesanan telah dilunasi manual oleh Manajer',
      diperbarui_pada = now()
  WHERE pesanan_jual_id = p_pesanan_id
    AND status = 'dibuat';

  -- 3. Catat audit log
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'lunasi_pesanan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'dikirim'),
    jsonb_build_object('status', 'lunas', 'metode', 'manual')
  );

  RETURN jsonb_build_object('id', p_pesanan_id, 'status', 'lunas');
END;
$$;
