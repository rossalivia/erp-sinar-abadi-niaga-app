-- ============================================================
-- Migrasi 2: Skema Inti — 9 Tabel + Sequence + Trigger
-- ============================================================

-- Dukungan tabel auth.users di luar lingkungan managed Supabase
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text UNIQUE,
  raw_user_meta_data  jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- A. SEQUENCES untuk nomor dokumen (A8)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.seq_pesanan_jual START 1 INCREMENT 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.seq_pembelian     START 1 INCREMENT 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.seq_penyesuaian   START 1 INCREMENT 1 NO CYCLE;

-- ============================================================
-- 1. profiles
-- ============================================================
CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap  text        NOT NULL,
  peran         text        NOT NULL DEFAULT 'penjualan'
                            CHECK (peran IN ('penjualan','gudang','manajer')),
  aktif         boolean     NOT NULL DEFAULT true,
  dibuat_pada   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Profil pengguna, dibuat otomatis oleh trigger dari auth.users.';

-- Trigger: handle_new_user (A9 — peran default 'penjualan')
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nama_lengkap, peran, aktif)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.email, 'Pengguna Baru'),
    'penjualan',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_users_new_user ON auth.users;
CREATE TRIGGER trg_auth_users_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_handle_new_user();

-- ============================================================
-- 2. pemasok
-- ============================================================
CREATE TABLE public.pemasok (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kode        text        NOT NULL,
  nama        text        NOT NULL,
  telepon     text,
  alamat      text,
  aktif       boolean     NOT NULL DEFAULT true,
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);

-- Normalisasi kode (B23)
CREATE OR REPLACE FUNCTION public.fn_normalize_kode_pemasok()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.kode := upper(btrim(NEW.kode));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pemasok_normalize_kode
  BEFORE INSERT OR UPDATE ON public.pemasok
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_kode_pemasok();

CREATE UNIQUE INDEX uq_pemasok_kode ON public.pemasok (kode);

-- ============================================================
-- 3. pelanggan
-- ============================================================
CREATE TABLE public.pelanggan (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  kode          text          NOT NULL,
  nama_toko     text          NOT NULL,
  telepon       text,
  alamat        text,
  batas_kredit  numeric(14,0) NOT NULL DEFAULT 0
                              CHECK (batas_kredit >= 0),
  termin_hari   integer       NOT NULL DEFAULT 0
                              CHECK (termin_hari IN (0, 7, 14, 30)),
  aktif         boolean       NOT NULL DEFAULT true,
  dibuat_oleh   uuid          NOT NULL REFERENCES public.profiles(id),
  dibuat_pada   timestamptz   NOT NULL DEFAULT now()
);

-- Normalisasi kode pelanggan (B23)
CREATE OR REPLACE FUNCTION public.fn_normalize_kode_pelanggan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.kode := upper(btrim(NEW.kode));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pelanggan_normalize_kode
  BEFORE INSERT OR UPDATE ON public.pelanggan
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_kode_pelanggan();

CREATE UNIQUE INDEX uq_pelanggan_kode ON public.pelanggan (kode);

-- ============================================================
-- 4. barang (BR-01)
-- ============================================================
CREATE TABLE public.barang (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  kode            text          NOT NULL,
  nama            text          NOT NULL,
  satuan          text          NOT NULL,
  harga_jual      numeric(14,0) NOT NULL CHECK (harga_jual > 0),
  harga_pokok     numeric(14,0),           -- RAHASIA, nullable (A5)
  stok            integer       NOT NULL DEFAULT 0 CHECK (stok >= 0),
  stok_minimum    integer       NOT NULL DEFAULT 0 CHECK (stok_minimum >= 0),
  aktif           boolean       NOT NULL DEFAULT true,
  diperbarui_pada timestamptz   NOT NULL DEFAULT now()
);

-- Normalisasi kode barang (B23)
CREATE OR REPLACE FUNCTION public.fn_normalize_kode_barang()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.kode := upper(btrim(NEW.kode));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_barang_normalize_kode
  BEFORE INSERT OR UPDATE ON public.barang
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_normalize_kode_barang();

CREATE UNIQUE INDEX uq_barang_kode ON public.barang (kode);

-- ============================================================
-- 5. pembelian (PO)
-- ============================================================
CREATE TABLE public.pembelian (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor              text          NOT NULL UNIQUE,
  pemasok_id         uuid          NOT NULL REFERENCES public.pemasok(id),
  barang_id          uuid          NOT NULL REFERENCES public.barang(id),
  jumlah_dipesan     integer       NOT NULL
                                   CHECK (jumlah_dipesan BETWEEN 1 AND 10000),
  jumlah_diterima    integer       NOT NULL DEFAULT 0,
  harga_beli_satuan  numeric(14,0),         -- RAHASIA, diisi saat disetujui
  status             text          NOT NULL DEFAULT 'diajukan'
                                   CHECK (status IN ('diajukan','disetujui','ditolak','diterima')),
  alasan_tolak       text,
  diajukan_oleh      uuid          NOT NULL REFERENCES public.profiles(id),
  diajukan_pada      timestamptz   NOT NULL DEFAULT now(),
  diputuskan_oleh    uuid          REFERENCES public.profiles(id),
  diputuskan_pada    timestamptz,
  diterima_oleh      uuid          REFERENCES public.profiles(id),
  diterima_pada      timestamptz
);

