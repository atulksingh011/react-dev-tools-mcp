---
name: sync-upstream-maintenance
description: >-
  Synchronizes this fork with upstream ChromeDevTools/chrome-devtools-mcp while
  preserving custom extensions. Use when syncing from upstream, merging upstream
  changes, rebasing on chrome-devtools-mcp, or when the user asks to update the
  fork or pull upstream changes.
---

# Upstream Sync Maintenance

This repo is a fork of [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp). Custom code lives in `src/extensions/` and `extensions/`.

**Constraint:** Never remove custom functionality. Prefer upstream for core files; preserve extensions.

## Workflow

### 1. Detect Upstream Changes

```bash
git fetch upstream
git log --oneline HEAD..upstream/main
```

Summarize: commit count, modified/removed/renamed files, breaking changes.

### 2. Fetch and Sync

```bash
./scripts/sync-from-upstream.sh rebase
# If rebase fails: ./scripts/sync-from-upstream.sh merge
```

### 3. Resolve Conflicts

| Rule | Action |
|------|--------|
| Core files | Prefer upstream unless it breaks extensions |
| Custom code | Always preserve `src/extensions/` |
| API changes | Adapt extension code to new interfaces |
| Unclear | Flag for manual review; do not guess |

### 4. Validate

```bash
npm run build
npm test
```

Check imports, dependencies, and removed APIs affecting extensions.

### 5. Safety Check

Verify NOT removed: custom MCP tools, `src/extensions/`, `docs/`, `scripts/sync-from-upstream.sh`.

### 6. Final Report

Output: commit summary, files changed, conflicts (encountered/resolved), risky areas, suggested improvements.

## Reference

- Full workflow: [docs/SYNC_MAINTENANCE.md](../../../docs/SYNC_MAINTENANCE.md)
- Custom changes: [docs/CUSTOM_CHANGES.md](../../../docs/CUSTOM_CHANGES.md)
