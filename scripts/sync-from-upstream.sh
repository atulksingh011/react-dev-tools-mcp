#!/usr/bin/env bash
#
# React DevTools MCP — Sync from Upstream
#
# This script helps synchronize this fork with ChromeDevTools/chrome-devtools-mcp.
# Run from the repository root.
#
# Prerequisites:
#   git fetch upstream   # Ensure upstream remote exists and is fetched
#
# Usage:
#   ./scripts/sync-from-upstream.sh [rebase|merge]
#
# Default: rebase

set -e

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
CURRENT_BRANCH=$(git branch --show-current)
MODE="${1:-rebase}"

echo "=== React DevTools MCP — Upstream Sync ==="
echo "Current branch: $CURRENT_BRANCH"
echo "Upstream: $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
echo "Mode: $MODE"
echo ""

# Ensure upstream remote exists
if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
  echo "Adding upstream remote..."
  git remote add upstream https://github.com/ChromeDevTools/chrome-devtools-mcp.git
fi

echo "Fetching from $UPSTREAM_REMOTE..."
git fetch "$UPSTREAM_REMOTE"

echo ""
echo "--- Upstream changes (last 10 commits) ---"
git log --oneline "$CURRENT_BRANCH..$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" 2>/dev/null || echo "(no new commits)"
echo ""

if [ "$MODE" = "rebase" ]; then
  echo "Rebasing onto $UPSTREAM_REMOTE/$UPSTREAM_BRANCH..."
  git rebase "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" || {
    echo ""
    echo "Rebase failed. Resolve conflicts, then run: git rebase --continue"
    echo "Or abort with: git rebase --abort"
    exit 1
  }
else
  echo "Merging $UPSTREAM_REMOTE/$UPSTREAM_BRANCH..."
  git merge "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" --no-edit || {
    echo ""
    echo "Merge failed. Resolve conflicts, then run: git add . && git commit"
    echo "Or abort with: git merge --abort"
    exit 1
  }
fi

echo ""
echo "=== Sync complete ==="
echo "Run 'npm run build' and 'npm test' to validate."
