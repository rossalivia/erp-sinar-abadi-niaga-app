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

-- 4. VIEW MANAJER: Isolasi Kerahasiaan Nilai Finansial HPP
CREATE OR REPLACE VIEW public.v_opname_stok_manajer
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
-- ============================================================
-- Migrasi: Perbaikan Audit Sistem & Penegakan Aturan K1 s.d. K4
-- File: 20261022110000_perbaikan_audit.sql
-- Sesuai: Keputusan Pemilik Proyek K1, K2, K3, K4
-- ============================================================

-- ============================================================
-- 1. K1: PERBAIKAN v_opname_stok_manajer (Owner Rights, security_barrier)
-- ============================================================
DROP VIEW IF EXISTS public.v_opname_stok_manajer CASCADE;

CREATE VIEW public.v_opname_stok_manajer
WITH (security_barrier = true)
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
WHERE public.fn_is_manajer() = true
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

REVOKE ALL ON public.v_opname_stok_manajer FROM anon, PUBLIC;
GRANT SELECT ON public.v_opname_stok_manajer TO authenticated;

-- Tambahkan security_barrier pada seluruh view manajer lainnya
ALTER VIEW public.v_barang_manajer SET (security_barrier = true);
ALTER VIEW public.v_pembelian_manajer SET (security_barrier = true);
ALTER VIEW public.v_item_pesanan_jual_manajer SET (security_barrier = true);

-- ============================================================
-- 2. K2: PENYELARASAN rpc_konfirmasi_pesanan (KODE E0012 & E0013 BERSIH)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_konfirmasi_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peran            text;
  v_pesanan          record;
  v_pelanggan        record;
  v_item_count       integer;
  v_item             record;
  v_barang           record;
  v_stok_sesudah     integer;
  v_kredit           record;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- 3a. Validasi hak akses & status pesanan
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

  -- Validasi jumlah baris 1 s.d. 20 (BR-02, E03)
  SELECT count(*) INTO v_item_count
  FROM public.item_pesanan_jual
  WHERE pesanan_jual_id = p_pesanan_id;

  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- 3b. Kunci baris pelanggan (FOR UPDATE)
  SELECT * INTO v_pelanggan
  FROM public.pelanggan
  WHERE id = v_pesanan.pelanggan_id
  FOR UPDATE;

  IF v_pelanggan.id IS NULL OR v_pelanggan.aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- 3c. Kunci baris barang secara konsisten urut ID untuk hindari deadlock (BR-06)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id
  FOR UPDATE;

  -- Validasi keaktifan setiap barang & diskon pengonfirmasi
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

    -- Validasi diskon Staf Penjualan (B7)
    IF v_peran = 'penjualan' AND v_item.diskon_persen > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;

    -- 3e. BR-04: Harga di bawah HPP (NULL dianggap 0 per A5)
    IF v_peran = 'penjualan' THEN
      IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
        RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
      END IF;
    END IF;
  END LOOP;

  -- 3f. BR-13 & BR-14: Hitung kredit dan overdue via fungsi tunggal (K2)
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  -- K2: Prioritas Overdue diperiksa terlebih dahulu (E0013)
  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

  -- K2: Plafon Kredit diperiksa berikutnya (E0012)
  IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
    RAISE EXCEPTION 'Batas kredit pelanggan terlampaui'
      USING ERRCODE = 'E0012';
  END IF;

  -- 3d. Cek kecukupan stok per baris
  FOR v_item IN
    SELECT ip.*, b.kode, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.stok < v_item.jumlah THEN
      RAISE EXCEPTION 'Stok tidak cukup untuk barang %', v_item.kode USING ERRCODE = 'E0014';
    END IF;
  END LOOP;

  -- 3g. Eksekusi pengurangan stok, mutasi kartu stok, dan snapshot HPP
  PERFORM set_config('app.mutasi_stok', '1', true);

  FOR v_item IN
    SELECT ip.*, b.kode, b.harga_pokok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    -- Kurangi stok master
    UPDATE public.barang
    SET stok = stok - v_item.jumlah,
        diperbarui_pada = now()
    WHERE id = v_item.barang_id
    RETURNING stok INTO v_stok_sesudah;

    -- Tulis kartu stok (delta bertanda negatif, B14)
    INSERT INTO public.mutasi_stok (
      barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_item.barang_id, 'keluar', -v_item.jumlah, v_stok_sesudah, v_pesanan.nomor,
      'Konfirmasi pesanan jual ' || v_pesanan.nomor, auth.uid(), now()
    );

    -- Snapshot HPP satuan (A7)
    UPDATE public.item_pesanan_jual
    SET hpp_satuan = COALESCE(v_item.harga_pokok, 0)
    WHERE id = v_item.id;
  END LOOP;

  -- Perbarui status pesanan menjadi dikonfirmasi
  UPDATE public.pesanan_jual
  SET status = 'dikonfirmasi',
      dikonfirmasi_pada = now()
  WHERE id = p_pesanan_id;

  -- Catat audit log konfirmasi pesanan
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'konfirmasi_pesanan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'draf'),
    jsonb_build_object('status', 'dikonfirmasi', 'total', v_pesanan.total)
  );

  RETURN jsonb_build_object(
    'id', p_pesanan_id,
    'nomor', v_pesanan.nomor,
    'status', 'dikonfirmasi'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_konfirmasi_pesanan(uuid) TO authenticated;

-- ============================================================
-- 3. K3 & K4: PERBAIKAN OPERASI STOCK OPNAME (VALIDASI ALASAN & PENGAMAN STOK)
-- ============================================================

-- RPC: rpc_buat_opname_stok (dengan validasi K3: selisih != 0 wajib alasan >= 10 char)
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
  v_nomor text;
  v_opname_id uuid;
  v_seq integer;
  v_total_item integer := 0;
  v_total_selisih integer := 0;
  v_item record;
  v_barang_id uuid;
  v_stok_sistem integer;
  v_stok_fisik integer;
  v_keterangan text;
  v_barang_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR public.fn_peran() NOT IN ('gudang', 'manajer') THEN
    RAISE EXCEPTION 'E0001: Akses ditolak';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'E0031: Sesi opname harus berisi minimal 1 item barang';
  END IF;

  v_seq := nextval('public.seq_opname_stok');
  v_nomor := 'OPN-' || to_char((now() AT TIME ZONE 'Asia/Jakarta'), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');
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
    v_keterangan := btrim(COALESCE(v_item.keterangan, ''));

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

    -- K3: Validasi alasan minimal 10 karakter jika ada selisih stok fisik vs sistem
    IF (v_stok_fisik <> v_stok_sistem) AND char_length(v_keterangan) < 10 THEN
      RAISE EXCEPTION 'E0037: Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter'
        USING ERRCODE = 'E0037';
    END IF;

    INSERT INTO public.item_opname_stok (
      opname_stok_id, barang_id, stok_sistem, stok_fisik, keterangan
    ) VALUES (
      v_opname_id, v_barang_id, v_stok_sistem, v_stok_fisik, NULLIF(v_keterangan, '')
    );

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + (v_stok_fisik - v_stok_sistem);
  END LOOP;

  -- Update agregat di header
  UPDATE public.opname_stok
  SET total_item = v_total_item,
      total_selisih_unit = v_total_selisih
  WHERE id = v_opname_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_baru, dibuat_pada
  ) VALUES (
    v_user_id,
    CASE WHEN p_langsung_ajukan THEN 'ajukan_stock_opname' ELSE 'buat_draf_stock_opname' END,
    'opname_stok',
    v_opname_id,
    jsonb_build_object(
      'nomor', v_nomor,
      'status', CASE WHEN p_langsung_ajukan THEN 'diajukan' ELSE 'draf' END,
      'total_item', v_total_item,
      'total_selisih_unit', v_total_selisih
    ),
    now()
  );

  RETURN v_opname_id;
END;
$$;

-- RPC: rpc_ubah_draf_opname (dengan validasi K3: selisih != 0 wajib alasan >= 10 char)
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
  v_total_item integer := 0;
  v_total_selisih integer := 0;
  v_item record;
  v_barang_id uuid;
  v_stok_sistem integer;
  v_stok_fisik integer;
  v_keterangan text;
  v_barang_ids uuid[] := ARRAY[]::uuid[];
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
    v_keterangan := btrim(COALESCE(v_item.keterangan, ''));

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

    -- K3: Validasi alasan minimal 10 karakter jika ada selisih stok
    IF (v_stok_fisik <> v_stok_sistem) AND char_length(v_keterangan) < 10 THEN
      RAISE EXCEPTION 'E0037: Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter'
        USING ERRCODE = 'E0037';
    END IF;

    INSERT INTO public.item_opname_stok (
      opname_stok_id, barang_id, stok_sistem, stok_fisik, keterangan
    ) VALUES (
      p_id, v_barang_id, v_stok_sistem, v_stok_fisik, NULLIF(v_keterangan, '')
    );

    v_total_item := v_total_item + 1;
    v_total_selisih := v_total_selisih + (v_stok_fisik - v_stok_sistem);
  END LOOP;

  UPDATE public.opname_stok
  SET catatan = p_catatan,
      total_item = v_total_item,
      total_selisih_unit = v_total_selisih
  WHERE id = p_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada
  ) VALUES (
    v_user_id,
    'ubah_draf_stock_opname',
    'opname_stok',
    p_id,
    jsonb_build_object('total_item', v_opname.total_item, 'total_selisih_unit', v_opname.total_selisih_unit),
    jsonb_build_object('total_item', v_total_item, 'total_selisih_unit', v_total_selisih),
    now()
  );
