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
