[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

if (-not $ConfirmRestore) {
  throw "Restore is destructive. Re-run with -ConfirmRestore after verifying the target is a restore/test database."
}
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) {
  throw "Backup file not found: $BackupFile"
}
if (-not $env:RESTORE_DATABASE_URL) {
  throw "Set RESTORE_DATABASE_URL explicitly. This script never falls back to DATABASE_URL."
}

$RestoreUrl = $env:RESTORE_DATABASE_URL
if (($env:DATABASE_URL -and $RestoreUrl -eq $env:DATABASE_URL) -or
    ($env:DATABASE_DIRECT_URL -and $RestoreUrl -eq $env:DATABASE_DIRECT_URL)) {
  throw "RESTORE_DATABASE_URL matches a configured application database. Use an isolated restore/test database."
}

$PgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $PgRestore) {
  throw "pg_restore is required. Install PostgreSQL client tools and ensure pg_restore is on PATH."
}

Write-Host "Restoring into the explicitly configured RESTORE_DATABASE_URL target..."
& $PgRestore.Source "--dbname=$RestoreUrl" "--clean" "--if-exists" "--no-owner" "--no-acl" "--exit-on-error" $BackupFile
if ($LASTEXITCODE -ne 0) {
  throw "pg_restore failed with exit code $LASTEXITCODE."
}

Write-Host "Restore completed. Run application smoke tests against the restored database before considering the backup validated."
