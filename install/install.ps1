# proof install script - Windows
#
# Usage:
#   irm https://getproof.sh/install | iex
#
# Options:
#   $env:PROOF_VERSION = "0.20260312.1"; irm https://getproof.sh/install | iex

param(
    [string]$Version,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# Colors
$Green = "`e[32m"
$Cyan = "`e[36m"
$Red = "`e[31m"
$Bold = "`e[1m"
$Reset = "`e[0m"

$Check = "${Green}✓${Reset}"
$Cross = "${Red}✗${Reset}"

if ($Help) {
    Write-Host @"
proof installer - Windows

USAGE:
    irm https://raw.githubusercontent.com/automazeio/proof/main/install.ps1 | iex

OPTIONS:
    -Version    Install a specific version (default: latest)
    -Help       Show this help
"@
    exit 0
}

# Detect architecture
$Arch = if ([Environment]::Is64BitOperatingSystem) {
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
} else {
    Write-Host "${Cross} 32-bit Windows is not supported"
    exit 1
}

# Install directory
$InstallDir = "$env:LOCALAPPDATA\proof\bin"

# Resolve version
if (-not $Version) {
    $Version = $env:PROOF_VERSION
}
if (-not $Version) {
    try {
        $response = Invoke-WebRequest -Uri "https://github.com/automazeio/proof/releases/latest" -MaximumRedirection 0 -ErrorAction SilentlyContinue
    } catch {
        if ($_.Exception.Response.Headers.Location) {
            $location = $_.Exception.Response.Headers.Location.ToString()
            if ($location -match "/tag/v(.+)$") {
                $Version = $matches[1]
            }
        }
    }
    if (-not $Version) {
        Write-Host "${Cross} Failed to detect latest version"
        exit 1
    }
}

$BinaryName = "proof-windows-${Arch}.exe"
$DownloadUrl = "https://github.com/automazeio/proof/releases/download/v${Version}/${BinaryName}"

Write-Host ""
Write-Host "${Bold}proof${Reset} installer"
Write-Host ""
Write-Host "  Version:  ${Cyan}${Version}${Reset}"
Write-Host "  Platform: ${Cyan}windows/${Arch}${Reset}"
Write-Host "  Target:   ${Cyan}${InstallDir}\proof.exe${Reset}"
Write-Host ""

# Create install directory
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Download binary
Write-Host "  Downloading..." -NoNewline
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile "$InstallDir\proof.exe" -UseBasicParsing
    Write-Host " ${Check}"
} catch {
    Write-Host ""
    Write-Host "${Cross} Download failed: $DownloadUrl"
    Write-Host ""
    Write-Host "  Check available versions at:"
    Write-Host "  https://github.com/automazeio/proof/releases"
    exit 1
}

Write-Host "  Installed ${Check}"

# Update PATH
$PathUpdated = $false
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", "User")
    $env:Path = "$env:Path;$InstallDir"
    $PathUpdated = $true
}

Write-Host ""
Write-Host "${Check} proof ${Version} installed successfully!"
Write-Host ""

if ($PathUpdated) {
    Write-Host "  Restart your terminal for PATH changes to take effect."
    Write-Host ""
}

Write-Host "  Get started:"
Write-Host "    ${Cyan}proof capture --app my-app --command `"npm test`" --mode terminal${Reset}"
Write-Host ""
Write-Host "  Docs: https://github.com/automazeio/proof"
Write-Host ""
