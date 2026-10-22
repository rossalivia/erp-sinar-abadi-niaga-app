-- ============================================================
-- Migrasi: Manajemen Stock Opname & Penyesuaian Fisik Gudang
-- File: 20261022000000_stock_opname.sql
-- Sesuai: docs/fitur-stock-opname.md, AGENTS.md, BR-01, BR-11, BR-12
-- ============================================================

-- 0. FUNGSI HELPER: fn_is_gudang (Pelengkap fn_is_manajer)
CREATE OR REPLACE FUNCTION public.fn_is_gudang()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (public.fn_peran() = 'gudang');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_is_gudang() TO authenticated;

-- 1. SEQUENCE NOMOR DOKUMEN (OPN-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS public.seq_opname_stok START 1 INCREMENT 1 NO CYCLE;

-- 2. TABEL HEADER: opname_stok
CREATE TABLE IF NOT EXISTS public.opname_stok (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor               text          NOT NULL UNIQUE,
  status              text          NOT NULL DEFAULT 'draf'
                                    CHECK (status IN ('draf', 'diajukan', 'disetujui', 'dibatalkan')),
  catatan             text,
  total_item          integer       NOT NULL DEFAULT 0 CHECK (total_item >= 0),
  total_selisih_unit  integer       NOT NULL DEFAULT 0,
  dibuat_oleh         uuid          NOT NULL REFERENCES public.profiles(id),
  dibuat_pada         timestamptz   NOT NULL DEFAULT now(),
  diajukan_pada       timestamptz,
  disetujui_oleh      uuid          REFERENCES public.profiles(id),
  disetujui_pada      timestamptz,
  dibatalkan_oleh     uuid          REFERENCES public.profiles(id),
  dibatalkan_pada     timestamptz,
  alasan_batal        text
);

COMMENT ON TABLE public.opname_stok IS 'Header dokumen sesi stock opname fisik gudang.';

-- 3. TABEL DETAIL: item_opname_stok
CREATE TABLE IF NOT EXISTS public.item_opname_stok (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_stok_id  uuid          NOT NULL REFERENCES public.opname_stok(id) ON DELETE CASCADE,
  barang_id       uuid          NOT NULL REFERENCES public.barang(id),
  stok_sistem     integer       NOT NULL CHECK (stok_sistem >= 0),
  stok_fisik      integer       NOT NULL CHECK (stok_fisik >= 0),
  selisih         integer       GENERATED ALWAYS AS (stok_fisik - stok_sistem) STORED,
  keterangan      text,
  dibuat_pada     timestamptz   NOT NULL DEFAULT now()
);

-- Indeks unik & performa
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_opname_barang ON public.item_opname_stok (opname_stok_id, barang_id);
CREATE INDEX IF NOT EXISTS idx_item_opname_opname_id ON public.item_opname_stok (opname_stok_id);
CREATE INDEX IF NOT EXISTS idx_opname_stok_status ON public.opname_stok (status);

-- 4. VIEW MANAJER (security_invoker): Isolasi Kerahasiaan Nilai Finansial HPP
CREATE OR REPLACE VIEW public.v_opname_stok_manajer
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.nomor,
  o.status,
  o.catatan,
  o.total_item,
  o.total_selisih_unit,
  COALESCE(SUM(i.selisih * b.harga_pokok), 0)::numeric(14,0) AS estimasi_nilai_selisih,
  o.dibuat_oleh,
  p_buat.nama_lengkap AS pembuat_nama,
  o.dibuat_pada,
  o.diajukan_pada,
  o.disetujui_oleh,
  p_tuju.nama_lengkap AS penyetuju_nama,
  o.disetujui_pada,
  o.dibatalkan_oleh,
  p_batal.nama_lengkap AS pembatal_nama,
  o.dibatalkan_pada,
  o.alasan_batal
FROM public.opname_stok o
LEFT JOIN public.item_opname_stok i ON i.opname_stok_id = o.id
LEFT JOIN public.barang b ON b.id = i.barang_id
LEFT JOIN public.profiles p_buat ON p_buat.id = o.dibuat_oleh
LEFT JOIN public.profiles p_tuju ON p_tuju.id = o.disetujui_oleh
LEFT JOIN public.profiles p_batal ON p_batal.id = o.dibatalkan_oleh
WHERE public.fn_peran() = 'manajer'
GROUP BY
  o.id,
  o.nomor,
  o.status,
  o.catatan,
  o.total_item,
  o.total_selisih_unit,
  o.dibuat_oleh,
  p_buat.nama_lengkap,
  o.dibuat_pada,
  o.diajukan_pada,
  o.disetujui_oleh,
  p_tuju.nama_lengkap,
  o.disetujui_pada,
  o.dibatalkan_oleh,
  p_batal.nama_lengkap,
  o.dibatalkan_pada,
  o.alasan_batal;

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.opname_stok ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_opname_stok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opname_stok_select_policy" ON public.opname_stok;
CREATE POLICY "opname_stok_select_policy" ON public.opname_stok
  FOR SELECT TO authenticated
  USING (public.fn_peran() IN ('gudang', 'manajer'));

DROP POLICY IF EXISTS "item_opname_stok_select_policy" ON public.item_opname_stok;
CREATE POLICY "item_opname_stok_select_policy" ON public.item_opname_stok
  FOR SELECT TO authenticated
  USING (public.fn_peran() IN ('gudang', 'manajer'));

DROP POLICY IF EXISTS "opname_stok_modify_policy" ON public.opname_stok;
CREATE POLICY "opname_stok_modify_policy" ON public.opname_stok
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "item_opname_stok_modify_policy" ON public.item_opname_stok;
CREATE POLICY "item_opname_stok_modify_policy" ON public.item_opname_stok
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- Grants
GRANT SELECT ON public.opname_stok TO authenticated;
GRANT SELECT ON public.item_opname_stok TO authenticated;
GRANT SELECT ON public.v_opname_stok_manajer TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seq_opname_stok TO authenticated;

-- ============================================================
-- 6. RPC 1: rpc_buat_opname_stok
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_buat_opname_stok(
  p_catatan text,
  p_items jsonb,
  p_langsung_ajukan boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_opname_id uuid;
  v_nomor text;
  v_item record;
  v_barang_id uuid;
  v_stok_fisik integer;
  v_stok_sistem integer;
  v_keterangan text;
  v_total_item integer := 0;
  v_total_selisih integer := 0;
  v_barang_ids uuid[] := '{}';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR public.fn_peran() NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'E0031: Sesi opname harus berisi minimal 1 item barang';
  END IF;

  -- Generate nomor dokumen OPN-YYYY-XXXX
  v_nomor := 'OPN-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYY') || '-' || lpad(nextval('public.seq_opname_stok')::text, 4, '0');
  v_opname_id := gen_random_uuid();

  -- Buat Header
  INSERT INTO public.opname_stok (
    id, nomor, status, catatan, dibuat_oleh, dibuat_pada, diajukan_pada
  ) VALUES (
    v_opname_id,
    v_nomor,
    CASE WHEN p_langsung_ajukan THEN 'diajukan' ELSE 'draf' END,
    p_catatan,
    v_user_id,
    now(),
    CASE WHEN p_langsung_ajukan THEN now() ELSE NULL END
  );

  -- Validasi & Masukkan Detail Item
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(barang_id uuid, stok_fisik integer, keterangan text)
  LOOP
    v_barang_id := v_item.barang_id;
    v_stok_fisik := v_item.stok_fisik;
    v_keterangan := v_item.keterangan;

    IF v_barang_id IS NULL THEN
      RAISE EXCEPTION 'E0002: Data tidak ditemukan';
    END IF;

    IF v_stok_fisik IS NULL OR v_stok_fisik < 0 THEN
      RAISE EXCEPTION 'E0033: Stok fisik riil tidak boleh bernilai negatif';
    END IF;

    IF v_barang_id = ANY(v_barang_ids) THEN
      RAISE EXCEPTION 'E0035: Barang sudah ada di sesi opname ini';
    END IF;
    v_barang_ids := array_append(v_barang_ids, v_barang_id);

    -- Ambil stok sistem saat ini
    SELECT stok INTO v_stok_sistem FROM public.barang WHERE id = v_barang_id AND aktif = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E0006: Barang tidak aktif atau tidak ditemukan';
    END IF;

    INSERT INTO public.item_opname_stok (
      opname_stok_id, barang_id, stok_sistem, stok_fisik, keterangan
    ) VALUES (
      v_opname_id, v_barang_id, v_stok_sistem, v_stok_fisik, v_keterangan
    );

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + (v_stok_fisik - v_stok_sistem);
  END LOOP;

  -- Update agregat di header
  UPDATE public.opname_stok
  SET total_item = v_total_item,
      total_selisih_unit = v_total_selisih
  WHERE id = v_opname_id;

  RETURN v_opname_id;
END;
$$;

-- ============================================================
-- 7. RPC 2: rpc_ubah_draf_opname
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_ubah_draf_opname(
  p_id uuid,
  p_catatan text,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_opname record;
  v_item record;
  v_barang_id uuid;
  v_stok_fisik integer;
  v_stok_sistem integer;
  v_keterangan text;
  v_total_item integer := 0;
  v_total_selisih integer := 0;
  v_barang_ids uuid[] := '{}';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR public.fn_peran() NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  SELECT * INTO v_opname FROM public.opname_stok WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E0002: Data tidak ditemukan';
  END IF;

  IF v_opname.status <> 'draf' THEN
    RAISE EXCEPTION 'E0032: Sesi opname hanya dapat diubah saat berstatus draf';
  END IF;

  IF public.fn_peran() = 'gudang' AND v_opname.dibuat_oleh <> v_user_id THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'E0031: Sesi opname harus berisi minimal 1 item barang';
  END IF;

  -- Hapus item lama
  DELETE FROM public.item_opname_stok WHERE opname_stok_id = p_id;

  -- Masukkan item baru
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(barang_id uuid, stok_fisik integer, keterangan text)
  LOOP
    v_barang_id := v_item.barang_id;
    v_stok_fisik := v_item.stok_fisik;
    v_keterangan := v_item.keterangan;

    IF v_barang_id IS NULL THEN
      RAISE EXCEPTION 'E0002: Data tidak ditemukan';
    END IF;

    IF v_stok_fisik IS NULL OR v_stok_fisik < 0 THEN
      RAISE EXCEPTION 'E0033: Stok fisik riil tidak boleh bernilai negatif';
    END IF;

    IF v_barang_id = ANY(v_barang_ids) THEN
      RAISE EXCEPTION 'E0035: Barang sudah ada di sesi opname ini';
    END IF;
    v_barang_ids := array_append(v_barang_ids, v_barang_id);

    SELECT stok INTO v_stok_sistem FROM public.barang WHERE id = v_barang_id AND aktif = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E0006: Barang tidak aktif atau tidak ditemukan';
    END IF;

    INSERT INTO public.item_opname_stok (
      opname_stok_id, barang_id, stok_sistem, stok_fisik, keterangan
    ) VALUES (
      p_id, v_barang_id, v_stok_sistem, v_stok_fisik, v_keterangan
    );

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + (v_stok_fisik - v_stok_sistem);
  END LOOP;

  UPDATE public.opname_stok
  SET catatan = p_catatan,
      total_item = v_total_item,
      total_selisih_unit = v_total_selisih
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- 8. RPC 3: rpc_ajukan_opname_stok
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_ajukan_opname_stok(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_opname record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR public.fn_peran() NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  SELECT * INTO v_opname FROM public.opname_stok WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E0002: Data tidak ditemukan';
  END IF;

  IF v_opname.status <> 'draf' THEN
    RAISE EXCEPTION 'E0032: Sesi opname hanya dapat diubah saat berstatus draf';
  END IF;

  IF public.fn_peran() = 'gudang' AND v_opname.dibuat_oleh <> v_user_id THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF v_opname.total_item < 1 THEN
    RAISE EXCEPTION 'E0031: Sesi opname harus berisi minimal 1 item barang';
  END IF;

  UPDATE public.opname_stok
  SET status = 'diajukan',
      diajukan_pada = now()
  WHERE id = p_id;
END;
$$;

-- ============================================================
-- 9. RPC 4: rpc_setujui_opname_stok (Persetujuan Manajer & Koreksi Stok)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_setujui_opname_stok(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_opname record;
  r_item record;
  v_stok_saat_ini integer;
  v_delta integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR public.fn_peran() <> 'manajer' THEN
    RAISE EXCEPTION 'E0036: Hanya Manajer yang berwenang menyetujui stock opname';
  END IF;

  SELECT * INTO v_opname FROM public.opname_stok WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E0002: Data tidak ditemukan';
  END IF;

  IF v_opname.status <> 'diajukan' THEN
    RAISE EXCEPTION 'E0034: Sesi opname hanya dapat disetujui atau ditolak pada status diajukan';
  END IF;

  -- Izinkan mutasi stok di level transaksi database (bypass guard)
  PERFORM set_config('app.mutasi_stok', '1', true);

  -- Eksekusi koreksi stok untuk setiap item secara atomik
  FOR r_item IN 
    SELECT * FROM public.item_opname_stok 
    WHERE opname_stok_id = p_id 
    ORDER BY barang_id ASC
  LOOP
    -- Kunci baris barang untuk mencegah race condition
    SELECT stok INTO v_stok_saat_ini FROM public.barang WHERE id = r_item.barang_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'E0006: Barang tidak aktif atau tidak ditemukan';
    END IF;

    -- Hitung delta selisih terhadap stok fisik riil
    v_delta := r_item.stok_fisik - v_stok_saat_ini;

    -- Hanya buat mutasi stok jika ada selisih
    IF v_delta <> 0 THEN
      -- Perbarui stok fisik barang
      UPDATE public.barang
      SET stok = r_item.stok_fisik,
          diperbarui_pada = now()
      WHERE id = r_item.barang_id;

      -- Catat kartu stok (mutasi_stok)
      INSERT INTO public.mutasi_stok (
        barang_id,
        jenis,
        jumlah,
        stok_sesudah,
        nomor_dokumen,
        alasan,
        dibuat_oleh,
        dibuat_pada
      ) VALUES (
        r_item.barang_id,
        'penyesuaian',
        v_delta,
        r_item.stok_fisik,
        v_opname.nomor,
        COALESCE(r_item.keterangan, 'Stock Opname: penyesuaian fisik rak gudang (' || v_opname.nomor || ')'),
        v_user_id,
        now()
      );
    END IF;
  END LOOP;

  -- Update status opname
  UPDATE public.opname_stok
  SET status = 'disetujui',
      disetujui_oleh = v_user_id,
      disetujui_pada = now()
  WHERE id = p_id;

  -- Catat ke audit log
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada
  ) VALUES (
    v_user_id,
    'setujui_stock_opname',
    'opname_stok',
    p_id,
    jsonb_build_object('status', 'diajukan'),
    jsonb_build_object('status', 'disetujui', 'nomor', v_opname.nomor, 'total_item', v_opname.total_item),
    now()
  );
END;
$$;

-- ============================================================
-- 10. RPC 5: rpc_batalkan_opname_stok
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_batalkan_opname_stok(
  p_id uuid,
  p_alasan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_opname record;
  v_alasan_clean text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR public.fn_peran() NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  v_alasan_clean := btrim(COALESCE(p_alasan, ''));
  IF char_length(v_alasan_clean) < 10 THEN
    RAISE EXCEPTION 'E0016: Alasan minimal 10 karakter';
  END IF;

  SELECT * INTO v_opname FROM public.opname_stok WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'E0002: Data tidak ditemukan';
  END IF;

  IF v_opname.status IN ('disetujui', 'dibatalkan') THEN
    RAISE EXCEPTION 'E0015: Perpindahan status atau tindakan tidak diizinkan';
  END IF;

  -- Gudang hanya boleh membatalkan draf buatannya sendiri
  IF public.fn_peran() = 'gudang' THEN
    IF v_opname.status <> 'draf' OR v_opname.dibuat_oleh <> v_user_id THEN
      RAISE EXCEPTION 'E0001: Akses ditolak';
    END IF;
  END IF;

  UPDATE public.opname_stok
  SET status = 'dibatalkan',
      dibatalkan_oleh = v_user_id,
      dibatalkan_pada = now(),
      alasan_batal = v_alasan_clean
  WHERE id = p_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada
  ) VALUES (
    v_user_id,
    'batalkan_stock_opname',
    'opname_stok',
    p_id,
    jsonb_build_object('status', v_opname.status),
    jsonb_build_object('status', 'dibatalkan', 'alasan', v_alasan_clean),
    now()
  );
END;
$$;

-- Grant permissions untuk fungsi RPC
GRANT EXECUTE ON FUNCTION public.rpc_buat_opname_stok(text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ubah_draf_opname(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ajukan_opname_stok(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_setujui_opname_stok(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_batalkan_opname_stok(uuid, text) TO authenticated;
