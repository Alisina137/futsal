[CmdletBinding()]
param(
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $RepoRoot "artifacts\backups"
}

$ConnectionString = if ($env:DATABASE_DIRECT_URL) {
  $env:DATABASE_DIRECT_URL
} elseif ($env:DATABASE_URL) {
  $env:DATABASE_URL
} else {
  throw "Set DATABASE_DIRECT_URL (preferred) or DATABASE_URL before running a backup."
}

$PgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $PgDump) {
  throw "pg_dump is required. Install PostgreSQL client tools and ensure pg_dump is on PATH."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutputFile = Join-Path $OutputDirectory "futsal-$Timestamp.dump"

Write-Host "Creating encrypted-in-transit PostgreSQL backup..."
& $PgDump.Source "--dbname=$ConnectionString" "--format=custom" "--no-owner" "--no-acl" "--file=$OutputFile"
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE."
}

Write-Host "Backup created: $OutputFile"
Write-Host "Store this file in an access-controlled backup location. It is ignored by Git."
