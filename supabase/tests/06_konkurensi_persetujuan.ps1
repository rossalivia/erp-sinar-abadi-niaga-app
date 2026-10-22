# ============================================================
# 06_konkurensi_persetujuan.ps1: Uji Konkurensi Persetujuan Harga (TC-67)
# ============================================================
# Skenario: Edit Draf Paralel dengan Konfirmasi Pesanan
# Target:
# 1. Tidak pernah deadlock.
# 2. Tidak pernah lolos dengan persetujuan basi (snapshot_hash tidak cocok atau status kedaluwarsa).
# 3. Hasil konsisten: Tepat satu berhasil sesuai urutan lock, tidak ada data korup.
# ============================================================

$ErrorActionPreference = "Stop"

$PGHOST = if ($env:PGHOST) { $env:PGHOST } else { "127.0.0.1" }
$PGPORT = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$PGUSER = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
$PGDATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "erp_sinar_abadi" }
$env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "admin" }

$PSQL_CMD = "C:\Program Files\PostgreSQL\13\bin\psql.exe"
if (-not (Test-Path $PSQL_CMD)) {
    $found = Get-Command psql -ErrorAction SilentlyContinue
    if ($found) { $PSQL_CMD = $found.Source } else { throw "psql binary tidak ditemukan!" }
}

function Run-Psql {
    param([string]$Sql)
    & $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -q -X -t -A -c $Sql
}

Write-Host "============================================================"
Write-Host "MEMULAI PENGUJIAN KONKURENSI PERSETUJUAN HARGA (TC-67)"
Write-Host "Koneksi: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
Write-Host "============================================================"

$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$outA = Join-Path $tmpDir "out_a.txt"
$errA = Join-Path $tmpDir "err_a.txt"
$outB = Join-Path $tmpDir "out_b.txt"
$errB = Join-Path $tmpDir "err_b.txt"
$fileA = Join-Path $tmpDir "job_a.sql"
$fileB = Join-Path $tmpDir "job_b.sql"

