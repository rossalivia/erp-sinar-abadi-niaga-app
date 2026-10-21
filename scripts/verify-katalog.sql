-- ============================================================
-- VERIFIKASI KEAMANAN KATALOG DATABASE POSTGRESQL (Tahap 9)
-- ============================================================

-- 1. Periksa status RLS di seluruh tabel public
SELECT 
  c.relname AS nama_tabel,
  c.relrowsecurity AS rls_aktif,
  c.relforcerowsecurity AS rls_dipaksa
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 2. Periksa hak akses peran 'anon' pada tabel publik
SELECT 
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;

-- 3. Periksa hak akses kolom rahasia untuk 'authenticated'
-- (harga_pokok pada barang, harga_beli_satuan pada pembelian, hpp_satuan pada item_pesanan_jual)
SELECT 
  table_name,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND column_name IN ('harga_pokok', 'harga_beli_satuan', 'hpp_satuan')
ORDER BY table_name, column_name;
