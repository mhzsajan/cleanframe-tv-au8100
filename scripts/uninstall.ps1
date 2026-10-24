<#
.SYNOPSIS
    Remove CleanFrame from a Samsung Tizen TV.

.DESCRIPTION
    Samsung's vd_appuninstall takes the *application* ID (e.g. CfrHome001.Home),
    not the package ID. Passing the package ID fails with
    "was get app info failed".

.PARAMETER TvAddress
    The TV's LAN address, e.g. 192.168.0.7

.PARAMETER AppId
    Application ID to remove. Default: CfrHome001.Home

.EXAMPLE
    .\uninstall.ps1 -TvAddress 192.168.0.7
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TvAddress,

    [int]$Port = 26101,
    [string]$AppId = 'CfrHome001.Home',
    [string]$TizenStudio = "$env:LOCALAPPDATA\tizen-studio"
)

$ErrorActionPreference = 'Stop'
$sdb = Join-Path $TizenStudio 'tools\sdb\sdb.exe'
$serial = '{0}:{1}' -f $TvAddress, $Port

if (-not (Test-Path $sdb)) {
    throw "sdb not found at '$sdb'. Install the Tizen Studio CLI or pass -TizenStudio <path>."
}

Write-Host "Connecting to $serial ..." -ForegroundColor Cyan
& $sdb connect $serial
if ($LASTEXITCODE -ne 0) { throw "Could not connect to $serial." }

Write-Host "Uninstalling $AppId ..." -ForegroundColor Cyan
$out = & $sdb -s $serial shell 0 vd_appuninstall $AppId 2>&1
$out | Out-Host

if ($out -match 'uninstall completed') {
    Write-Host 'Removed.' -ForegroundColor Green
} else {
    throw 'Uninstall was not confirmed.'
}
