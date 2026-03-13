# proof: Go SDK

Use `github.com/automazeio/proof-go` to capture test runs from Go. Zero dependencies, auto-downloads the binary if not on PATH.

## Install

```bash
go get github.com/automazeio/proof-go
```

The SDK auto-downloads the proof binary on first use (~100MB, cached to `~/.proof/bin/`). You can also install it manually:

```bash
curl -fsSL https://automaze.io/install/proof | sh
```

## Basic usage

```go
import "github.com/automazeio/proof-go/proof"

p, err := proof.New(proof.Config{AppName: "my-app"})
if err != nil {
    log.Fatal(err) // binary not found and download failed
}

rec, err := p.Capture(proof.CaptureOptions{
    Command: "go test ./...",
    Mode:    "terminal",
})

p.Report(proof.ReportOptions{})
```

## Constructor

```go
// Auto-resolve binary (PATH → cache → download)
p, err := proof.New(proof.Config{
    AppName:     "my-app",        // Required
    ProofDir:    "./evidence",    // Optional, default: os.TempDir()/proof
    Run:         "deploy-v2",     // Optional, default: HHMM
    Description: "Nightly CI",    // Optional
})

// Use a specific binary path (skips resolution)
p := proof.NewWithBinary("/usr/local/bin/proof", proof.Config{
    AppName: "my-app",
})
```

## Capturing terminal output

```go
rec, err := p.Capture(proof.CaptureOptions{
    Command:     "go test ./... -v",
    Mode:        "terminal",
    Label:       "unit-tests",
    Description: "Unit test suite",
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(rec.Path)     // /abs/path/unit-tests-143012.html
fmt.Println(rec.Mode)     // "terminal"
fmt.Println(rec.Duration) // 2400
fmt.Println(rec.Label)    // "unit-tests"
```

## Capturing browser recordings

```go
rec, err := p.Capture(proof.CaptureOptions{
    TestFile: "tests/checkout.spec.ts",
    Mode:     "browser",
    Label:    "checkout",
})
```

## Multiple captures

```go
p, _ := proof.New(proof.Config{
    AppName:  "my-app",
    ProofDir: "./evidence",
    Run:      "full-suite",
})

p.Capture(proof.CaptureOptions{Command: "go test ./...", Mode: "terminal", Label: "unit"})
p.Capture(proof.CaptureOptions{Command: "go vet ./...", Mode: "terminal", Label: "vet"})
p.Capture(proof.CaptureOptions{Command: "golangci-lint run", Mode: "terminal", Label: "lint"})

p.Report(proof.ReportOptions{})
```

## Reports

```go
// Default: markdown
path, err := p.Report(proof.ReportOptions{})

// Specific format
path, err := p.Report(proof.ReportOptions{Format: "html"})

// Self-contained archive
path, err := p.Report(proof.ReportOptions{Format: "archive"})
```

## go test integration

```go
func TestMain(m *testing.M) {
    p, err := proof.New(proof.Config{
        AppName:  "my-service",
        ProofDir: "./evidence",
    })
    if err != nil {
        log.Fatal(err)
    }

    p.Capture(proof.CaptureOptions{
        Command: "go test ./... -v -count=1",
        Mode:    "terminal",
        Label:   "all-tests",
    })

    code := m.Run()

    p.Report(proof.ReportOptions{})
    os.Exit(code)
}
```

## Types

```go
type Config struct {
    AppName     string // Required
    ProofDir    string // Optional
    Run         string // Optional
    Description string // Optional
}

type CaptureOptions struct {
    Command     string // Required for terminal mode
    TestFile    string // Required for browser mode
    TestName    string // Optional: Playwright -g filter
    Label       string // Optional: filename prefix
    Mode        string // Optional: "browser", "terminal", "auto"
    Description string // Optional: stored in manifest
}

type Recording struct {
    Path     string // Absolute path to artifact
    Mode     string // "terminal" or "browser"
    Duration int    // Milliseconds
    Label    string // Filename prefix
}

type ReportOptions struct {
    Format string // Optional: "md", "html", "archive"
}
```

## Binary resolution order

1. `proof` on PATH
2. `~/.proof/bin/proof-<version>` (cached from previous download)
3. Auto-download from GitHub Releases (platform-specific binary, ~100MB)

Downloaded binaries are cached for future use. To force a re-download, delete `~/.proof/bin/`.

## Error handling

```go
// Binary not found (New returns error)
p, err := proof.New(proof.Config{AppName: "test"})
if err != nil {
    // "proof binary not found. Install it: ..."
}

// Capture error (command failed, etc.)
rec, err := p.Capture(proof.CaptureOptions{Command: "bad-cmd"})
if err != nil {
    // error from proof CLI
}
```
