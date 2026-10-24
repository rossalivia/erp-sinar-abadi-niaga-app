# ==============================================================================
# 15_konkurensi_pembatalan.ps1: Uji Konkurensi Penerimaan vs Pembatalan PO (TC-228)
# ==============================================================================
# Skenario: Penerimaan Barang (Gudang) vs Pembatalan PO (Manajer) secara Paralel
# Target:
# 1. Tidak pernah deadlock.
# 2. Tepat satu pemenang:
#    - Bila Terima menang: status = 'diterima', stok bertambah, Batal ditolak.
#    - Bila Batal menang: status = 'dibatalkan', stok tidak bertambah, Terima ditolak.
# 3. 10 iterasi pengujian konkurensi multi-proses.
# ==============================================================================

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
Write-Host "MEMULAI PENGUJIAN KONKURENSI PEMBATALAN PEMBELIAN (TC-228)"
Write-Host "Koneksi: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
Write-Host "============================================================"

$tmpDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$outA = Join-Path $tmpDir "out_a.txt"
$errA = Join-Path $tmpDir "err_a.txt"
$outB = Join-Path $tmpDir "out_b.txt"
$errB = Join-Path $tmpDir "err_b.txt"
$fileA = Join-Path $tmpDir "job_terima.sql"
$fileB = Join-Path $tmpDir "job_batal.sql"

