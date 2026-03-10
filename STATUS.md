# Status

## Current State: Scaffold Complete

**Last updated:** 2026-03-10

### What's done

- [x] PRD finalized (renamed to README.md)
- [x] Project scaffold: `package.json`, `tsconfig.json`, `.gitignore`
- [x] Core types defined (`types.ts`)
- [x] Mode auto-detection (`detect.ts`) — scans for Playwright config, package deps, asciinema
- [x] Visual capture mode (`modes/visual.ts`) — runs Playwright tests, collects video
- [x] Terminal capture mode (`modes/terminal.ts`) — asciinema recording with optional gif conversion
- [x] Test output capture mode (`modes/output.ts`) — stdout/stderr fallback
- [x] Main `Proof` class (`index.ts`) — capture, compare, attachToPR, attachToIssue, listRuns, cleanup
- [x] Playwright as direct dependency (not peer)
- [x] TypeScript compiles clean

### What's next

- [ ] Wire up Playwright properly (use its Node API directly instead of shelling out to `npx`)
- [ ] Add actual video duration extraction (currently returns 0)
- [ ] GitHub upload — upload video assets, not just path references in comments
- [ ] Tests — unit tests for detect, capture modes, cleanup logic
- [ ] Try it end-to-end on a real project
- [ ] Integration with ladybug and ralph

### Decisions made

- **Name:** proof (domain: getproof.sh)
- **Package:** `@varops/proof`
- **Runtime:** Bun
- **Playwright:** direct dependency, not peer
- **Cross-language:** deferred; will add CLI wrapper if needed later
- **Artifact storage:** `workDir/<run-id>/` layout with retention/cleanup API
