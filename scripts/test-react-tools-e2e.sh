#!/usr/bin/env bash
# E2E test for React debug tools on a real page.
# Usage: ./scripts/test-react-tools-e2e.sh
#
# Prerequisites:
# - App running at http://localhost:5173
# - Login: 9535888738 / kamal123
#
# This script: enables React debug, navigates, logs in, and tests each tool.

set -e
cd "$(dirname "$0")/.."
BIN="node build/src/bin/chrome-devtools.js"
OUTPUT="scripts/react-tools-e2e-results.txt"

echo "=== React Debug Tools E2E Test ===" | tee "$OUTPUT"
echo "Started: $(date)" | tee -a "$OUTPUT"

# Ensure server is running
echo "" | tee -a "$OUTPUT"
echo "--- 1. Starting/checking MCP server ---" | tee -a "$OUTPUT"
$BIN start --no-headless 2>&1 | tee -a "$OUTPUT" || true
sleep 3

# enable_react_debug (must be first, before page loads)
echo "" | tee -a "$OUTPUT"
echo "--- 2. enable_react_debug ---" | tee -a "$OUTPUT"
$BIN enable_react_debug --output-format json 2>&1 | tee -a "$OUTPUT"

# Navigate to target page
echo "" | tee -a "$OUTPUT"
echo "--- 3. navigate_page to chat URL ---" | tee -a "$OUTPUT"
$BIN navigate_page --type url --url "http://localhost:5173/chat/694788a0d40b2f3effa7933f" --output-format json 2>&1 | tee -a "$OUTPUT"
sleep 3

# Take snapshot to inspect page (login form or chat)
echo "" | tee -a "$OUTPUT"
echo "--- 4. take_snapshot (check if login needed) ---" | tee -a "$OUTPUT"
$BIN take_snapshot --output-format json 2>&1 | tee -a "$OUTPUT"

echo "" | tee -a "$OUTPUT"
echo ">>> MANUAL STEP: If you see a login form, run these to login:" | tee -a "$OUTPUT"
echo "    $BIN fill --uid <phone_input_uid> --value 9535888738" | tee -a "$OUTPUT"
echo "    $BIN fill --uid <password_input_uid> --value kamal123" | tee -a "$OUTPUT"
echo "    $BIN click --uid <login_button_uid>" | tee -a "$OUTPUT"
echo ">>> Then run: $BIN navigate_page --type reload" | tee -a "$OUTPUT"
echo ">>> Then re-run this script from step 5, or run the tool tests below." | tee -a "$OUTPUT"

# Test each React tool
test_tool() {
  local name=$1
  local args=${2:-}
  echo "" | tee -a "$OUTPUT"
  echo "--- $name ---" | tee -a "$OUTPUT"
  if $BIN "$name" $args --output-format json 2>&1 | tee -a "$OUTPUT"; then
    echo "PASS: $name" | tee -a "$OUTPUT"
  else
    echo "FAIL or ERROR: $name" | tee -a "$OUTPUT"
  fi
}

echo "" | tee -a "$OUTPUT"
echo "=== Testing React tools (after login, ensure page has React) ===" | tee -a "$OUTPUT"

test_tool "get_react_debug_status"
test_tool "get_react_component_tree" "--maxDepth 5"
test_tool "get_react_render_events" "--limit 10"
test_tool "get_react_render_timeline" "--limit 10"
test_tool "get_prop_diffs" "--limit 10"
test_tool "get_state_updates" "--limit 10"
test_tool "get_render_causes" "--limit 10"
test_tool "get_render_dependency_graph" "--limit 10"

echo "" | tee -a "$OUTPUT"
echo "=== Test complete. Results in $OUTPUT ===" | tee -a "$OUTPUT"
echo "Finished: $(date)" | tee -a "$OUTPUT"
