/**
 * @license
 * React DevTools MCP - Custom Extensions
 * SPDX-License-Identifier: Apache-2.0
 *
 * This module provides the extension point for React DevTools custom functionality.
 * Add your custom MCP tools here. These tools are merged with upstream chrome-devtools-mcp tools.
 *
 * IMPORTANT: Never remove this file during upstream sync. Preserve all custom tools.
 */

import type {ToolDefinition} from '../tools/ToolDefinition.js';

/**
 * Returns custom tools for React DevTools MCP.
 * Add your React-specific debugging tools here.
 */
export function getCustomTools(): ToolDefinition[] {
  return [
    // Add custom React DevTools tools here.
    // Example: ...reactComponentTools,
  ];
}
