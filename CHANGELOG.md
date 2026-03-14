# Changelog

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
