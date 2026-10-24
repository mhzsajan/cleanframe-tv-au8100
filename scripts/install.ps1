<#
.SYNOPSIS
    Build, install and launch CleanFrame on a Samsung Tizen TV.

.DESCRIPTION
    Connects over SDB, pushes the signed widget to the TV's SDK staging area,
    installs it with Samsung's vd_appinstall and launches it.

    The TV must have Developer Mode enabled, with this PC's LAN address set as
    "Host PC IP". The address must be the computer's own IP, not the TV's.

.PARAMETER TvAddress
    The TV's LAN address, e.g. 192.168.0.7

.PARAMETER Port
    SDB port. Default: 26101

.PARAMETER AppId
    Application ID to install and launch. Default: CfrHome001.Home

.PARAMETER Profile
    Signing profile used when packaging.

.PARAMETER SkipBuild
    Install the existing widget instead of rebuilding it.

.EXAMPLE
    .\install.ps1 -TvAddress 192.168.0.7

.EXAMPLE
    .\install.ps1 -TvAddress 192.168.0.7 -SkipBuild
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TvAddress,

    [int]$Port = 26101,
    [string]$AppId = 'CfrHome001.Home',
    [string]$Profile = 'san',
    [switch]$SkipBuild,
    [string]$TizenStudio = "$env:LOCALAPPDATA\tizen-studio"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$sdb = Join-Path $TizenStudio 'tools\sdb\sdb.exe'
$serial = '{0}:{1}' -f $TvAddress, $Port

if (-not (Test-Path $sdb)) {
    throw "sdb not found at '$sdb'. Install the Tizen Studio CLI or pass -TizenStudio <path>."
}

if (-not $SkipBuild) {
    & (Join-Path $PSScriptRoot 'build.ps1') -Profile $Profile -TizenStudio $TizenStudio | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}

$wgt = Get-ChildItem (Join-Path $root 'app\Debug') -Filter '*.wgt' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $wgt) {
    throw 'No .wgt found in app\Debug. Run build.ps1 first, or drop -SkipBuild.'
}

Write-Host "`nConnecting to $serial ..." -ForegroundColor Cyan
& $sdb connect $serial
if ($LASTEXITCODE -ne 0) {
    throw @"
Could not connect to $serial.
Check: TV Developer Mode is ON, 'Host PC IP' is this computer's LAN address,
the TV is powered on (not in standby), and both are on the same network.
"@
}

$remote = '/home/owner/share/tmp/sdk_tools/cleanframe-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.wgt'

Write-Host 'Transferring widget...' -ForegroundColor Cyan
$push = & $sdb -s $serial push $wgt.FullName $remote 2>&1
$push | Out-Host
if ($push -notmatch '1 file\(s\) pushed') { throw 'Widget transfer was not confirmed.' }

Write-Host 'Installing...' -ForegroundColor Cyan
$install = & $sdb -s $serial shell 0 vd_appinstall $AppId $remote 2>&1
$install | Out-Host
if ($install -match 'install failed') {
    throw @"
Installation failed. Common causes:
  * package ID is not exactly 10 characters -> 'Parsing error'
  * widget built for a higher Tizen version than the TV -> check required_version in app\config.xml
"@
}
if ($install -notmatch 'install completed') { throw 'Installation was not confirmed.' }

Write-Host 'Launching...' -ForegroundColor Cyan
$launch = & $sdb -s $serial shell 0 execute $AppId 2>&1
$launch | Out-Host
if ($launch -notmatch 'successfully launched') {
    Write-Warning "Launch was not confirmed. Check the TV screen."
}

& $sdb -s $serial shell 0 rm -f $remote 2>$null | Out-Null

Write-Host "`nDone. CleanFrame should be on screen." -ForegroundColor Green
Write-Host 'Later: Home -> Apps -> CleanFrame'
