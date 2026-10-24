<#
.SYNOPSIS
    Package and sign the CleanFrame app into a .wgt widget.

.DESCRIPTION
    Wraps the Tizen CLI (`tz pack`). The widget is written to app\Debug\.

.PARAMETER Profile
    Signing profile name, as shown by `tz security-profiles list`. Default: san

.PARAMETER TizenStudio
    Tizen Studio install root. Default: %LOCALAPPDATA%\tizen-studio

.EXAMPLE
    .\build.ps1
#>
[CmdletBinding()]
param(
    [string]$Profile = 'san',
    [string]$TizenStudio = "$env:LOCALAPPDATA\tizen-studio"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tz = Join-Path $TizenStudio 'tools\tizen-core\tz.exe'

if (-not (Test-Path $tz)) {
    throw "tz CLI not found at '$tz'. Install the Tizen Studio CLI or pass -TizenStudio <path>."
}

Write-Host 'Available signing profiles:' -ForegroundColor Cyan
& $tz security-profiles list
if ($LASTEXITCODE -ne 0) { throw 'Could not read signing profiles.' }

Write-Host "`nPackaging with profile '$Profile'..." -ForegroundColor Cyan
& $tz pack -w (Join-Path $root 'app') -t wgt -s $Profile
if ($LASTEXITCODE -ne 0) { throw "Packaging failed (exit code $LASTEXITCODE)." }

$wgt = Get-ChildItem (Join-Path $root 'app\Debug') -Filter '*.wgt' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $wgt) { throw 'Packaging reported success but no .wgt was produced.' }

Write-Host "`nWidget: $($wgt.FullName)" -ForegroundColor Green
Write-Host ("Size:   {0:N2} MB" -f ($wgt.Length / 1MB))
$wgt.FullName