-- BR-09: jumlah_diterima <= jumlah_dipesan
ALTER TABLE public.pembelian
  ADD CONSTRAINT ck_pembelian_jumlah_diterima
  CHECK (jumlah_diterima >= 0 AND jumlah_diterima <= jumlah_dipesan);

-- ============================================================
-- 6. pesanan_jual
-- ============================================================
CREATE TABLE public.pesanan_jual (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor             text          NOT NULL UNIQUE,
  pelanggan_id      uuid          NOT NULL REFERENCES public.pelanggan(id),
  status            text          NOT NULL DEFAULT 'draf'
                                  CHECK (status IN ('draf','dikonfirmasi','dikirim','lunas','dibatalkan')),
  total             numeric(14,0) NOT NULL DEFAULT 0,
  dibuat_oleh       uuid          NOT NULL REFERENCES public.profiles(id),
  dibuat_pada       timestamptz   NOT NULL DEFAULT now(),
  dikonfirmasi_pada timestamptz,
  dikirim_pada      timestamptz,
  jatuh_tempo       date,
  dilunasi_pada     timestamptz,
  dibatalkan_pada   timestamptz,
  alasan_batal      text
);

-- ============================================================
-- 7. item_pesanan_jual
-- ============================================================
CREATE TABLE public.item_pesanan_jual (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pesanan_jual_id  uuid          NOT NULL REFERENCES public.pesanan_jual(id) ON DELETE CASCADE,
  barang_id        uuid          NOT NULL REFERENCES public.barang(id),
  jumlah           integer       NOT NULL CHECK (jumlah >= 1),
  harga_satuan     numeric(14,0) NOT NULL,
  diskon_persen    numeric(5,2)  NOT NULL DEFAULT 0
                                 CHECK (diskon_persen >= 0 AND diskon_persen <= 25),
  subtotal         numeric(14,0) NOT NULL CHECK (subtotal >= 0),
  hpp_satuan       numeric(14,0)           -- RAHASIA, di-snapshot saat konfirmasi (A7)
);

-- BR-02: barang unik per pesanan
CREATE UNIQUE INDEX uq_item_pesanan_jual_barang
  ON public.item_pesanan_jual (pesanan_jual_id, barang_id);

-- ============================================================
-- 8. mutasi_stok (BR-11, append-only)
-- ============================================================
CREATE TABLE public.mutasi_stok (
  id              bigint        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  barang_id       uuid          NOT NULL REFERENCES public.barang(id),
  jenis           text          NOT NULL
                                CHECK (jenis IN ('masuk','keluar','batal','penyesuaian')),
  jumlah          integer       NOT NULL,   -- delta bertanda (B14)
  stok_sesudah    integer       NOT NULL,
  nomor_dokumen   text,
  alasan          text,
  dibuat_oleh     uuid          NOT NULL REFERENCES public.profiles(id),
  dibuat_pada     timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. audit_log (BR-12, append-only)
-- ============================================================
CREATE TABLE public.audit_log (
  id          bigint        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pelaku_id   uuid          NOT NULL REFERENCES public.profiles(id),
  aksi        text          NOT NULL,
  nama_tabel  text          NOT NULL,
  data_id     uuid,
  nilai_lama  jsonb,
  nilai_baru  jsonb,
  dibuat_pada timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- C. INDEXES
-- ============================================================

-- FK indexes
CREATE INDEX idx_pelanggan_dibuat_oleh       ON public.pelanggan (dibuat_oleh);
CREATE INDEX idx_pembelian_pemasok_id        ON public.pembelian (pemasok_id);
CREATE INDEX idx_pembelian_barang_id         ON public.pembelian (barang_id);
CREATE INDEX idx_pembelian_diajukan_oleh     ON public.pembelian (diajukan_oleh);
CREATE INDEX idx_pesanan_jual_pelanggan_id   ON public.pesanan_jual (pelanggan_id);
CREATE INDEX idx_pesanan_jual_dibuat_oleh    ON public.pesanan_jual (dibuat_oleh);
CREATE INDEX idx_item_pesanan_jual_pesanan   ON public.item_pesanan_jual (pesanan_jual_id);
CREATE INDEX idx_item_pesanan_jual_barang    ON public.item_pesanan_jual (barang_id);
CREATE INDEX idx_mutasi_stok_barang          ON public.mutasi_stok (barang_id, dibuat_pada);
CREATE INDEX idx_audit_log_pelaku            ON public.audit_log (pelaku_id);

-- Status + pelanggan (untuk hitung piutang cepat)
CREATE INDEX idx_pesanan_jual_status_pelanggan
  ON public.pesanan_jual (pelanggan_id, status);

-- Jatuh tempo (untuk cek lewat tempo)
CREATE INDEX idx_pesanan_jual_jatuh_tempo
  ON public.pesanan_jual (jatuh_tempo)
  WHERE status IN ('dikirim');

-- Status pembelian
CREATE INDEX idx_pembelian_status ON public.pembelian (status);
