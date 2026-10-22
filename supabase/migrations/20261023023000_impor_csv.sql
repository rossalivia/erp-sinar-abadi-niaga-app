-- ============================================================
-- Migrasi: Fitur Impor CSV Data Master (Barang dan Pelanggan)
-- Rujukan: docs/fitur-impor-csv.md
-- ============================================================

-- 1. Sequence Nomor Dokumen Impor (IMP-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS public.seq_impor_data START 1 INCREMENT 1 NO CYCLE;

-- 2. Tabel impor_data
CREATE TABLE IF NOT EXISTS public.impor_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor text NOT NULL UNIQUE,
  jenis text NOT NULL CHECK (jenis IN ('barang', 'pelanggan')),
  nama_berkas text NOT NULL,
  jumlah_baris integer NOT NULL CHECK (jumlah_baris >= 1 AND jumlah_baris <= 1000),
  jumlah_dibuat integer NOT NULL CHECK (jumlah_dibuat >= 0 AND jumlah_dibuat <= jumlah_baris),
  status text NOT NULL CHECK (status IN ('berhasil', 'gagal')),
  ringkasan jsonb NOT NULL DEFAULT '{}'::jsonb,
  dibuat_oleh uuid NOT NULL REFERENCES public.profiles(id),
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

-- Indeks performa
CREATE INDEX IF NOT EXISTS idx_impor_data_dibuat_pada ON public.impor_data (dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_impor_data_jenis ON public.impor_data (jenis);

-- 3. Row Level Security & Hak Akses
REVOKE ALL ON public.impor_data FROM anon, public;
ALTER TABLE public.impor_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impor_data_select_manajer ON public.impor_data;
CREATE POLICY impor_data_select_manajer ON public.impor_data
  FOR SELECT TO authenticated
  USING (public.fn_is_manajer() = true);

DROP POLICY IF EXISTS impor_data_modify_block ON public.impor_data;
CREATE POLICY impor_data_modify_block ON public.impor_data
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

GRANT SELECT ON public.impor_data TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.seq_impor_data TO authenticated;

-- ============================================================
-- 4. RPC rpc_impor_barang
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_impor_barang(
  p_nama_berkas text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nomor_impor      text;
  v_total_baris      integer;
  v_stok_count       integer := 0;
  v_impor_id         uuid;
  v_item             jsonb;
  v_barang_id        uuid;
  v_kode             text;
  v_nama             text;
  v_satuan           text;
  v_harga_jual       numeric(14,0);
  v_harga_pokok      numeric(14,0);
  v_stok_min         integer;
  v_stok_awal        integer;
  v_aktif            boolean;
  v_dup_kode         text;
BEGIN
  -- 1. Otorisasi Peran: Wajib Manajer
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- 2. Validasi Tipe & Kuantitas Input
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Data impor tidak valid' USING ERRCODE = 'E0062';
  END IF;

  v_total_baris := jsonb_array_length(p_items);
  IF v_total_baris = 0 THEN
    RAISE EXCEPTION 'Berkas CSV kosong, tidak ada data untuk diimpor' USING ERRCODE = 'E0054';
  END IF;

  IF v_total_baris > 1000 THEN
    RAISE EXCEPTION 'Berkas CSV melebihi batas maksimal 1.000 baris data' USING ERRCODE = 'E0055';
  END IF;

  -- 3. Deteksi Duplikasi Kode di dalam Batch JSONB
  WITH parsed AS (
    SELECT upper(btrim(COALESCE(elem->>'kode', ''))) AS kode
    FROM jsonb_array_elements(p_items) elem
  )
  SELECT kode INTO v_dup_kode
  FROM parsed
  GROUP BY kode
  HAVING count(*) > 1
  LIMIT 1;

  IF v_dup_kode IS NOT NULL AND v_dup_kode <> '' THEN
    RAISE EXCEPTION 'Kode barang atau pelanggan duplikat di dalam berkas CSV' USING ERRCODE = 'E0059';
  END IF;

  -- 4. Deteksi Duplikasi Kode terhadap Master Database
  WITH parsed AS (
    SELECT upper(btrim(COALESCE(elem->>'kode', ''))) AS kode
    FROM jsonb_array_elements(p_items) elem
  )
  SELECT b.kode INTO v_dup_kode
  FROM public.barang b
  JOIN parsed p ON b.kode = p.kode
  LIMIT 1;

  IF v_dup_kode IS NOT NULL THEN
    RAISE EXCEPTION 'Kode barang atau pelanggan sudah terdaftar di sistem' USING ERRCODE = 'E0057';
  END IF;

  -- 5. Generate Nomor Dokumen Impor
  v_nomor_impor := format(
    'IMP-%s-%s',
    to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
    lpad(nextval('public.seq_impor_data')::text, 4, '0')
  );

  -- 6. Loop Eksekusi Atomik Data Barang
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_kode := upper(btrim(COALESCE(v_item->>'kode', '')));
    v_nama := btrim(COALESCE(v_item->>'nama', ''));
    v_satuan := btrim(COALESCE(v_item->>'satuan', ''));
    
    -- Validasi kolom wajib
    IF v_kode = '' OR v_nama = '' OR v_satuan = '' THEN
      RAISE EXCEPTION 'Data impor tidak valid' USING ERRCODE = 'E0062';
    END IF;

    -- Validasi angka & batasan
    IF (v_item->>'harga_jual') IS NULL OR (v_item->>'harga_jual')::numeric <= 0 THEN
      RAISE EXCEPTION 'Harga jual harus lebih dari 0' USING ERRCODE = 'E0028';
    END IF;
    v_harga_jual := (v_item->>'harga_jual')::numeric;

    IF (v_item->>'harga_pokok') IS NOT NULL AND (v_item->>'harga_pokok') <> '' THEN
      IF (v_item->>'harga_pokok')::numeric < 0 THEN
        RAISE EXCEPTION 'Harga pokok harus >= 0' USING ERRCODE = 'E0028';
      END IF;
      v_harga_pokok := (v_item->>'harga_pokok')::numeric;
    ELSE
      v_harga_pokok := NULL;
    END IF;

    v_stok_min := COALESCE((v_item->>'stok_minimum')::integer, 0);
    IF v_stok_min < 0 THEN
      RAISE EXCEPTION 'Stok minimum harus bilangan bulat >= 0' USING ERRCODE = 'E0029';
    END IF;

    v_stok_awal := COALESCE((v_item->>'stok_awal')::integer, 0);
    IF v_stok_awal < 0 THEN
      RAISE EXCEPTION 'Stok awal harus bilangan bulat >= 0' USING ERRCODE = 'E0029';
    END IF;

    v_aktif := COALESCE((v_item->>'aktif')::boolean, true);

    -- Insert ke public.barang dengan stok = 0
    INSERT INTO public.barang (
      kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif, diperbarui_pada
    )
    VALUES (
      v_kode, v_nama, v_satuan, v_harga_jual, v_harga_pokok, 0, v_stok_min, v_aktif, now()
    )
    RETURNING id INTO v_barang_id;

    -- Jika stok awal > 0, mutasi stok resmi
    IF v_stok_awal > 0 THEN
      PERFORM set_config('app.mutasi_stok', '1', true);

      UPDATE public.barang
      SET stok = v_stok_awal,
          diperbarui_pada = now()
      WHERE id = v_barang_id;

      INSERT INTO public.mutasi_stok (
        barang_id, jenis, jumlah, stok_sesudah, nomor_dokumen, alasan, dibuat_oleh, dibuat_pada
      )
      VALUES (
        v_barang_id,
        'penyesuaian',
        v_stok_awal,
        v_stok_awal,
        v_nomor_impor,
        'Impor stok awal ' || v_nomor_impor,
        auth.uid(),
        now()
      );

      v_stok_count := v_stok_count + 1;
    END IF;
  END LOOP;

  -- 7. Catat Riwayat Impor
  INSERT INTO public.impor_data (
    nomor, jenis, nama_berkas, jumlah_baris, jumlah_dibuat, status, ringkasan, dibuat_oleh, dibuat_pada
  )
  VALUES (
    v_nomor_impor,
    'barang',
    btrim(COALESCE(p_nama_berkas, 'impor_barang.csv')),
    v_total_baris,
    v_total_baris,
    'berhasil',
    jsonb_build_object('total_baris', v_total_baris, 'stok_awal_count', v_stok_count),
    auth.uid(),
    now()
  )
  RETURNING id INTO v_impor_id;

  -- 8. Catat Ringkasan Audit Log (Zero-Leakage HPP)
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada
  )
  VALUES (
    auth.uid(),
    'impor_barang',
    'impor_data',
    v_impor_id,
    '{}'::jsonb,
    jsonb_build_object(
      'nomor', v_nomor_impor,
      'jumlah_baris', v_total_baris,
      'stok_awal_count', v_stok_count
    ),
    now()
  );

  RETURN jsonb_build_object(
    'sukses', true,
    'nomor', v_nomor_impor,
    'jumlah_dibuat', v_total_baris,
    'impor_id', v_impor_id
  );
END;
$$;

-- ============================================================
-- 5. RPC rpc_impor_pelanggan
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_impor_pelanggan(
  p_nama_berkas text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nomor_impor      text;
  v_total_baris      integer;
  v_impor_id         uuid;
  v_item             jsonb;
  v_pelanggan_id     uuid;
  v_kode             text;
  v_nama_toko        text;
  v_telepon          text;
  v_alamat           text;
  v_termin           integer;
  v_batas_kredit     numeric(14,0);
  v_aktif            boolean;
  v_dup_kode         text;
BEGIN
  -- 1. Otorisasi Peran: Wajib Manajer
  IF NOT public.fn_is_manajer() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE = 'E0001';
  END IF;

  -- 2. Validasi Tipe & Kuantitas Input
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Data impor tidak valid' USING ERRCODE = 'E0062';
  END IF;

  v_total_baris := jsonb_array_length(p_items);
  IF v_total_baris = 0 THEN
    RAISE EXCEPTION 'Berkas CSV kosong, tidak ada data untuk diimpor' USING ERRCODE = 'E0054';
  END IF;

  IF v_total_baris > 1000 THEN
    RAISE EXCEPTION 'Berkas CSV melebihi batas maksimal 1.000 baris data' USING ERRCODE = 'E0055';
  END IF;

  -- 3. Deteksi Duplikasi Kode di dalam Batch JSONB
  WITH parsed AS (
    SELECT upper(btrim(COALESCE(elem->>'kode', ''))) AS kode
    FROM jsonb_array_elements(p_items) elem
  )
  SELECT kode INTO v_dup_kode
  FROM parsed
  GROUP BY kode
  HAVING count(*) > 1
  LIMIT 1;

  IF v_dup_kode IS NOT NULL AND v_dup_kode <> '' THEN
    RAISE EXCEPTION 'Kode barang atau pelanggan duplikat di dalam berkas CSV' USING ERRCODE = 'E0059';
  END IF;

  -- 4. Deteksi Duplikasi Kode terhadap Master Database
  WITH parsed AS (
    SELECT upper(btrim(COALESCE(elem->>'kode', ''))) AS kode
    FROM jsonb_array_elements(p_items) elem
  )
  SELECT p.kode INTO v_dup_kode
  FROM public.pelanggan p
  JOIN parsed pr ON p.kode = pr.kode
  LIMIT 1;

  IF v_dup_kode IS NOT NULL THEN
    RAISE EXCEPTION 'Kode barang atau pelanggan sudah terdaftar di sistem' USING ERRCODE = 'E0057';
  END IF;

  -- 5. Generate Nomor Dokumen Impor
  v_nomor_impor := format(
    'IMP-%s-%s',
    to_char((now() AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY'),
    lpad(nextval('public.seq_impor_data')::text, 4, '0')
  );

  -- 6. Loop Eksekusi Atomik Data Pelanggan
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_kode := upper(btrim(COALESCE(v_item->>'kode', '')));
    v_nama_toko := btrim(COALESCE(v_item->>'nama_toko', ''));
    v_telepon := NULLIF(btrim(COALESCE(v_item->>'telepon', '')), '');
    v_alamat := NULLIF(btrim(COALESCE(v_item->>'alamat', '')), '');

    IF v_kode = '' OR v_nama_toko = '' THEN
      RAISE EXCEPTION 'Data impor tidak valid' USING ERRCODE = 'E0062';
    END IF;

    v_termin := COALESCE((v_item->>'termin_hari')::integer, 0);
    IF v_termin NOT IN (0, 7, 14, 30) THEN
      RAISE EXCEPTION 'Termin hari harus 0, 7, 14, atau 30' USING ERRCODE = 'E0024';
    END IF;

    v_batas_kredit := COALESCE((v_item->>'batas_kredit')::numeric, 0);
    IF v_batas_kredit < 0 THEN
      RAISE EXCEPTION 'Batas kredit harus >= 0' USING ERRCODE = 'E0024';
    END IF;

    v_aktif := COALESCE((v_item->>'aktif')::boolean, true);

    INSERT INTO public.pelanggan (
      kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh, dibuat_pada
    )
    VALUES (
      v_kode, v_nama_toko, v_telepon, v_alamat, v_batas_kredit, v_termin, v_aktif, auth.uid(), now()
    )
    RETURNING id INTO v_pelanggan_id;
  END LOOP;

  -- 7. Catat Riwayat Impor
  INSERT INTO public.impor_data (
    nomor, jenis, nama_berkas, jumlah_baris, jumlah_dibuat, status, ringkasan, dibuat_oleh, dibuat_pada
  )
  VALUES (
    v_nomor_impor,
    'pelanggan',
    btrim(COALESCE(p_nama_berkas, 'impor_pelanggan.csv')),
    v_total_baris,
    v_total_baris,
    'berhasil',
    jsonb_build_object('total_baris', v_total_baris),
    auth.uid(),
    now()
  )
  RETURNING id INTO v_impor_id;

  -- 8. Catat Ringkasan Audit Log
  INSERT INTO public.audit_log (
    pelaku_id, aksi, nama_tabel, data_id, nilai_lama, nilai_baru, dibuat_pada
  )
  VALUES (
    auth.uid(),
    'impor_pelanggan',
    'impor_data',
    v_impor_id,
    '{}'::jsonb,
    jsonb_build_object(
      'nomor', v_nomor_impor,
      'jumlah_baris', v_total_baris
    ),
    now()
  );

  RETURN jsonb_build_object(
    'sukses', true,
    'nomor', v_nomor_impor,
    'jumlah_dibuat', v_total_baris,
    'impor_id', v_impor_id
  );
END;
$$;

-- 6. Grant Hak Eksekusi ke authenticated
GRANT EXECUTE ON FUNCTION public.rpc_impor_barang(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_impor_pelanggan(text, jsonb) TO authenticated;
