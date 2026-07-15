# Changelog

## 0.20260715.0

- **fix**: `proof --version` (and any packaged run) crashed on every non-CI machine because Bun's bundler inlined `__dirname` as the build machine's absolute path (`/home/runner/work/proof/proof/src`), which does not exist elsewhere. The version is now injected at build time via a `__PROOF_VERSION__` define for both the npm bundle and the standalone compiled binary (the compiled binary has no `package.json` on disk to read), with a runtime `import.meta.url` fallback for unbundled dev runs. Added a `--version` regression test.

## 0.20260323.0

- **feat**: Terminal video export — add `--format video` to any terminal capture to produce an `.mp4` alongside the `.html` player. The video is rendered by a headless Chromium browser replaying the HTML player and converted to H.264 via ffmpeg. Viewport is sized to match the terminal dimensions (cols × rows) so there is no wasted whitespace. Ideal for embedding evidence inline in Linear, Jira, Notion, or Slack where `.html` files cannot be previewed.
- **fix**: Build now marks `playwright` and `playwright-core` as external in the Bun bundler — previously the build failed with `Could not resolve: "electron"` due to Playwright's internal electron sub-module.

## 0.20260317.0

- **feat**: iOS Simulator capture mode -- `--mode simulator --platform ios` records the simulator screen via `xcrun simctl io recordVideo` while running any command (typically `xcodebuild test`).
- **feat**: Android emulator capture mode -- `--mode simulator --platform android` records the emulator via `adb emu screenrecord` while running any command. Uses the QEMU monitor protocol to capture from the virtual framebuffer, which works on Apple Silicon where `adb shell screenrecord` produces 0 frames.
- **feat**: Tap indicator overlays for iOS -- `ProofTapLogger.swift` is a drop-in XCUITest extension. Replace `element.tap()` with `element.proofTap()` and proof reads the logged coordinates to overlay pixel-accurate red dot + ripple ring indicators via ffmpeg post-processing.
- **feat**: Tap indicator overlays for Android -- write `[{element, x, y, offsetMs}]` to `$PROOF_TAP_LOG` (default `/tmp/proof-android-taps.json`) from your test script and proof overlays indicators at the correct positions.
- **fix**: Warn when `xcodebuild test` is used without `-parallel-testing-enabled NO -disable-concurrent-destination-testing` -- xcodebuild clones the simulator by default, which causes the recording to capture an idle screen instead of the active clone.
- **fix**: Exclude test files from `tsc` compilation -- `dist/*.test.js` files were landing in dist and failing with a missing `cli.ts` reference. Test files are now compiled only by `bun test` at runtime.
- **fix**: Scope `bun test` to `src/` and `test-app/cli/` -- prevents Playwright `.spec.ts` files from being picked up by bun's test runner.

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
