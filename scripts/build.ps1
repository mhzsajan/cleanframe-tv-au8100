<#
.SYNOPSIS
    Compile the TypeScript/Preact source and sign it into a .wgt widget.

.DESCRIPTION
    Runs `npm run build` (tsc type-check + vite bundle to app\), then signs the
    result with the Tizen CLI. Output goes to app\Debug\.

.PARAMETER Profile
    Signing profile name, as shown by `tz security-profiles list`. Default: san

.PARAMETER SkipCompile
    Sign the existing app\ folder without recompiling.

.EXAMPLE
    .\build.ps1
#>
[CmdletBinding()]
param(
    [string]$Profile = 'san',
    [switch]$SkipCompile,
    [string]$TizenStudio = "$env:LOCALAPPDATA\tizen-studio"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tz = Join-Path $TizenStudio 'tools\tizen-core\tz.exe'

if (-not $SkipCompile) {
    Write-Host 'Compiling (tsc + vite)...' -ForegroundColor Cyan
    Push-Location $root
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Build failed (exit code $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $tz)) {
    throw "tz CLI not found at '$tz'. Install the Tizen Studio CLI or pass -TizenStudio <path>."
}

Write-Host "`nPackaging with profile '$Profile'..." -ForegroundColor Cyan
& $tz pack -w (Join-Path $root 'app') -t wgt -s $Profile
if ($LASTEXITCODE -ne 0) { throw "Packaging failed (exit code $LASTEXITCODE)." }

$wgt = Get-ChildItem (Join-Path $root 'app\Debug') -Filter '*.wgt' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $wgt) { throw 'Packaging reported success but no .wgt was produced.' }

Write-Host "`nWidget: $($wgt.FullName)" -ForegroundColor Green
Write-Host ("Size:   {0:N2} MB" -f ($wgt.Length / 1MB))
$wgt.FullName
