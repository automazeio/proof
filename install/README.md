# Install proof

Standalone binary installers. `getproof.sh/install` detects the OS and serves the right script.

## Quick install

```bash
# macOS / Linux
curl -fsSL https://getproof.sh/install | sh

# Windows (PowerShell)
irm https://getproof.sh/install | iex

# Homebrew
brew install automazeio/tap/proof
```

## What the installers do

1. Detect OS and architecture
2. Download the correct binary from [GitHub Releases](https://github.com/automazeio/proof/releases)
3. Install to `~/.local/bin` (or `/usr/local/bin` as root, `%LOCALAPPDATA%\proof\bin` on Windows)
4. Add to PATH if needed

## Options

```bash
# Install a specific version
curl -fsSL https://getproof.sh/install | sh -s -- --version 0.20260312.1

# Windows: specific version
$env:PROOF_VERSION = "0.20260312.1"; irm https://getproof.sh/install | iex
```

## Files

| File | Served when | Description |
|------|-------------|-------------|
| `install.sh` | macOS / Linux | Bash installer, detects OS/arch, manages PATH |
| `install.ps1` | Windows | PowerShell installer, updates user PATH |

## Supported platforms

| OS | Arch | Binary |
|----|------|--------|
| macOS | arm64 (Apple Silicon) | `proof-darwin-arm64` |
| macOS | x64 (Intel) | `proof-darwin-x64` |
| Linux | x64 | `proof-linux-x64` |
| Linux | arm64 | `proof-linux-arm64` |
| Windows | x64 | `proof-windows-x64.exe` |

## getproof.sh setup

Point `getproof.sh/install` to serve based on User-Agent:

- PowerShell UA -> serve `install.ps1`
- Everything else -> serve `install.sh`

Or use a simple redirect:
```
https://getproof.sh/install -> https://raw.githubusercontent.com/automazeio/proof/main/install/install.sh
https://getproof.sh/install.ps1 -> https://raw.githubusercontent.com/automazeio/proof/main/install/install.ps1
```

PowerShell's `irm` (Invoke-RestMethod) will execute whatever it gets, so both `irm https://getproof.sh/install | iex` and `irm https://getproof.sh/install.ps1 | iex` work as long as the response is the ps1 content.