try {
    # 1. Setup Master Uji
    $initMasterSql = @"
CREATE TABLE IF NOT EXISTS public._temp_tc228 (po_id uuid, barang_id uuid, stok_awal int);
GRANT ALL ON public._temp_tc228 TO authenticated, PUBLIC;
INSERT INTO public.pemasok (id, kode, nama, telepon, alamat, aktif)
VALUES ('a7777777-0000-0000-0000-000000000001', 'PMS-KONK-PO', 'Pemasok Konkurensi', '0812888', 'Jakarta', true)
ON CONFLICT (id) DO UPDATE SET aktif = true;

INSERT INTO public.barang (id, kode, nama, satuan, harga_jual, harga_pokok, stok, stok_minimum, aktif)
VALUES ('b7777777-0000-0000-0000-000000000002', 'BRG-KONK-PO', 'Barang Konkurensi PO', 'pcs', 25000, 20000, 100, 10, true)
ON CONFLICT (id) DO UPDATE SET stok = 100, harga_pokok = 20000, aktif = true;
"@
    Run-Psql $initMasterSql | Out-Null

    $totalIterasi = 10
    $passCount = 0

    for ($i = 1; $i -le $totalIterasi; $i++) {
        # Setup: Buat PO baru status 'disetujui'
        $setupSql = @"
DO `$setup`$
DECLARE
  v_gudang_id  uuid := '22222222-2222-2222-2222-222222222222';
  v_manajer_id uuid := '33333333-3333-3333-3333-333333333333';
  v_pms_id     uuid := 'a7777777-0000-0000-0000-000000000001';
  v_brg_id     uuid := 'b7777777-0000-0000-0000-000000000002';
  v_po_id      uuid;
  v_res        jsonb;
BEGIN
  -- Reset stok ke 100
  UPDATE public.barang SET stok = 100 WHERE id = v_brg_id;

  -- Ajukan oleh Gudang
  PERFORM set_config('request.jwt.claim.sub', v_gudang_id::text, true);
  v_res := public.rpc_ajukan_pembelian(v_pms_id, v_brg_id, 10);
  v_po_id := (v_res->>'id')::uuid;

  -- Setujui oleh Manajer
  PERFORM set_config('request.jwt.claim.sub', v_manajer_id::text, true);
  PERFORM public.rpc_setujui_pembelian(v_po_id, 18000);

  TRUNCATE public._temp_tc228;
  INSERT INTO public._temp_tc228 VALUES (v_po_id, v_brg_id, 100);
END `$setup`$;
"@
        Run-Psql $setupSql | Out-Null
        $poId = (Run-Psql "SELECT po_id FROM public._temp_tc228 LIMIT 1;").Trim()

        # Job A: Gudang menerima barang
        $sqlA = @"
\set ON_ERROR_STOP off
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
SELECT public.rpc_terima_pembelian('$poId'::uuid, 10);
COMMIT;
"@
        Set-Content -Path $fileA -Value $sqlA -Encoding UTF8

        # Job B: Manajer membatalkan PO
        $sqlB = @"
\set ON_ERROR_STOP off
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
SELECT public.rpc_batalkan_pembelian('$poId'::uuid, 'Batal via uji konkurensi');
COMMIT;
"@
        Set-Content -Path $fileB -Value $sqlB -Encoding UTF8

        # Jalankan kedua proses paralel
        $pA = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -q -X -f `"$fileA`"" -NoNewWindow -PassThru -RedirectStandardOutput $outA -RedirectStandardError $errA
        $pB = Start-Process -FilePath $PSQL_CMD -ArgumentList "-h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -q -X -f `"$fileB`"" -NoNewWindow -PassThru -RedirectStandardOutput $outB -RedirectStandardError $errB

        $pA.WaitForExit()
        $pB.WaitForExit()

        $txtOutA = if (Test-Path $outA) { Get-Content $outA -Raw } else { "" }
        $txtErrA = if (Test-Path $errA) { Get-Content $errA -Raw } else { "" }
        $txtOutB = if (Test-Path $outB) { Get-Content $outB -Raw } else { "" }
        $txtErrB = if (Test-Path $errB) { Get-Content $errB -Raw } else { "" }

        $allA = "$txtOutA $txtErrA"
        $allB = "$txtOutB $txtErrB"

        $isDeadlock = ($allA -match "deadlock detected" -or $allB -match "deadlock detected")
        if ($isDeadlock) {
            Write-Host "Iterasi #$i : GAGAL (Terdeteksi DEADLOCK!)" -ForegroundColor Red
            continue
        }

        # Verifikasi status di database
        $statusDb = (Run-Psql "SELECT status FROM public.pembelian WHERE id = '$poId';").Trim()
        $stokDb = (Run-Psql "SELECT stok FROM public.barang WHERE id = 'b7777777-0000-0000-0000-000000000002';").Trim()

        $isTerimaMenang = ($statusDb -eq "diterima" -and $stokDb -eq "110" -and ($allB -match "E0076|E0077|tidak dapat dibatalkan"))
        $isBatalMenang = ($statusDb -eq "dibatalkan" -and $stokDb -eq "100" -and ($allA -match "E0019|tidak dalam status disetujui"))

        if ($isTerimaMenang) {
            Write-Host "Iterasi #$i : PASS (Pemenang: TERIMA BARANG, Status: diterima, Stok: 110, Batal ditolak rapi)" -ForegroundColor Green
            $passCount++
        } elseif ($isBatalMenang) {
            Write-Host "Iterasi #$i : PASS (Pemenang: BATALKAN PO, Status: dibatalkan, Stok: 100, Terima ditolak rapi)" -ForegroundColor Green
            $passCount++
        } else {
            Write-Host "Iterasi #$i : GAGAL (Status: $statusDb, Stok: $stokDb)" -ForegroundColor Red
            Write-Host "  Respon A: $allA"
            Write-Host "  Respon B: $allB"
        }
    }

    Write-Host "`n------------------------------------------------------------"
    Write-Host "HASIL TC-228: $passCount / $totalIterasi ITERASI LULUS"
    Write-Host "------------------------------------------------------------"

    if ($passCount -eq $totalIterasi) {
        Write-Host "TC-228 BERHASIL LULUS 100% BEBAS DEADLOCK DENGAN SATU PEMENANG KONSISTEN!" -ForegroundColor Green
    } else {
        throw "TC-228 Gagal: ada iterasi yang tidak memenuhi spesifikasi!"
    }
}
finally {
    # Cleanup master uji
    $cleanupSql = @"
DROP TABLE IF EXISTS public._temp_tc228;
DELETE FROM public.mutasi_stok WHERE barang_id = 'b7777777-0000-0000-0000-000000000002';
DELETE FROM public.pembelian WHERE pemasok_id = 'a7777777-0000-0000-0000-000000000001';
DELETE FROM public.barang WHERE id = 'b7777777-0000-0000-0000-000000000002';
DELETE FROM public.pemasok WHERE id = 'a7777777-0000-0000-0000-000000000001';
"@
    Run-Psql $cleanupSql | Out-Null
    Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
