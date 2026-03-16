# Changelog

## 0.20260316.0

- **feat**: Add `--device` option for Playwright device emulation — pass any Playwright device name (e.g. `"iPhone 14"`, `"iPad Pro 11"`) to capture with that device's viewport, user-agent, and touch emulation.
- **feat**: Add `--viewport` option for custom viewport sizes — pass `WIDTHxHEIGHT` (e.g. `"390x844"`) to capture at a specific size without full device emulation.
- **feat**: Both `--device` and `--viewport` accept comma-separated values (CLI) or arrays (SDK/JSON) to capture the same test across multiple devices or viewports in one call.
- **docs**: Updated README, mental model, and agent skill with device/viewport examples.

## 0.20260314.0

- **feat**: Add `--format` option to CLI report command — supports `md`, `html`, `archive` (comma-separated for multiple). Works in both arg mode (`--format html`) and JSON stdin mode (`"format": "html"` or `"format": ["md", "html"]`). Report output changed from `{path}` to `{paths: [...]}` for consistency.

## 0.20260313.2

- **feat**: Trim dead time from start/end of `.cast` recordings — shifts timestamps so first output starts at t=0, uses last event as duration instead of wall clock.
- **docs**: Full ecosystem documentation — README, SDK guide, agent skill updated for CLI binary + Python + Go.

## 0.20260313.1

- **feat**: Python SDK — `automaze-proof` on PyPI, zero dependencies, 12 tests passing.
- **fix**: PyPI publish via `PYPI_RELEASE_TOKEN` in release workflow.

## 0.20260313.0

- **feat**: Binary distribution — standalone `proof` binary via `bun build --compile` for macOS (arm64/x64) and Linux (arm64/x64).
- **feat**: Install scripts — `install.sh` (POSIX-compatible), `install.ps1` (Windows PowerShell).
- **feat**: Homebrew tap — `brew install automazeio/tap/proof`.
- **feat**: Release workflow — tag-triggered GitHub Actions builds binaries, publishes to npm (OIDC) and PyPI.
- **fix**: POSIX installer compatibility — `printf` instead of `echo -e`, `case` instead of `[[`.
- **fix**: Installer version detection — proper HTTP header parsing for GitHub redirect URLs.