try {
    Write-Host "`n------------------------------------------------------------"
    Write-Host "TC-67: Simpan Draf vs Konfirmasi Paralel (10 Iterasi)"
    Write-Host "------------------------------------------------------------"

    # Setup Master Data Uji
    $initMasterSql = 'CREATE TABLE IF NOT EXISTS public._temp_tc67 (so_id uuid); GRANT ALL ON public._temp_tc67 TO authenticated; INSERT INTO public.pelanggan (id, kode, nama_toko, telepon, alamat, batas_kredit, termin_hari, aktif, dibuat_oleh) VALUES (''b6666666-0000-0000-0000-000000000001'', ''PLG-KONK-SETUJU'', ''Toko Konkurensi Setuju'', ''0812999'', ''Jakarta'', 10000000, 30, true, ''33333333-3333-3333-3333-333333333333'') ON CONFLICT (id) DO UPDATE SET batas_kredit = 10000000, aktif = true; INSERT INTO public.barang (id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif) VALUES (''c6666666-0000-0000-0000-000000000002'', ''BRG-KONK-LOW'', ''Barang Konk Bawah HPP'', ''sak'', 40000, 50000, 1000, 5, true) ON CONFLICT (id) DO UPDATE SET harga_jual = 40000, harga_pokok = 50000, stok = 1000, aktif = true;'
    Run-Psql $initMasterSql | Out-Null

    for ($i = 1; $i -le 10; $i++) {
        # Setup: Buat draf pesanan dengan barang bawah HPP, ajukan persetujuan, lalu manajer setujui
        $setupSql = 'DO $setup$ DECLARE v_p1_id uuid := ''11111111-1111-1111-1111-111111111111''; v_m_id uuid := ''33333333-3333-3333-3333-333333333333''; v_plg_id uuid := ''b6666666-0000-0000-0000-000000000001''; v_brg_id uuid := ''c6666666-0000-0000-0000-000000000002''; v_so_id uuid; v_persetujuan_id uuid; BEGIN PERFORM set_config(''request.jwt.claim.sub'', v_p1_id::text, true); PERFORM set_config(''role'', ''authenticated'', true); SELECT (public.rpc_simpan_draf_pesanan(v_plg_id, jsonb_build_array(jsonb_build_object(''barang_id'', v_brg_id, ''jumlah'', 1, ''diskon_persen'', 0)))->>''id'')::uuid INTO v_so_id; SELECT (public.rpc_ajukan_persetujuan_harga(v_so_id)->>''id'')::uuid INTO v_persetujuan_id; PERFORM set_config(''request.jwt.claim.sub'', v_m_id::text, true); PERFORM set_config(''role'', ''authenticated'', true); PERFORM public.rpc_putuskan_persetujuan_harga(v_persetujuan_id, true, ''Setuju konkurensi test'', NULL); TRUNCATE public._temp_tc67; INSERT INTO public._temp_tc67 VALUES (v_so_id); END $setup$;'

        Run-Psql $setupSql
        $soId = (Run-Psql "SELECT so_id FROM public._temp_tc67 LIMIT 1;").Trim()

        if (-not $soId) {
            throw "Gagal inisialisasi draf untuk iterasi $i"
        }

        # Sesi A: Edit draf (ubah jumlah jadi 5)
        ("BEGIN; SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; SET LOCAL role = 'authenticated'; SELECT public.rpc_simpan_draf_pesanan('b6666666-0000-0000-0000-000000000001', jsonb_build_array(jsonb_build_object('barang_id', 'c6666666-0000-0000-0000-000000000002', 'jumlah', 5, 'diskon_persen', 0)), '" + $soId + "'::uuid); COMMIT;") | Set-Content $fileA -Encoding UTF8

        # Sesi B: Konfirmasi pesanan
        ("BEGIN; SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'; SET LOCAL role = 'authenticated'; SELECT public.rpc_konfirmasi_pesanan('" + $soId + "'::uuid); COMMIT;") | Set-Content $fileB -Encoding UTF8

        if (Test-Path $outA) { Remove-Item $outA -Force }
        if (Test-Path $errA) { Remove-Item $errA -Force }
        if (Test-Path $outB) { Remove-Item $outB -Force }
        if (Test-Path $errB) { Remove-Item $errB -Force }

        $procA = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-f", $fileA -NoNewWindow -PassThru -RedirectStandardOutput $outA -RedirectStandardError $errA
        $procB = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h", $PGHOST, "-p", $PGPORT, "-U", $PGUSER, "-d", $PGDATABASE, "-f", $fileB -NoNewWindow -PassThru -RedirectStandardOutput $outB -RedirectStandardError $errB

        $procA.WaitForExit()
        $procB.WaitForExit()

        $codeA = $procA.ExitCode
        $codeB = $procB.ExitCode

        $errContentA = if (Test-Path $errA) { Get-Content $errA -Raw } else { "" }
        $errContentB = if (Test-Path $errB) { Get-Content $errB -Raw } else { "" }

        # Cek apakah terjadi deadlock
        if ($errContentA -match "deadlock detected" -or $errContentB -match "deadlock detected") {
            throw "TC-67 GAGAL: Terdeteksi DEADLOCK pada iterasi $i!"
        }

        # Cek status akhir
        $statusPesanan = (Run-Psql "SELECT status FROM public.pesanan_jual WHERE id = '$($soId)';").Trim()
        $statusPersetujuan = (Run-Psql "SELECT status FROM public.persetujuan_harga WHERE pesanan_jual_id = '$($soId)' ORDER BY diajukan_pada DESC LIMIT 1;").Trim()

        # Kasus 1: Sesi B konfirmasi duluan -> Pesanan dikonfirmasi, persetujuan terpakai. Sesi A gagal (E0008).
        # Kasus 2: Sesi A simpan draf duluan -> Persetujuan kedaluwarsa. Sesi B gagal (E0011).
        $validCase = ($statusPesanan -eq "dikonfirmasi" -and $statusPersetujuan -eq "terpakai") -or
                     ($statusPesanan -eq "draf" -and $statusPersetujuan -eq "kedaluwarsa")

        if ($validCase) {
            Write-Host "  [Iterasi $($i.ToString('D2'))/10] PASS (Status SO: $statusPesanan, Status Persetujuan: $statusPersetujuan)"
        } else {
            throw "TC-67 GAGAL: Inkonsistensi terdeteksi pada iterasi $i! SO: $statusPesanan, Persetujuan: $statusPersetujuan, CodeA: $codeA, CodeB: $codeB"
        }
    }

    Write-Host "`n[OK] TC-67 LOLOS SELURUH 10 ITERASI: Bebas deadlock, serializable secara konsisten."
}
finally {
    Run-Psql "DROP TABLE IF EXISTS public._temp_tc67;"
    if (Test-Path $tmpDir) { Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
}
