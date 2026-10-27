-- ============================================================
-- Migrasi: 20261027190000_penguncian_stok_pesanan.sql
-- Penegasan Penguncian Baris (FOR UPDATE), Fungsi Pengurangan Stok,
-- dan Pemrosesan Pesanan Jual Anti-Bentrok Konkurensi
-- Sesuai PRD CV Sinar Abadi Niaga (BR-02, BR-06)
-- ============================================================

-- 1. Fungsi Atomik Pengurangan Stok: public.p_kurangi_stok_pesanan
-- Fungsi ini mengeksekusi penguncian baris eksplisit:
-- SELECT stok FROM barang WHERE id = p_barang_id FOR UPDATE;
-- Validasi anti-minus: jika stok < qty, batalkan (RAISE EXCEPTION E0014)
CREATE OR REPLACE FUNCTION public.p_kurangi_stok_pesanan(
  p_barang_id      uuid,
  p_qty            integer,
  p_nomor_dokumen  text,
  p_dibuat_oleh    uuid DEFAULT auth.uid()
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_peran         text;
  v_stok_sekarang integer;
  v_stok_sesudah  integer;
  v_aktif         boolean;
  v_nama_barang   text;
  v_kode_barang   text;
BEGIN
  -- Validasi autentikasi & peran pengguna
  v_peran := public.fn_peran();
  IF v_peran NOT IN ('penjualan', 'gudang', 'manajer') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'Jumlah pengurangan stok harus lebih dari 0' USING ERRCODE = 'E0004';
  END IF;

  -- PENGUNCIAN BARIS EKSPLISIT (ROW-LEVEL LOCK FOR UPDATE)
  -- Mengantrikan transaksi konkuren secara serializable pada baris barang terkait
  SELECT b.stok, b.aktif, b.nama, b.kode
  INTO v_stok_sekarang, v_aktif, v_nama_barang, v_kode_barang
  FROM public.barang b
  WHERE b.id = p_barang_id
  FOR UPDATE;

  IF v_stok_sekarang IS NULL THEN
    RAISE EXCEPTION 'Barang tidak ditemukan' USING ERRCODE = 'E0002';
  END IF;

  IF v_aktif = false THEN
    RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
  END IF;

  -- VALIDASI ANTI-MINUS & ANTI-BENTROK
  IF v_stok_sekarang < p_qty THEN
    RAISE EXCEPTION 'Stok barang tidak mencukupi untuk memenuhi pesanan'
      USING ERRCODE = 'E0014';
  END IF;

  -- Buka kunci trigger guard mutasi stok
  PERFORM set_config('app.mutasi_stok', '1', true);

  -- Eksekusi pengurangan stok secara atomik
  UPDATE public.barang
  SET stok = stok - p_qty,
      diperbarui_pada = now()
  WHERE id = p_barang_id
  RETURNING stok INTO v_stok_sesudah;

  -- Catat kartu riwayat mutasi stok
  INSERT INTO public.mutasi_stok (
    barang_id,
    jenis,
    jumlah,
    stok_sesudah,
    nomor_dokumen,
    dibuat_oleh,
    dibuat_pada
  )
  VALUES (
    p_barang_id,
    'pesanan',
    -p_qty,
    v_stok_sesudah,
    p_nomor_dokumen,
    p_dibuat_oleh,
    now()
  );

  RETURN v_stok_sesudah;
END;
$$;

-- 2. Memperbarui RPC Konfirmasi Pesanan dengan app.mutasi_stok eksplisit & Urutan Kunci P9
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

  -- P9 Urutan Kunci 4: seluruh baris barang terkait FOR UPDATE dengan ORDER BY id ASC (BR-06)
  PERFORM b.id
  FROM public.barang b
  WHERE b.id IN (
    SELECT ip.barang_id
    FROM public.item_pesanan_jual ip
    WHERE ip.pesanan_jual_id = p_pesanan_id
  )
  ORDER BY b.id ASC
  FOR UPDATE;

  -- Validasi keaktifan setiap barang, diskon, dan deteksi baris di bawah HPP
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok, b.aktif
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id ASC
  LOOP
    IF v_item.aktif = false THEN
      RAISE EXCEPTION 'Barang tidak aktif' USING ERRCODE = 'E0006';
    END IF;

    IF v_peran = 'penjualan' AND v_item.diskon_persen > 10 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 10%%' USING ERRCODE = 'E0009';
    END IF;

    IF v_item.diskon_persen > 25 THEN
      RAISE EXCEPTION 'Diskon harus 0%% sampai 25%%' USING ERRCODE = 'E0010';
    END IF;

    IF v_item.subtotal < (COALESCE(v_item.harga_pokok, 0) * v_item.jumlah) THEN
      v_ada_bawah_hpp := true;
    END IF;
  END LOOP;

  -- Penegasan BR-04: Staf Penjualan dilarang konfirmasi jika ada item di bawah HPP
  IF v_peran = 'penjualan' AND v_ada_bawah_hpp THEN
    RAISE EXCEPTION 'Harga di bawah batas, minta persetujuan Manajer' USING ERRCODE = 'E0011';
  END IF;

  -- Validasi kredit & tagihan lewat jatuh tempo
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

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
    ORDER BY b.id ASC
  LOOP
    IF v_item.stok < v_item.jumlah THEN
      RAISE EXCEPTION 'Stok barang tidak mencukupi untuk memenuhi pesanan'
        USING ERRCODE = 'E0014';
    END IF;
  END LOOP;

  -- Buka trigger guard mutasi stok
  PERFORM set_config('app.mutasi_stok', '1', true);

  -- Eksekusi pengurangan stok, pencatatan mutasi stok, dan HPP snapshot
  FOR v_item IN
    SELECT ip.*, b.kode, b.nama, b.harga_pokok, b.stok
    FROM public.item_pesanan_jual ip
    JOIN public.barang b ON b.id = ip.barang_id
    WHERE ip.pesanan_jual_id = p_pesanan_id
    ORDER BY b.id ASC
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
      'pakai_persetujuan',
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
    'id',     p_pesanan_id,
    'nomor',  v_pesanan.nomor,
    'status', 'dikonfirmasi',
    'total',  v_pesanan.total
  );
END;
$$;

-- 3. Database Function: public.rpc_proses_pesanan_jual
-- Fungsi pembungkus (facade) tingkat tinggi untuk memproses pesanan jual
CREATE OR REPLACE FUNCTION public.rpc_proses_pesanan_jual(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_konfirmasi_pesanan(p_pesanan_id);
END;
$$;

-- 4. Database Function: public.rpc_konfirmasi_kirim_pesanan
-- Fungsi alias untuk konfirmasi pengiriman pesanan (Gudang/Manajer)
CREATE OR REPLACE FUNCTION public.rpc_konfirmasi_kirim_pesanan(p_pesanan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_kirim_pesanan(p_pesanan_id);
END;
$$;

-- Hak Akses (Grants)
REVOKE ALL ON FUNCTION public.p_kurangi_stok_pesanan(uuid, integer, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.p_kurangi_stok_pesanan(uuid, integer, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_proses_pesanan_jual(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_proses_pesanan_jual(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_konfirmasi_kirim_pesanan(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_konfirmasi_kirim_pesanan(uuid) TO authenticated;
