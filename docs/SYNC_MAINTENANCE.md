# React DevTools MCP — Upstream Sync Maintenance Guide

You are a senior Git and software architecture assistant responsible for maintaining this repository.

This repository is a **customized extension** of the upstream repository [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp).

## Goal

Keep this repository **synchronized with upstream** while **preserving all custom functionality** implemented in this repo.

## Important Constraints

- **Custom functionality must NEVER be accidentally removed.**
- Prefer upstream changes when core logic changes unless it breaks our extensions.
- Custom code should be preserved and adapted if upstream APIs change.

## Repository Structure

| Location | Purpose |
|----------|---------|
| `src/` | Upstream core code (mostly unchanged) |
| `src/extensions/` | **Custom** — React DevTools extension modules |
| `docs/SYNC_MAINTENANCE.md` | **Custom** — This maintenance guide |
| `scripts/sync-from-upstream.sh` | **Custom** — Sync automation script |

## Maintenance Workflow

When this prompt is executed, follow these steps:

---

### Step 1 — Detect Upstream Changes

1. Check the upstream repository for new commits.
2. Compare the current repo branch with `upstream/main`.
3. Generate a summary of changes including:
   - Number of commits
   - Modified files
   - Removed files
   - Renamed files
   - Potential breaking changes

---

### Step 2 — Fetch and Prepare Sync

1. Fetch the latest upstream changes: `git fetch upstream`
2. Rebase the current repository on top of `upstream/main`: `git rebase upstream/main`
3. If rebase is not possible, perform a merge while preserving commit history: `git merge upstream/main`

---

### Step 3 — Handle Merge Conflicts

If conflicts occur, apply these resolution rules:

| Rule | Action |
|------|--------|
| **Rule 1** | Prefer upstream changes for core infrastructure files unless they break functionality. |
| **Rule 2** | Always preserve custom extensions or added tools. |
| **Rule 3** | If upstream APIs changed, update extension code to match the new interface. |
| **Rule 4** | Avoid removing custom debugging tools or analysis logic. |
| **Rule 5** | If a conflict cannot be resolved safely, **flag it** instead of guessing. |

---

### Step 4 — Validate Repository

After resolving merges:

1. Ensure project builds successfully: `npm run build`
2. Ensure imports and module references still work.
3. Detect broken dependencies.
4. Detect removed upstream APIs affecting extensions.
5. Fix simple compatibility issues if possible.

---

### Step 5 — Architecture Check

Analyze whether upstream changes require:

- Refactoring extensions
- New hooks or integration points
- Removal of deprecated APIs

Suggest improvements if necessary.

---

### Step 6 — Safety Check

Ensure the following were **NOT** removed:

- [ ] Custom MCP tools
- [ ] Debugging utilities
- [ ] Extension modules (`src/extensions/`)
- [ ] Configuration required by extensions

---

### Step 7 — Final Report

Produce a report with:

1. Upstream commit summary
2. Files changed
3. Conflicts encountered
4. Conflicts resolved
5. Any risky areas requiring manual review
6. Suggested architectural improvements

Output should be **concise but clear**.

---

## Important Reminders

- **Never delete custom features** unless explicitly instructed.
- If unsure about a merge decision, **explain the situation** instead of guessing.
- The goal is a **stable repository** that stays updated with upstream while keeping our custom enhancements intact.