END;
$$;

-- RPC: rpc_ajukan_opname_stok (dengan validasi K3)
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

  IF (SELECT COUNT(*) FROM public.item_opname_stok WHERE opname_stok_id = p_id) = 0 THEN
    RAISE EXCEPTION 'E0031: Sesi opname harus berisi minimal 1 item barang';
  END IF;

  -- K3: Validasi seluruh item dengan selisih wajib memiliki keterangan >= 10 karakter
  IF EXISTS (
    SELECT 1 FROM public.item_opname_stok
    WHERE opname_stok_id = p_id
      AND stok_fisik <> stok_sistem
      AND char_length(btrim(COALESCE(keterangan, ''))) < 10
  ) THEN
    RAISE EXCEPTION 'E0037: Item dengan selisih stok wajib memiliki keterangan minimal 10 karakter'
      USING ERRCODE = 'E0037';
  END IF;

  UPDATE public.opname_stok
  SET status = 'diajukan',
      diajukan_pada = now()
  WHERE id = p_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada
  ) VALUES (
    v_user_id,
    'ajukan_stock_opname',
    'opname_stok',
    p_id,
    jsonb_build_object('status', 'draf'),
    jsonb_build_object('status', 'diajukan'),
    now()
  );
END;
$$;

-- RPC: rpc_setujui_opname_stok (dengan pengaman K4 dan format alasan K3)
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

  -- 1. Kunci seluruh baris barang terkait secara deterministik (ORDER BY id ASC FOR UPDATE)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT i.barang_id FROM public.item_opname_stok i WHERE i.opname_stok_id = p_id
  )
  ORDER BY b.id ASC
  FOR UPDATE;

  -- 2. K4: Cek pengaman perubahan stok sistem sejak sesi opname dibuat
  FOR r_item IN 
    SELECT i.*, b.nama AS nama_barang, b.kode AS kode_barang, b.stok AS stok_sekarang
    FROM public.item_opname_stok i 
    JOIN public.barang b ON b.id = i.barang_id
    WHERE i.opname_stok_id = p_id 
    ORDER BY i.barang_id ASC
  LOOP
    IF r_item.stok_sekarang <> r_item.stok_sistem THEN
      RAISE EXCEPTION 'E0038: Stok barang "%" (%) telah berubah (sistem tercatat: %, stok sekarang: %). Batalkan sesi lalu hitung ulang.',
        r_item.nama_barang, r_item.kode_barang, r_item.stok_sistem, r_item.stok_sekarang
        USING ERRCODE = 'E0038';
    END IF;
  END LOOP;

  -- 3. Eksekusi pembaruan stok fisik dan pencatatan kartu stok (Bypass guard via flag sesi)
  PERFORM set_config('app.mutasi_stok', '1', true);

  FOR r_item IN 
    SELECT i.*
    FROM public.item_opname_stok i 
    WHERE i.opname_stok_id = p_id 
    ORDER BY i.barang_id ASC
  LOOP
    -- Perbarui stok fisik barang
    UPDATE public.barang
    SET stok = r_item.stok_fisik,
        diperbarui_pada = now()
    WHERE id = r_item.barang_id;

    -- Catat kartu stok (mutasi_stok) HANYA jika ada selisih fisik vs sistem
    IF r_item.stok_fisik <> r_item.stok_sistem THEN
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
        (r_item.stok_fisik - r_item.stok_sistem),
        r_item.stok_fisik,
        v_opname.nomor,
        'Stock opname ' || v_opname.nomor || ': ' || btrim(r_item.keterangan),
        v_user_id,
        now()
      );
    END IF;
  END LOOP;

  PERFORM set_config('app.mutasi_stok', '0', true);

  -- Update status sesi opname menjadi disetujui
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

