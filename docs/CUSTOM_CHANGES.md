# Custom Changes — React DevTools MCP

This document tracks all customizations made to the upstream [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) repository.

**Never remove these during upstream sync.** Use this as a checklist when merging.

## Custom Files (Do Not Delete)

| File | Purpose |
|------|---------|
| `src/extensions/index.ts` | Extension point for custom MCP tools |
| `src/tools/tools.ts` | Modified: imports `getCustomTools`, merges custom tools |
| `src/tools/react.ts` | React debugging MCP tools |
| `src/injected/react-debug-bootstrap.ts` | Bootstrap script for React DevTools hook |
| `tests/tools/react.test.ts` | Tests for React tools |
| `docs/react-debugging.md` | React debugging architecture and usage |
| `docs/REACT_DEBUG_TOOLS_AI_GUIDE.md` | AI agent guide: when to call tools, params, response shapes |
| `docs/SYNC_MAINTENANCE.md` | Upstream sync maintenance workflow |
| `docs/CUSTOM_CHANGES.md` | This file — change tracking |
| `scripts/sync-from-upstream.sh` | Sync automation script |
| `.cursor/skills/sync-upstream-maintenance/` | Sync skill for Cursor |

## Modified Upstream Files

### `src/tools/tools.ts`

- **Added:** `import {getCustomTools} from '../extensions/index.js';`
- **Added:** `const customTools = args.slim ? [] : getCustomTools();`
- **Added:** `const rawTools = [...baseRawTools, ...customTools];` (renamed `rawTools` from inline to `baseRawTools` + merge)

When upstream modifies `tools.ts`, preserve these three changes during merge.

## Upstream Remote

```bash
git remote add upstream https://github.com/ChromeDevTools/chrome-devtools-mcp.git
```

## Sync Command

```bash
./scripts/sync-from-upstream.sh rebase
# or
./scripts/sync-from-upstream.sh merge
```
