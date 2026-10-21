-- ============================================================
-- Migrasi: Modul Limit Kredit Dinamis & Blokir Otomatis
-- File: 20261021140000_kredit_overdue.sql
-- Sesuai: Spesifikasi D1 s.d. D9, BR-13, BR-14
-- ============================================================

-- 1. FUNGSI SUMBER KEBENARAN TUNGGAL KALKULASI KREDIT & OVERDUE
CREATE OR REPLACE FUNCTION public.fn_hitung_kredit_pelanggan(p_pelanggan_id uuid)
RETURNS TABLE (
  batas_kredit numeric(14,0),
  piutang_terkonfirmasi numeric(14,0),
  piutang_terkirim numeric(14,0),
  piutang_berjalan numeric(14,0),
  sisa_kredit numeric(14,0),
  jumlah_faktur_overdue bigint,
  hari_terlambat_terlama integer,
  punya_overdue boolean,
  boleh_transaksi boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  WITH agregat_pesanan AS (
    SELECT
      COALESCE(SUM(CASE WHEN pj.status = 'dikonfirmasi' THEN pj.total ELSE 0 END), 0) AS terkonfirmasi,
      COALESCE(SUM(CASE WHEN pj.status = 'dikirim' THEN pj.total ELSE 0 END), 0) AS terkirim,
      COUNT(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_today THEN 1 END) AS count_overdue,
      COALESCE(MAX(CASE WHEN pj.status = 'dikirim' AND pj.jatuh_tempo < v_today THEN (v_today - pj.jatuh_tempo) ELSE 0 END), 0) AS max_hari
    FROM public.pesanan_jual pj
    WHERE pj.pelanggan_id = p_pelanggan_id
  )
  SELECT
    p.batas_kredit,
    ap.terkonfirmasi::numeric(14,0) AS piutang_terkonfirmasi,
    ap.terkirim::numeric(14,0) AS piutang_terkirim,
    (ap.terkonfirmasi + ap.terkirim)::numeric(14,0) AS piutang_berjalan,
    (p.batas_kredit - (ap.terkonfirmasi + ap.terkirim))::numeric(14,0) AS sisa_kredit,
    ap.count_overdue AS jumlah_faktur_overdue,
    ap.max_hari::integer AS hari_terlambat_terlama,
    (ap.count_overdue > 0) AS punya_overdue,
    (ap.count_overdue = 0 AND (p.batas_kredit - (ap.terkonfirmasi + ap.terkirim)) >= 0) AS boleh_transaksi
  FROM public.pelanggan p
  CROSS JOIN agregat_pesanan ap
  WHERE p.id = p_pelanggan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_hitung_kredit_pelanggan(uuid) TO authenticated;

-- 2. VIEW KREDIT PELANGGAN (v_pelanggan_kredit)
CREATE OR REPLACE VIEW public.v_pelanggan_kredit AS
SELECT
  p.id,
  p.kode,
  p.nama_toko,
  p.telepon,
  p.alamat,
  p.termin_hari,
  p.aktif,
  fk.batas_kredit,
  fk.piutang_terkonfirmasi,
  fk.piutang_terkirim,
  fk.piutang_berjalan,
  fk.sisa_kredit,
  fk.jumlah_faktur_overdue,
  fk.hari_terlambat_terlama,
  fk.punya_overdue,
  fk.boleh_transaksi
FROM public.pelanggan p
CROSS JOIN LATERAL public.fn_hitung_kredit_pelanggan(p.id) fk;

-- 3. PERBARUI VIEW v_pelanggan_piutang (MEMPERTAHANKAN URUTAN KOLOM EKSIS + MENAMBAH KOLOM BARU)
CREATE OR REPLACE VIEW public.v_pelanggan_piutang AS
SELECT
  p.id,
  p.kode,
  p.nama_toko,
  p.telepon,
  p.alamat,
  p.batas_kredit,
  p.termin_hari,
  p.aktif,
  fk.piutang_berjalan,
  fk.punya_overdue AS punya_pesanan_lewat_tempo,
  fk.punya_overdue AS ada_lewat_jatuh_tempo,
  fk.piutang_terkonfirmasi,
  fk.piutang_terkirim,
  fk.sisa_kredit,
  fk.jumlah_faktur_overdue,
  fk.hari_terlambat_terlama,
  fk.punya_overdue,
  fk.boleh_transaksi
FROM public.pelanggan p
CROSS JOIN LATERAL public.fn_hitung_kredit_pelanggan(p.id) fk;

DO $$
BEGIN
  IF current_setting('server_version_num')::integer >= 150000 THEN
    ALTER VIEW public.v_pelanggan_kredit SET (security_invoker = true);
    ALTER VIEW public.v_pelanggan_piutang SET (security_invoker = true);
  END IF;
END $$;

GRANT SELECT ON public.v_pelanggan_kredit TO authenticated;
GRANT SELECT ON public.v_pelanggan_piutang TO authenticated;

-- 4. RPC BACA STATUS KREDIT UNTUK FORM EDITOR PESANAN
CREATE OR REPLACE FUNCTION public.rpc_get_kredit_pelanggan(p_pelanggan_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(fk.*)
  FROM public.fn_hitung_kredit_pelanggan(p_pelanggan_id) fk;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_kredit_pelanggan(uuid) TO authenticated;

-- 5. RPC BACA DAFTAR FAKTUR OVERDUE PELANGGAN (UNTUK HALAMAN DETAIL PELANGGAN)
CREATE OR REPLACE FUNCTION public.rpc_get_faktur_overdue_pelanggan(p_pelanggan_id uuid)
RETURNS TABLE (
  id uuid,
  nomor text,
  dikirim_pada timestamptz,
  jatuh_tempo date,
  total numeric(14,0),
  hari_terlambat integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  IF public.fn_peran() NOT IN ('penjualan', 'manajer', 'gudang') THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  v_today := (now() AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  SELECT
    pj.id,
    pj.nomor,
    pj.dikirim_pada,
    pj.jatuh_tempo,
    pj.total,
    (v_today - pj.jatuh_tempo)::integer AS hari_terlambat
  FROM public.pesanan_jual pj
  WHERE pj.pelanggan_id = p_pelanggan_id
    AND pj.status = 'dikirim'
    AND pj.jatuh_tempo < v_today
  ORDER BY pj.jatuh_tempo ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_faktur_overdue_pelanggan(uuid) TO authenticated;

-- 6. PEMBARUAN rpc_konfirmasi_pesanan (DENGAN PENGECEKAN KREDIT DINAMIS & PRIORITAS OVERDUE D4)
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

  -- 3f. BR-13 & BR-14: Hitung kredit dan overdue via fungsi tunggal (D1 s.d. D9)
  SELECT * INTO v_kredit
  FROM public.fn_hitung_kredit_pelanggan(v_pesanan.pelanggan_id);

  -- D4: Skenario Overdue diperiksa terlebih dahulu (E0007)
  IF v_kredit.punya_overdue THEN
    RAISE EXCEPTION 'E0007: Pelanggan memiliki faktur lewat jatuh tempo, transaksi diblokir'
      USING ERRCODE = 'E0013';
  END IF;

  -- D4: Skenario Plafon Kredit diperiksa berikutnya (E0006)
  IF (v_kredit.piutang_berjalan + v_pesanan.total) > v_kredit.batas_kredit THEN
    RAISE EXCEPTION 'E0006: Batas kredit pelanggan terlampaui'
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