GRANT EXECUTE ON FUNCTION public.rpc_buat_opname_stok(text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ubah_draf_opname(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ajukan_opname_stok(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_setujui_opname_stok(uuid) TO authenticated;
-- ============================================================
-- MIGRASI: Fitur Persetujuan Harga di Bawah HPP (Price Approval Workflow)
-- File: supabase/migrations/20261022200000_persetujuan_harga.sql
-- Sesuai: BR-15 s.d. BR-20, Keputusan P1-P12 & Q1-Q5, docs/fitur-persetujuan-harga.md
-- ============================================================

-- 0. FUNGSI HELPER: fn_is_penjualan
CREATE OR REPLACE FUNCTION public.fn_is_penjualan()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (public.fn_peran() = 'penjualan');
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_is_penjualan() TO authenticated;

-- 1. TABEL: public.persetujuan_harga
CREATE TABLE IF NOT EXISTS public.persetujuan_harga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_jual_id uuid NOT NULL REFERENCES public.pesanan_jual(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'menunggu' CHECK (
    status IN ('menunggu', 'disetujui', 'ditolak', 'terpakai', 'dibatalkan', 'kedaluwarsa')
  ),
  diajukan_oleh uuid NOT NULL REFERENCES public.profiles(id),
  diajukan_pada timestamp with time zone NOT NULL DEFAULT now(),
  catatan_pengaju text,
  keputusan_oleh uuid REFERENCES public.profiles(id),
  keputusan_pada timestamp with time zone,
  catatan_keputusan text,
  alasan_tolak text,
  snapshot_hash text NOT NULL,
  berlaku_sampai timestamp with time zone,
  dipakai_pada timestamp with time zone
);

-- Partial Unique Index: Maksimal 1 persetujuan aktif (menunggu / disetujui) per pesanan (P1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_persetujuan_aktif_per_pesanan
  ON public.persetujuan_harga (pesanan_jual_id)
  WHERE status IN ('menunggu', 'disetujui');

CREATE INDEX IF NOT EXISTS idx_persetujuan_status
  ON public.persetujuan_harga (status, diajukan_pada DESC);

CREATE INDEX IF NOT EXISTS idx_persetujuan_pesanan
  ON public.persetujuan_harga (pesanan_jual_id, status);

-- Enable RLS
ALTER TABLE public.persetujuan_harga ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS SELECT
DROP POLICY IF EXISTS persetujuan_select ON public.persetujuan_harga;
CREATE POLICY persetujuan_select ON public.persetujuan_harga
  FOR SELECT TO authenticated
  USING (
    public.fn_is_manajer()
    OR (public.fn_is_penjualan() AND diajukan_oleh = auth.uid())
  );

-- Hak akses kolom (snapshot_hash tidak diekspos langsung ke SELECT klien)
REVOKE ALL ON TABLE public.persetujuan_harga FROM anon, authenticated, PUBLIC;
GRANT SELECT (
  id, pesanan_jual_id, status, diajukan_oleh, diajukan_pada,
  catatan_pengaju, keputusan_oleh, keputusan_pada, catatan_keputusan,
  alasan_tolak, berlaku_sampai, dipakai_pada
) ON public.persetujuan_harga TO authenticated;

-- 2. FUNGSI HASH SNAPSHOT: fn_hitung_hash_pesanan(p_pesanan_id uuid)
CREATE OR REPLACE FUNCTION public.fn_hitung_hash_pesanan(p_pesanan_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pelanggan_id uuid;
  v_items_str text;
BEGIN
  SELECT pelanggan_id INTO v_pelanggan_id
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id;

  IF v_pelanggan_id IS NULL THEN
    RETURN md5('empty');
  END IF;

  SELECT string_agg(
    ip.barang_id::text || ':' || ip.jumlah::text || ':' || ip.harga_satuan::text || ':' || ip.diskon_persen::text,
    ',' ORDER BY ip.barang_id
  ) INTO v_items_str
  FROM public.item_pesanan_jual ip
  WHERE ip.pesanan_jual_id = p_pesanan_id;

  RETURN md5(v_pelanggan_id::text || '|' || COALESCE(v_items_str, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_hitung_hash_pesanan(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_hitung_hash_pesanan(uuid) TO authenticated;

-- 3. FUNGSI STATUS EFEKTIF: fn_persetujuan_efektif(p_pesanan_id uuid)
CREATE OR REPLACE FUNCTION public.fn_persetujuan_efektif(p_pesanan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.persetujuan_harga
    WHERE pesanan_jual_id = p_pesanan_id
      AND status = 'disetujui'
      AND (now() AT TIME ZONE 'Asia/Jakarta') < berlaku_sampai
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_persetujuan_efektif(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_persetujuan_efektif(uuid) TO authenticated;

-- 4. VIEW PUBLIK: v_persetujuan_harga
CREATE OR REPLACE VIEW public.v_persetujuan_harga
AS
SELECT
  ph.id,
  ph.pesanan_jual_id,
  pj.nomor AS nomor_pesanan,
  pj.total AS total_pesanan,
  plg.nama_toko AS nama_pelanggan,
  CASE
    WHEN ph.status = 'disetujui' AND (now() AT TIME ZONE 'Asia/Jakarta') >= ph.berlaku_sampai THEN 'kedaluwarsa'
    ELSE ph.status
  END AS status,
  ph.diajukan_oleh,
  prof.nama_lengkap AS nama_pengaju,
  ph.diajukan_pada,
  ph.catatan_pengaju,
  ph.keputusan_oleh,
  prof_m.nama_lengkap AS nama_pemutus,
  ph.keputusan_pada,
  ph.catatan_keputusan,
  ph.alasan_tolak,
  ph.berlaku_sampai,
  ph.dipakai_pada
FROM public.persetujuan_harga ph
JOIN public.pesanan_jual pj ON pj.id = ph.pesanan_jual_id
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = ph.diajukan_oleh
LEFT JOIN public.profiles prof_m ON prof_m.id = ph.keputusan_oleh;

REVOKE ALL ON public.v_persetujuan_harga FROM anon, PUBLIC;
GRANT SELECT ON public.v_persetujuan_harga TO authenticated;

-- 5. VIEW MANAJER (OWNER RIGHTS): v_persetujuan_harga_manajer
CREATE OR REPLACE VIEW public.v_persetujuan_harga_manajer
AS
SELECT
  ph.id AS persetujuan_id,
  ph.pesanan_jual_id,
  pj.nomor AS nomor_pesanan,
  pj.total AS total_pesanan,
  plg.id AS pelanggan_id,
  plg.nama_toko AS nama_pelanggan,
  CASE
    WHEN ph.status = 'disetujui' AND (now() AT TIME ZONE 'Asia/Jakarta') >= ph.berlaku_sampai THEN 'kedaluwarsa'
    ELSE ph.status
  END AS status,
  ph.diajukan_oleh,
  prof.nama_lengkap AS nama_pengaju,
  ph.diajukan_pada,
  ph.catatan_pengaju,
  ph.keputusan_oleh,
  prof_m.nama_lengkap AS nama_pemutus,
  ph.keputusan_pada,
  ph.catatan_keputusan,
  ph.alasan_tolak,
  ph.snapshot_hash,
  ph.berlaku_sampai,
  ph.dipakai_pada,
  -- Item detail dengan data finansial rahasia (HPP & Margin)
  ip.id AS item_id,
  ip.barang_id,
  b.kode AS kode_barang,
  b.nama AS nama_barang,
  ip.jumlah,
  ip.harga_satuan,
  ip.diskon_persen,
  ip.subtotal,
  b.harga_pokok AS hpp_satuan,
  (ip.harga_satuan - (ip.harga_satuan * ip.diskon_persen / 100)) - COALESCE(b.harga_pokok, 0) AS margin_satuan,
  ip.subtotal - (COALESCE(b.harga_pokok, 0) * ip.jumlah) AS margin_total
FROM public.persetujuan_harga ph
JOIN public.pesanan_jual pj ON pj.id = ph.pesanan_jual_id
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = ph.diajukan_oleh
LEFT JOIN public.profiles prof_m ON prof_m.id = ph.keputusan_oleh
JOIN public.item_pesanan_jual ip ON ip.pesanan_jual_id = pj.id
JOIN public.barang b ON b.id = ip.barang_id
WHERE public.fn_is_manajer();

REVOKE ALL ON public.v_persetujuan_harga_manajer FROM anon, PUBLIC;
GRANT SELECT ON public.v_persetujuan_harga_manajer TO authenticated;

-- 6. RPC: rpc_ajukan_persetujuan_harga
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
  v_ada_bawah_hpp boolean;
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

  -- Cek apakah ada minimal satu baris di bawah HPP (COALESCE NULL = 0 per A5)
  SELECT EXISTS (
    SELECT 1
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
      AND ip.subtotal < (COALESCE(b.harga_pokok, 0) * ip.jumlah)
  ) INTO v_ada_bawah_hpp;

  IF NOT v_ada_bawah_hpp THEN
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

-- 7. RPC: rpc_putuskan_persetujuan_harga
CREATE OR REPLACE FUNCTION public.rpc_putuskan_persetujuan_harga(
  p_id uuid,
  p_setuju boolean,
  p_catatan text DEFAULT NULL,
  p_alasan_tolak text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_persetujuan record;
  v_berlaku_sampai timestamptz;
  v_status_baru text;
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE id = p_id
  FOR UPDATE;

  IF v_persetujuan.id IS NULL THEN
    RAISE EXCEPTION 'Persetujuan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_persetujuan.status <> 'menunggu' THEN
    RAISE EXCEPTION 'Persetujuan hanya dapat diputuskan saat berstatus menunggu' USING ERRCODE = 'E0043';
  END IF;

  IF p_setuju THEN
    v_status_baru := 'disetujui';
    v_berlaku_sampai := (now() AT TIME ZONE 'Asia/Jakarta') + interval '24 hour';

    UPDATE public.persetujuan_harga
    SET status = v_status_baru,
        keputusan_oleh = auth.uid(),
        keputusan_pada = now(),
        catatan_keputusan = btrim(p_catatan),
        berlaku_sampai = v_berlaku_sampai
    WHERE id = p_id;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      auth.uid(),
      'setujui_persetujuan_harga',
      'persetujuan_harga',
      p_id,
      jsonb_build_object('status', 'menunggu'),
      jsonb_build_object('status', 'disetujui', 'berlaku_sampai', v_berlaku_sampai)
    );
  ELSE
    v_status_baru := 'ditolak';

    IF length(btrim(COALESCE(p_alasan_tolak, ''))) < 10 THEN
      RAISE EXCEPTION 'Alasan penolakan minimal 10 karakter' USING ERRCODE = 'E0044';
    END IF;

    UPDATE public.persetujuan_harga
    SET status = v_status_baru,
        keputusan_oleh = auth.uid(),
        keputusan_pada = now(),
        catatan_keputusan = btrim(p_catatan),
        alasan_tolak = btrim(p_alasan_tolak)
    WHERE id = p_id;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
    )
    VALUES (
      auth.uid(),
      'tolak_persetujuan_harga',
      'persetujuan_harga',
      p_id,
      jsonb_build_object('status', 'menunggu'),
      jsonb_build_object('status', 'ditolak', 'alasan_tolak', btrim(p_alasan_tolak))
    );
  END IF;

  RETURN jsonb_build_object(
    'id', p_id,
    'status', v_status_baru
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_putuskan_persetujuan_harga(uuid, boolean, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_putuskan_persetujuan_harga(uuid, boolean, text, text) TO authenticated;

-- 8. RPC: rpc_batalkan_pengajuan_harga
CREATE OR REPLACE FUNCTION public.rpc_batalkan_pengajuan_harga(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_persetujuan record;
BEGIN
  IF NOT public.fn_is_penjualan() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT * INTO v_persetujuan
  FROM public.persetujuan_harga
  WHERE id = p_id
  FOR UPDATE;

  IF v_persetujuan.id IS NULL THEN
    RAISE EXCEPTION 'Persetujuan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_persetujuan.diajukan_oleh <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_persetujuan.status <> 'menunggu' THEN
    RAISE EXCEPTION 'Hanya pengajuan berstatus menunggu yang dapat dibatalkan' USING ERRCODE = 'E0045';
  END IF;

  UPDATE public.persetujuan_harga
  SET status = 'dibatalkan'
  WHERE id = p_id;

  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'batalkan_pengajuan_harga',
    'persetujuan_harga',
    p_id,
    jsonb_build_object('status', 'menunggu'),
    jsonb_build_object('status', 'dibatalkan')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_batalkan_pengajuan_harga(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_batalkan_pengajuan_harga(uuid) TO authenticated;

-- 9. UPDATE RPC: rpc_simpan_draf_pesanan (Invalidasi Hash Draf)
CREATE OR REPLACE FUNCTION public.rpc_simpan_draf_pesanan(
  p_pelanggan_id uuid,
  p_items        jsonb,
  p_pesanan_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran          text;
  v_pesanan_id     uuid;
  v_nomor          text;
  v_pelanggan_aktif boolean;
  v_item_count     integer;
  v_total          numeric(14,0) := 0;
  v_item           jsonb;
  v_barang_id      uuid;
  v_jumlah         integer;
  v_diskon         numeric(5,2);
  v_harga_satuan   numeric(14,0);
  v_subtotal       numeric(14,0);
  v_barang_aktif   boolean;
  v_barang_ids     uuid[] := ARRAY[]::uuid[];
  v_inval_count    integer;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- Validasi jumlah item 1 s.d. 20 baris (BR-02)
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 20 THEN
    RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 20 baris' USING ERRCODE = 'E0003';
  END IF;

  -- Validasi pelanggan aktif
  SELECT aktif INTO v_pelanggan_aktif FROM public.pelanggan WHERE id = p_pelanggan_id;
  IF v_pelanggan_aktif IS NULL OR v_pelanggan_aktif = false THEN
    RAISE EXCEPTION 'Pelanggan tidak aktif' USING ERRCODE = 'E0007';
  END IF;

  -- Tangani draf baru vs draf eksisting
  IF p_pesanan_id IS NOT NULL THEN
    SELECT id, nomor
    INTO v_pesanan_id, v_nomor
    FROM public.pesanan_jual
    WHERE id = p_pesanan_id
    FOR UPDATE;

    IF v_pesanan_id IS NULL THEN
      RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
    END IF;

    -- Validasi status harus draf (BR-02, E08)
    IF (SELECT status FROM public.pesanan_jual WHERE id = p_pesanan_id) <> 'draf' THEN
      RAISE EXCEPTION 'Pesanan hanya bisa diubah saat berstatus draf' USING ERRCODE = 'E0008';
    END IF;

    -- Staf Penjualan hanya boleh mengubah draf miliknya sendiri
    IF v_peran = 'penjualan' AND (SELECT dibuat_oleh FROM public.pesanan_jual WHERE id = p_pesanan_id) <> auth.uid() THEN
      RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
    END IF;

    -- P2 & BR-18: Invalidasi persetujuan aktif bila draf diubah
    UPDATE public.persetujuan_harga
    SET status = 'kedaluwarsa'
    WHERE pesanan_jual_id = p_pesanan_id
      AND status IN ('menunggu', 'disetujui');
    GET DIAGNOSTICS v_inval_count = ROW_COUNT;

    IF v_inval_count > 0 THEN
      INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_baru
      )
      VALUES (
        auth.uid(),
        'persetujuan_kedaluwarsa_edit_draf',
        'persetujuan_harga',
        p_pesanan_id,
        jsonb_build_object('alasan', 'draf_diubah', 'jumlah_inval', v_inval_count)
      );
    END IF;

    -- Perbarui pelanggan jika berubah
    UPDATE public.pesanan_jual SET pelanggan_id = p_pelanggan_id WHERE id = p_pesanan_id;
  ELSE
    -- Generate nomor baru SO-YYYY-NNNNNN (A8)
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

    -- BR-03: Batas diskon per peran
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
    v_subtotal := round(v_jumlah * v_harga_satuan * (100 - v_diskon) / 100.0);
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

-- 10. UPDATE RPC: rpc_batalkan_draf (Menutup Pengajuan Aktif)
CREATE OR REPLACE FUNCTION public.rpc_batalkan_draf(p_pesanan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran  text;
  v_status text;
  v_pemilik uuid;
  v_batal_count integer;
BEGIN
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  SELECT status, dibuat_oleh INTO v_status, v_pemilik
  FROM public.pesanan_jual
  WHERE id = p_pesanan_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_peran = 'penjualan' AND v_pemilik <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_status <> 'draf' THEN
    RAISE EXCEPTION 'Perpindahan status tidak diizinkan' USING ERRCODE = 'E0015';
  END IF;

  -- P8: Batalkan persetujuan aktif otomatis
  UPDATE public.persetujuan_harga
  SET status = 'dibatalkan'
  WHERE pesanan_jual_id = p_pesanan_id
    AND status IN ('menunggu', 'disetujui');
  GET DIAGNOSTICS v_batal_count = ROW_COUNT;

  IF v_batal_count > 0 THEN
    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_baru
    )
    VALUES (
      auth.uid(),
      'persetujuan_dibatalkan_karena_draf_dibatalkan',
      'persetujuan_harga',
      p_pesanan_id,
      jsonb_build_object('pesanan_jual_id', p_pesanan_id, 'jumlah', v_batal_count)
    );
  END IF;

  UPDATE public.pesanan_jual
  SET status = 'dibatalkan',
      dibatalkan_pada = now()
  WHERE id = p_pesanan_id;
END;
$$;

-- 11. UPDATE RPC: rpc_konfirmasi_pesanan (Kunci P9 & Validasi Persetujuan)
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
  v_persetujuan_id_pakai  uuid := NULL;
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

    -- Validasi diskon Staf Penjualan (B7)
    IF v_peran = 'penjualan' AND v_item.diskon_persen > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;

    -- Deteksi baris di bawah HPP (COALESCE NULL = 0 per A5)
    IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
      v_ada_bawah_hpp := true;
    END IF;
  END LOOP;

  -- P6: Evaluasi BR-04 untuk Staf Penjualan
  IF v_peran = 'penjualan' AND v_ada_bawah_hpp THEN
    -- Periksa apakah ada persetujuan yang disetujui
    IF v_persetujuan.id IS NULL OR v_persetujuan.status <> 'disetujui' THEN
      RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
    END IF;

    -- P3 & BR-17: Cek masa berlaku 24 jam (lazy evaluation)
    IF (now() AT TIME ZONE 'Asia/Jakarta') >= v_persetujuan.berlaku_sampai THEN
      UPDATE public.persetujuan_harga
      SET status = 'kedaluwarsa'
      WHERE id = v_persetujuan.id;

      INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_baru
      )
      VALUES (
        auth.uid(),
        'persetujuan_kedaluwarsa_saat_konfirmasi',
        'persetujuan_harga',
        v_persetujuan.id,
        jsonb_build_object('alasan', 'lewat_24_jam')
      );

      RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
    END IF;

    -- P2 & BR-18: Cek snapshot_hash
    v_current_hash := public.fn_hitung_hash_pesanan(p_pesanan_id);
    IF v_current_hash <> v_persetujuan.snapshot_hash THEN
      UPDATE public.persetujuan_harga
      SET status = 'kedaluwarsa'
      WHERE id = v_persetujuan.id;

      INSERT INTO public.audit_log (
        pelaku_id, aksi, nama_tabel, data_id, nilai_baru
      )
      VALUES (
        auth.uid(),
        'persetujuan_kedaluwarsa_saat_konfirmasi',
        'persetujuan_harga',
        v_persetujuan.id,
        jsonb_build_object('alasan', 'hash_mismatch')
      );

      RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
    END IF;

    -- Semua syarat persetujuan lolos! Tandai untuk dipakai
    v_persetujuan_id_pakai := v_persetujuan.id;
  END IF;

  -- 3f. BR-13 & BR-14: Hitung kredit dan overdue via fungsi tunggal (K2)
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  -- K2: Prioritas Overdue diperiksa terlebih dahulu (E0013)
  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

  -- K2: Plafon Kredit diperiksa berikutnya (E0012)
  IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
    RAISE EXCEPTION 'Batas kredit pelanggan terlampaui'
      USING ERRCODE = 'E0012';
  END IF;

  -- 3d. Cek kecukupan stok per baris
  FOR v_item IN
    SELECT ip.*, b.kode, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    IF v_item.stok < v_item.jumlah THEN
      RAISE EXCEPTION 'Stok tidak cukup untuk barang %', v_item.kode USING ERRCODE = 'E0014';
    END IF;
  END LOOP;

  -- 3g. Eksekusi mutasi stok & snapshot HPP
  PERFORM set_config('app.mutasi_stok', '1', true);

  FOR v_item IN
    SELECT ip.*, b.kode, b.harga_pokok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id
  LOOP
    -- Kurangi stok master
    UPDATE public.barang
    SET stok = stok - v_item.jumlah,
        diperbarui_pada = now()
    WHERE id = v_item.barang_id
    RETURNING stok INTO v_stok_sesudah;

    -- Tulis kartu stok (delta bertanda negatif, B14)
    INSERT INTO public.mutasi_stok (
      barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_item.barang_id, 'keluar', -v_item.jumlah, v_stok_sesudah, v_pesanan.nomor,
      'Konfirmasi pesanan jual ' || v_pesanan.nomor, auth.uid(), now()
    );

    -- Snapshot HPP satuan (A7)
    UPDATE public.item_pesanan_jual
    SET hpp_satuan = COALESCE(v_item.harga_pokok, 0)
    WHERE id = v_item.id;
  END LOOP;

  -- P3 & BR-17: Tandai persetujuan terpakai jika ada
  IF v_persetujuan_id_pakai IS NOT NULL THEN
    UPDATE public.persetujuan_harga
    SET status = 'terpakai',
        dipakai_pada = now()
    WHERE id = v_persetujuan_id_pakai;

    INSERT INTO public.audit_log (
      pelaku_id, aksi, nama_tabel, data_id, nilai_baru
    )
    VALUES (
      auth.uid(),
      'pakai_persetujuan_harga',
      'persetujuan_harga',
      v_persetujuan_id_pakai,
      jsonb_build_object('status', 'terpakai', 'pesanan_jual_id', p_pesanan_id)
    );
  END IF;

  -- Perbarui status pesanan menjadi dikonfirmasi
  UPDATE public.pesanan_jual
  SET status = 'dikonfirmasi',
      dikonfirmasi_pada = now()
  WHERE id = p_pesanan_id;

  -- Catat audit log konfirmasi pesanan
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru
  )
  VALUES (
    auth.uid(),
    'konfirmasi_pesanan',
    'pesanan_jual',
    p_pesanan_id,
    jsonb_build_object('status', 'draf'),
    jsonb_build_object('status', 'dikonfirmasi', 'total', v_pesanan.total)
  );

  RETURN jsonb_build_object(
    'id', p_pesanan_id,
    'nomor', v_pesanan.nomor,
    'status', 'dikonfirmasi'
  );
END;
$$;
-- Migration: 20261022210000_penagihan_piutang.sql
-- Fitur: Penagihan Piutang, Klasifikasi Umur Tagihan, Kartu Piutang, Pengingat WA, dan Catatan Penagihan Append-Only

-- 1. TABEL: catatan_penagihan (Append-Only)
CREATE TABLE IF NOT EXISTS public.catatan_penagihan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelanggan_id uuid NOT NULL REFERENCES public.pelanggan(id) ON DELETE RESTRICT,
  pesanan_jual_id uuid NULL REFERENCES public.pesanan_jual(id) ON DELETE SET NULL,
  jenis text NOT NULL CHECK (jenis IN ('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan')),
  isi text NOT NULL,
  janji_bayar_tanggal date NULL,
  dibuat_oleh uuid NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_catatan_penagihan_isi_length CHECK (length(btrim(isi)) BETWEEN 3 AND 500),
  CONSTRAINT ck_catatan_penagihan_janji_bayar CHECK (
    (jenis = 'janji_bayar' AND janji_bayar_tanggal IS NOT NULL) OR
    (jenis <> 'janji_bayar' AND janji_bayar_tanggal IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_catatan_penagihan_pelanggan ON public.catatan_penagihan(pelanggan_id, dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_penagihan_pesanan ON public.catatan_penagihan(pesanan_jual_id, dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_catatan_penagihan_janji ON public.catatan_penagihan(janji_bayar_tanggal) WHERE jenis = 'janji_bayar';

-- 2. TRIGGER GUARD: Mencegah UPDATE dan DELETE (Append-Only)
CREATE OR REPLACE FUNCTION public.fn_guard_catatan_penagihan()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catatan penagihan bersifat permanen dan tidak dapat diubah atau dihapus'
    USING ERRCODE = 'E0051';
END;
$$;

DROP TRIGGER IF EXISTS trg_catatan_penagihan_guard ON public.catatan_penagihan;
CREATE TRIGGER trg_catatan_penagihan_guard
  BEFORE UPDATE OR DELETE ON public.catatan_penagihan
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_catatan_penagihan();

-- 3. FUNGSI KLASIFIKASI UMUR TAGIHAN
CREATE OR REPLACE FUNCTION public.fn_klasifikasi_tagihan(
  p_jatuh_tempo date,
  p_today date DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_jatuh_tempo < p_today THEN
      CASE
        WHEN (p_today - p_jatuh_tempo) BETWEEN 1 AND 7 THEN 'overdue_1_7'
        WHEN (p_today - p_jatuh_tempo) BETWEEN 8 AND 30 THEN 'overdue_8_30'
        ELSE 'overdue_lebih_30'
      END
    WHEN p_jatuh_tempo = p_today THEN 'hari_ini'
    WHEN p_jatuh_tempo <= (p_today + 3) THEN 'segera'
    ELSE 'belum_jatuh_tempo'
  END;
$$;

-- 4. VIEW: v_tagihan (security invoker = true)
CREATE OR REPLACE VIEW public.v_tagihan AS
WITH latest_janji_pesanan AS (
  SELECT DISTINCT ON (pesanan_jual_id)
    id AS janji_id,
    pelanggan_id,
    pesanan_jual_id,
    janji_bayar_tanggal,
    isi AS janji_catatan,
    dibuat_pada AS janji_dibuat_pada
  FROM public.catatan_penagihan
  WHERE jenis = 'janji_bayar' AND pesanan_jual_id IS NOT NULL
  ORDER BY pesanan_jual_id, dibuat_pada DESC
),
latest_janji_pelanggan AS (
  SELECT DISTINCT ON (pelanggan_id)
    id AS janji_id,
    pelanggan_id,
    janji_bayar_tanggal,
    isi AS janji_catatan,
    dibuat_pada AS janji_dibuat_pada
  FROM public.catatan_penagihan
  WHERE jenis = 'janji_bayar' AND pesanan_jual_id IS NULL
  ORDER BY pelanggan_id, dibuat_pada DESC
)
SELECT
  pj.id AS pesanan_id,
  pj.nomor AS nomor_pesanan,
  pj.pelanggan_id,
  plg.kode AS kode_pelanggan,
  plg.nama_toko,
  plg.telepon,
  plg.alamat,
  plg.termin_hari,
  plg.batas_kredit,
  pj.total,
  pj.dibuat_oleh,
  prof.nama_lengkap AS nama_sales,
  pj.dibuat_pada,
  pj.dikirim_pada,
  pj.jatuh_tempo,
  -- Perhitungan selisih hari berbasis tanggal bisnis Asia/Jakarta
  CASE
    WHEN pj.jatuh_tempo < (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN ((now() AT TIME ZONE 'Asia/Jakarta')::date - pj.jatuh_tempo)::integer
    ELSE 0
  END AS hari_terlambat,
  CASE
    WHEN pj.jatuh_tempo >= (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN (pj.jatuh_tempo - (now() AT TIME ZONE 'Asia/Jakarta')::date)::integer
    ELSE 0
  END AS hari_menuju,
  -- Klasifikasi umur
  public.fn_klasifikasi_tagihan(pj.jatuh_tempo, (now() AT TIME ZONE 'Asia/Jakarta')::date) AS klasifikasi,
  -- Janji bayar aktif terkait
  COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) AS janji_bayar_tanggal,
  COALESCE(ljp.janji_catatan, ljplg.janji_catatan) AS janji_catatan,
  CASE
    WHEN COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) IS NOT NULL
         AND COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) < (now() AT TIME ZONE 'Asia/Jakarta')::date
      THEN 'terlewat'
    WHEN COALESCE(ljp.janji_bayar_tanggal, ljplg.janji_bayar_tanggal) IS NOT NULL
      THEN 'aktif'
    ELSE 'tidak_ada'
  END AS status_janji
FROM public.pesanan_jual pj
JOIN public.pelanggan plg ON plg.id = pj.pelanggan_id
JOIN public.profiles prof ON prof.id = pj.dibuat_oleh
LEFT JOIN latest_janji_pesanan ljp ON ljp.pesanan_jual_id = pj.id
LEFT JOIN latest_janji_pelanggan ljplg ON ljplg.pelanggan_id = pj.pelanggan_id
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR (
      public.fn_peran() = 'penjualan'
      AND pj.dibuat_oleh = auth.uid()
    )
  );

-- Set security_invoker pada Postgres 15+ jika didukung
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 150000 THEN
    ALTER VIEW public.v_tagihan SET (security_invoker = true);
  END IF;
END $$;

-- Hak akses view v_tagihan
REVOKE ALL ON public.v_tagihan FROM anon, PUBLIC;
GRANT SELECT ON public.v_tagihan TO authenticated;

-- 5. RLS & GRANTS: catatan_penagihan
ALTER TABLE public.catatan_penagihan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catatan_penagihan_select" ON public.catatan_penagihan;
CREATE POLICY "catatan_penagihan_select"
  ON public.catatan_penagihan FOR SELECT
  TO authenticated
  USING (
    public.fn_is_manajer()
    OR (
      public.fn_peran() = 'penjualan'
      AND (
        dibuat_oleh = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.pesanan_jual pj
          WHERE pj.pelanggan_id = catatan_penagihan.pelanggan_id
            AND pj.status = 'dikirim'
            AND pj.dibuat_oleh = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "catatan_penagihan_modify_block" ON public.catatan_penagihan;
CREATE POLICY "catatan_penagihan_modify_block"
  ON public.catatan_penagihan FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.catatan_penagihan FROM anon, PUBLIC;
GRANT SELECT ON public.catatan_penagihan TO authenticated;

-- 6. RPC: rpc_catat_penagihan
CREATE OR REPLACE FUNCTION public.rpc_catat_penagihan(
  p_pelanggan_id uuid,
  p_pesanan_jual_id uuid DEFAULT NULL,
  p_jenis text DEFAULT 'catatan',
  p_isi text DEFAULT '',
  p_janji_bayar_tanggal date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_user_id uuid;
  v_today date;
  v_catatan_id uuid;
  v_created_at timestamptz;
  v_pj_pelanggan_id uuid;
  v_pj_status text;
  v_pj_dibuat_oleh uuid;
BEGIN
  v_user_id := auth.uid();
  v_peran := public.fn_peran();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  -- 1. Cek peran pemanggil
  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak: hanya Staf Penjualan dan Manajer yang dapat mencatat penagihan'
      USING ERRCODE = 'E0001';
  END IF;

  -- 2. Cek pelanggan
  IF NOT EXISTS (SELECT 1 FROM public.pelanggan WHERE id = p_pelanggan_id) THEN
    RAISE EXCEPTION 'Pelanggan tidak ditemukan'
      USING ERRCODE = 'E0002';
  END IF;

  -- 3. Otorisasi Penjualan
  IF v_peran = 'penjualan' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pesanan_jual
      WHERE pelanggan_id = p_pelanggan_id
        AND status = 'dikirim'
        AND dibuat_oleh = v_user_id
    ) THEN
      RAISE EXCEPTION 'Anda tidak memiliki wewenang menagih pelanggan ini'
        USING ERRCODE = 'E0050';
    END IF;
  END IF;

  -- 4. Validasi Faktur jika diisi
  IF p_pesanan_jual_id IS NOT NULL THEN
    SELECT pelanggan_id, status, dibuat_oleh
    INTO v_pj_pelanggan_id, v_pj_status, v_pj_dibuat_oleh
    FROM public.pesanan_jual
    WHERE id = p_pesanan_jual_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Faktur tidak valid untuk penagihan pelanggan ini'
        USING ERRCODE = 'E0052';
    END IF;

    IF v_pj_pelanggan_id <> p_pelanggan_id OR v_pj_status <> 'dikirim' THEN
      RAISE EXCEPTION 'Faktur tidak valid untuk penagihan pelanggan ini'
        USING ERRCODE = 'E0052';
    END IF;

    IF v_peran = 'penjualan' AND v_pj_dibuat_oleh <> v_user_id THEN
      RAISE EXCEPTION 'Anda tidak memiliki wewenang menagih pelanggan ini'
        USING ERRCODE = 'E0050';
    END IF;
  END IF;

  -- 5. Validasi Jenis
  IF p_jenis NOT IN ('pengingat_wa', 'telepon', 'kunjungan', 'janji_bayar', 'catatan') THEN
    RAISE EXCEPTION 'Jenis catatan penagihan tidak valid'
      USING ERRCODE = 'E0002';
  END IF;

  -- 6. Validasi Isi
  IF length(btrim(p_isi)) < 3 OR length(btrim(p_isi)) > 500 THEN
    RAISE EXCEPTION 'Catatan penagihan minimal 3 karakter dan maksimal 500 karakter'
      USING ERRCODE = 'E0047';
  END IF;

  -- 7. Validasi Janji Bayar
  IF p_jenis = 'janji_bayar' THEN
    IF p_janji_bayar_tanggal IS NULL THEN
      RAISE EXCEPTION 'Tanggal janji bayar wajib diisi untuk jenis penagihan janji bayar'
        USING ERRCODE = 'E0048';
    END IF;
    IF p_janji_bayar_tanggal < v_today THEN
      RAISE EXCEPTION 'Tanggal janji bayar tidak boleh di masa lalu'
        USING ERRCODE = 'E0049';
    END IF;
  ELSE
    p_janji_bayar_tanggal := NULL;
  END IF;

  -- 8. Insert catatan
  INSERT INTO public.catatan_penagihan (
    pelanggan_id,
    pesanan_jual_id,
    jenis,
    isi,
    janji_bayar_tanggal,
    dibuat_oleh
  ) VALUES (
    p_pelanggan_id,
    p_pesanan_jual_id,
    p_jenis,
    btrim(p_isi),
    p_janji_bayar_tanggal,
    v_user_id
  )
  RETURNING id, dibuat_pada INTO v_catatan_id, v_created_at;

  RETURN jsonb_build_object(
    'id', v_catatan_id,
    'pelanggan_id', p_pelanggan_id,
    'pesanan_jual_id', p_pesanan_jual_id,
    'jenis', p_jenis,
    'dibuat_pada', v_created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_catat_penagihan FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_catat_penagihan TO authenticated;

-- 7. RPC: rpc_baca_catatan_penagihan
CREATE OR REPLACE FUNCTION public.rpc_baca_catatan_penagihan(
  p_pelanggan_id uuid,
  p_pesanan_jual_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  pelanggan_id uuid,
  pesanan_jual_id uuid,
  nomor_pesanan text,
  jenis text,
  isi text,
  janji_bayar_tanggal date,
  status_janji text,
  dibuat_oleh uuid,
  nama_pembuat text,
  dibuat_pada timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran text;
  v_user_id uuid;
  v_today date;
BEGIN
  v_user_id := auth.uid();
  v_peran := public.fn_peran();
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  IF v_peran NOT IN ('penjualan', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF v_peran = 'penjualan' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pesanan_jual
      WHERE pelanggan_id = p_pelanggan_id
        AND status = 'dikirim'
        AND dibuat_oleh = v_user_id
    ) THEN
      RAISE EXCEPTION 'Anda tidak memiliki wewenang menagih pelanggan ini'
        USING ERRCODE = 'E0050';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    cp.id,
    cp.pelanggan_id,
    cp.pesanan_jual_id,
    pj.nomor AS nomor_pesanan,
    cp.jenis,
    cp.isi,
    cp.janji_bayar_tanggal,
    CASE
      WHEN cp.janji_bayar_tanggal IS NOT NULL AND cp.janji_bayar_tanggal < v_today THEN 'terlewat'
      WHEN cp.janji_bayar_tanggal IS NOT NULL THEN 'aktif'
      ELSE 'tidak_ada'
    END AS status_janji,
    cp.dibuat_oleh,
    prof.nama_lengkap AS nama_pembuat,
    cp.dibuat_pada
  FROM public.catatan_penagihan cp
  LEFT JOIN public.pesanan_jual pj ON pj.id = cp.pesanan_jual_id
  JOIN public.profiles prof ON prof.id = cp.dibuat_oleh
  WHERE cp.pelanggan_id = p_pelanggan_id
    AND (p_pesanan_jual_id IS NULL OR cp.pesanan_jual_id = p_pesanan_jual_id)
  ORDER BY cp.dibuat_pada DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_baca_catatan_penagihan FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_baca_catatan_penagihan TO authenticated;
-- ============================================================
-- Migrasi: Cetak Surat Jalan (PRD 11.2)
-- Berkas: 20261023053000_surat_jalan.sql
-- Sesuai: docs/fitur-surat-jalan.md & S1 s.d. S6
-- Zero-Leakage: Tidak ada kolom harga, subtotal, diskon, total, HPP, margin, termin, jatuh tempo
-- ============================================================

-- 1. View Header: public.v_surat_jalan
-- Hanya untuk pesanan berstatus 'dikirim'
-- Hanya dapat diakses oleh Manajer, Gudang, atau Penjualan pemilik pesanan
CREATE OR REPLACE VIEW public.v_surat_jalan
AS
SELECT
  pj.id,
  pj.nomor,
  pj.status,
  pj.dibuat_oleh,
  pj.dibuat_pada,
  pj.dikirim_pada,
  NULL::text AS catatan,
  -- Data Pelanggan (HANYA kolom non-uang)
  p.id AS pelanggan_id,
  p.kode AS pelanggan_kode,
  p.nama_toko AS pelanggan_nama,
  p.telepon AS pelanggan_telepon,
  p.alamat AS pelanggan_alamat,
  -- Data Pembuat / Sales (HANYA nama)
  pr.nama_lengkap AS pembuat_nama
FROM public.pesanan_jual pj
JOIN public.pelanggan p ON p.id = pj.pelanggan_id
LEFT JOIN public.profiles pr ON pr.id = pj.dibuat_oleh
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR public.fn_peran() = 'gudang'
    OR (
      public.fn_peran() = 'penjualan'
      AND pj.dibuat_oleh = auth.uid()
    )
  );

-- 2. View Items: public.v_surat_jalan_item
-- Hanya untuk item pada pesanan berstatus 'dikirim'
-- Hanya memuat kode, nama, satuan, dan kuantitas fisik
CREATE OR REPLACE VIEW public.v_surat_jalan_item
AS
SELECT
  ip.id,
  ip.pesanan_jual_id,
  ip.barang_id,
  b.kode AS kode_barang,
  b.nama AS nama_barang,
  b.satuan,
  ip.jumlah
FROM public.item_pesanan_jual ip
JOIN public.barang b ON b.id = ip.barang_id
JOIN public.pesanan_jual pj ON pj.id = ip.pesanan_jual_id
WHERE pj.status = 'dikirim'
  AND (
    public.fn_is_manajer()
    OR public.fn_peran() = 'gudang'
    OR (
      public.fn_peran() = 'penjualan'
      AND pj.dibuat_oleh = auth.uid()
    )
  );

-- 3. Set security_invoker = true pada PostgreSQL 15+ jika didukung
DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 150000 THEN
    ALTER VIEW public.v_surat_jalan SET (security_invoker = true);
    ALTER VIEW public.v_surat_jalan_item SET (security_invoker = true);
  END IF;
END $$;

-- 4. Hak Akses: Cabut dari anon & PUBLIC, berikan SELECT ke authenticated
REVOKE ALL ON public.v_surat_jalan FROM anon, PUBLIC;
GRANT SELECT ON public.v_surat_jalan TO authenticated;

REVOKE ALL ON public.v_surat_jalan_item FROM anon, PUBLIC;
GRANT SELECT ON public.v_surat_jalan_item TO authenticated;

-- ============================================================
-- Migrasi: Notifikasi Email Stok Menipis Harian (PRD 11.1)
-- Berkas: 20261023060000_notifikasi_email_stok.sql
-- ============================================================

-- 1. TABEL LOG & IDEMPOTENSI NOTIFIKASI EMAIL
CREATE TABLE IF NOT EXISTS public.notifikasi_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jenis text NOT NULL CHECK (jenis IN ('stok_menipis', 'uji')),
  tanggal_bisnis date NOT NULL,
  status text NOT NULL CHECK (status IN ('diklaim', 'terkirim', 'dilewati', 'gagal')),
  jumlah_barang integer NOT NULL DEFAULT 0 CHECK (jumlah_barang >= 0),
  jumlah_penerima integer NOT NULL DEFAULT 0 CHECK (jumlah_penerima >= 0),
  galat_singkat text,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  diperbarui_pada timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifikasi_email_log IS 'Riwayat dan kontrol idempotensi notifikasi email otomatis sistem.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifikasi_stok_harian
  ON public.notifikasi_email_log (jenis, tanggal_bisnis)
  WHERE jenis = 'stok_menipis';

CREATE INDEX IF NOT EXISTS idx_notifikasi_log_dibuat
  ON public.notifikasi_email_log (dibuat_pada DESC);

ALTER TABLE public.notifikasi_email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifikasi_email_log_select_manajer" ON public.notifikasi_email_log;
CREATE POLICY "notifikasi_email_log_select_manajer"
  ON public.notifikasi_email_log FOR SELECT
  TO authenticated
  USING (public.fn_is_manajer());

GRANT SELECT ON public.notifikasi_email_log TO authenticated;
GRANT ALL ON public.notifikasi_email_log TO service_role;

-- 2. RPC SISTEM: DAFTAR BARANG STOK MENIPIS (E1, E5)
CREATE OR REPLACE FUNCTION public.rpc_sistem_daftar_stok_menipis()
RETURNS TABLE (
  kode text,
  nama text,
  satuan text,
  stok integer,
  stok_minimum integer,
  selisih integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.kode,
    b.nama,
    b.satuan,
    b.stok,
    b.stok_minimum,
    (b.stok_minimum - b.stok)::integer AS selisih
  FROM public.barang b
  WHERE b.aktif = true
    AND b.stok <= b.stok_minimum
  ORDER BY (b.stok_minimum - b.stok) DESC, b.kode ASC;
END;
$$;

-- 3. RPC SISTEM: DAFTAR PENERIMA NOTIFIKASI STOK (E2, E5)
CREATE OR REPLACE FUNCTION public.rpc_sistem_penerima_notifikasi_stok()
RETURNS TABLE (
  email text,
  nama_lengkap text,
  peran text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::text,
    COALESCE(p.nama_lengkap, u.email::text) AS nama_lengkap,
    p.peran
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.aktif = true
    AND p.peran IN ('manajer', 'gudang')
    AND u.email IS NOT NULL
    AND u.email <> ''
  ORDER BY p.peran ASC, p.nama_lengkap ASC;
END;
$$;

-- 4. RPC SISTEM: KLAIM NOTIFIKASI (E6)
CREATE OR REPLACE FUNCTION public.rpc_sistem_klaim_notifikasi(
  p_jenis text,
  p_tanggal_bisnis date
)
RETURNS TABLE (
  boleh_kirim boolean,
  log_id uuid,
  pesan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_status text;
  v_new_id uuid;
  v_last_uji timestamptz;
BEGIN
  IF p_jenis NOT IN ('stok_menipis', 'uji') THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Jenis notifikasi tidak valid';
    RETURN;
  END IF;

  IF p_jenis = 'stok_menipis' THEN
    SELECT id, status INTO v_existing_id, v_existing_status
    FROM public.notifikasi_email_log
    WHERE jenis = 'stok_menipis' AND tanggal_bisnis = p_tanggal_bisnis
    FOR UPDATE;

    IF v_existing_id IS NOT NULL THEN
      IF v_existing_status = 'gagal' THEN
        UPDATE public.notifikasi_email_log
        SET status = 'diklaim',
            galat_singkat = NULL,
            diperbarui_pada = now()
        WHERE id = v_existing_id;

        RETURN QUERY SELECT true, v_existing_id, 'Klaim ulang setelah gagal diizinkan'::text;
        RETURN;
      ELSE
        RETURN QUERY SELECT false, v_existing_id, 'Notifikasi hari ini sudah pernah diproses'::text;
        RETURN;
      END IF;
    END IF;

    INSERT INTO public.notifikasi_email_log (
      jenis, tanggal_bisnis, status, dibuat_pada, diperbarui_pada
    )
    VALUES (
      'stok_menipis', p_tanggal_bisnis, 'diklaim', now(), now()
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT true, v_new_id, 'Klaim berhasil'::text;
    RETURN;
  END IF;

  IF p_jenis = 'uji' THEN
    SELECT COALESCE(MAX(dibuat_pada), '1970-01-01'::timestamptz) INTO v_last_uji
    FROM public.notifikasi_email_log
    WHERE jenis = 'uji';

    IF (now() - v_last_uji) < INTERVAL '1 minute' THEN
      RETURN QUERY SELECT false, NULL::uuid, 'Uji kirim dibatasi maksimal 1 kali per menit'::text;
      RETURN;
    END IF;

    INSERT INTO public.notifikasi_email_log (
      jenis, tanggal_bisnis, status, dibuat_pada, diperbarui_pada
    )
    VALUES (
      'uji', p_tanggal_bisnis, 'diklaim', now(), now()
    )
    RETURNING id INTO v_new_id;

    RETURN QUERY SELECT true, v_new_id, 'Klaim uji berhasil'::text;
    RETURN;
  END IF;
END;
$$;

-- 5. RPC SISTEM: SELESAIKAN NOTIFIKASI (E6)
CREATE OR REPLACE FUNCTION public.rpc_sistem_selesaikan_notifikasi(
  p_log_id uuid,
  p_status text,
  p_jumlah_barang integer,
  p_jumlah_penerima integer,
  p_galat text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('terkirim', 'dilewati', 'gagal') THEN
    RAISE EXCEPTION 'Status tidak valid' USING ERRCODE = 'E0015';
  END IF;

  UPDATE public.notifikasi_email_log
  SET status = p_status,
      jumlah_barang = p_jumlah_barang,
      jumlah_penerima = p_jumlah_penerima,
      galat_singkat = p_galat,
      diperbarui_pada = now()
  WHERE id = p_log_id;

  RETURN true;
END;
$$;

-- 6. RPC BACA: RIWAYAT NOTIFIKASI KHUSUS MANAJER (E10)
CREATE OR REPLACE FUNCTION public.rpc_riwayat_notifikasi_manajer()
RETURNS TABLE (
  id uuid,
  jenis text,
  tanggal_bisnis date,
  status text,
  jumlah_barang integer,
  jumlah_penerima integer,
  galat_singkat text,
  dibuat_pada timestamptz,
  diperbarui_pada timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.jenis,
    l.tanggal_bisnis,
    l.status,
    l.jumlah_barang,
    l.jumlah_penerima,
    l.galat_singkat,
    l.dibuat_pada,
    l.diperbarui_pada
  FROM public.notifikasi_email_log l
  ORDER BY l.dibuat_pada DESC
  LIMIT 50;
END;
$$;

-- 7. PENEGAKAN HAK AKSES (GRANT & REVOKE) (E5)
REVOKE ALL ON FUNCTION public.rpc_sistem_daftar_stok_menipis() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_daftar_stok_menipis() TO service_role;

REVOKE ALL ON FUNCTION public.rpc_sistem_penerima_notifikasi_stok() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_penerima_notifikasi_stok() TO service_role;

REVOKE ALL ON FUNCTION public.rpc_sistem_klaim_notifikasi(text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_klaim_notifikasi(text, date) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_sistem_selesaikan_notifikasi(uuid, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sistem_selesaikan_notifikasi(uuid, text, integer, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_riwayat_notifikasi_manajer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_riwayat_notifikasi_manajer() TO authenticated;
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
