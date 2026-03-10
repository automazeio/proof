# Status

**Last updated:** 2026-03-10

---

## Roadmap

### Phase 1 — Scaffold & Core Types
- [x] PRD finalized (README.md)
- [x] Project scaffold (`package.json`, `tsconfig.json`, `.gitignore`)
- [x] Core types (`types.ts`)
- [x] Mode auto-detection (`detect.ts`)
- [x] Capture modes (visual, terminal, test-output)
- [x] `Proof` class with public API

### Phase 2 — Recording Quality
- [ ] Use Playwright Node API directly (replace subprocess shelling)
- [ ] Video duration extraction
- [ ] Artifact storage with run-id folders
- [ ] Cleanup / retention API

### Phase 3 — GitHub Integration
- [ ] Upload video assets to GitHub (not just path refs)
- [ ] PR comment with embedded video links
- [ ] Issue comment attachment

### Phase 4 — Testing & Reliability
- [ ] Unit tests for detect, capture modes, cleanup
- [ ] End-to-end test on a real project
- [ ] Error handling & edge cases

### Phase 5 — Integration
- [ ] Wire into LadyBug
- [ ] Wire into Ralph
- [ ] Verify before/after comparison flow end-to-end

### Future
- [ ] CLI wrapper for cross-language usage
- [ ] Annotated recordings
- [ ] Video thumbnails for PR comments
- [ ] Recording diffing

---

## Decisions

- **Name:** proof (domain: getproof.sh)
- **Package:** `@varops/proof`
- **Runtime:** Bun
- **Playwright:** direct dependency, not peer
- **Cross-language:** deferred; CLI wrapper if needed later
- **Artifact storage:** `workDir/<run-id>/` layout with retention/cleanup API
