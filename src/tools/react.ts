/**
 * @license
 * React DevTools MCP - React debugging tools
 * SPDX-License-Identifier: Apache-2.0
 *
 * MCP tools for inspecting React runtime: component tree, render events,
 * prop diffs, state updates, and render timeline.
 */

import {REACT_DEBUG_BOOTSTRAP} from '../injected/react-debug-bootstrap.js';
import {zod} from '../third_party/index.js';

import {ToolCategory} from './categories.js';
import {definePageTool} from './ToolDefinition.js';

/**
 * Evaluates in page context to get component tree from fiber roots.
 * Must be a plain function (no closures) for Puppeteer serialization.
 */
async function evaluateGetComponentTree(
  page: {evaluate: (fn: (maxDepth: number) => unknown, arg: number) => Promise<unknown>},
  maxDepth: number,
): Promise<unknown> {
  return page.evaluate(
    (depth: number) => {
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: {roots?: unknown[]; reactVersion?: string}}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled. Call enable_react_debug first, then navigate or reload the page.'};
      }

      function getDisplayName(fiber: {type?: unknown} | null) {
        if (!fiber || !fiber.type) {
          return 'Anonymous';
        }
        const type = fiber.type as string | {displayName?: string; name?: string} | undefined;
        return typeof type === 'string' ? type : (type?.displayName || type?.name || 'Anonymous');
      }
      function getFiberType(fiber: {tag?: number} | null) {
        if (!fiber) {
          return 'unknown';
        }
        const tag = fiber.tag;
        if (tag === 3) {
          return 'root';
        }
        if (tag === 5) {
          return 'host';
        }
        if (tag === 6) {
          return 'text';
        }
        if (tag === 7) {
          return 'fragment';
        }
        if (tag === 0 || tag === 2) {
          return 'function';
        }
        if (tag === 1) {
          return 'class';
        }
        if (tag === 14 || tag === 15) {
          return 'memo';
        }
        return 'unknown';
      }
      function safeStringify(obj: unknown, d: number): unknown {
        if (d > 2) {
          return '[Max depth]';
        }
        if (obj === null || obj === undefined) {
          return obj;
        }
        if (typeof obj === 'function') {
          return '[Function]';
        }
        if (typeof obj !== 'object') {
          return obj;
        }
        if (obj instanceof Node) {
          return '[DOM Node]';
        }
        try {
          const keys = Object.keys(obj as object).slice(0, 10);
          const out: Record<string, unknown> = {};
          for (const k of keys) {
            if (k === 'children' && typeof (obj as Record<string, unknown>)[k] === 'object') {
              continue;
            }
            try {
              out[k] = safeStringify((obj as Record<string, unknown>)[k], d + 1);
            } catch {
              out[k] = '[Error]';
            }
          }
          return out;
        } catch {
          return '[Error]';
        }
      }
      function traverseFiber(
        fiber: {
          tag?: number;
          type?: unknown;
          memoizedProps?: unknown;
          memoizedState?: unknown;
          child?: unknown;
          sibling?: unknown;
        } | null,
        fiberDepth: number,
        maxD: number,
        idPrefix: string,
      ): Record<string, unknown> | null {
        if (!fiber || (maxD >= 0 && fiberDepth > maxD)) {
          return null;
        }
        const node: Record<string, unknown> = {
          id: idPrefix,
          name: getDisplayName(fiber),
          type: getFiberType(fiber),
          tag: fiber.tag,
          children: [],
        };
        if (fiber.memoizedProps && typeof fiber.memoizedProps === 'object' && fiber.tag !== 6) {
          try {
            node.props = safeStringify(fiber.memoizedProps, 0);
          } catch {
            /* ignore */
          }
        }
        if (fiber.memoizedState && fiber.tag !== 3 && fiber.tag !== 5 && fiber.tag !== 6) {
          try {
            const state = fiber.memoizedState as {memoizedState?: unknown};
            if (state && typeof state === 'object' && state.memoizedState !== undefined) {
              node.state = safeStringify({memoizedState: state.memoizedState}, 0);
            } else {
              node.state = safeStringify(fiber.memoizedState, 0);
            }
          } catch {
            /* ignore */
          }
        }
        let child = fiber.child as typeof fiber | null | undefined;
        let idx = 0;
        while (child) {
          const childNode = traverseFiber(child, fiberDepth + 1, maxD, `${idPrefix}-${idx}`);
          if (childNode) {
            (node.children as unknown[]).push(childNode);
          }
          child = (child as {sibling?: unknown}).sibling as typeof fiber | null | undefined;
          idx++;
        }
        return node;
      }

      let roots: unknown[] = store.roots || [];
      if (roots.length === 0) {
        const hook = (window as unknown as {__REACT_DEVTOOLS_GLOBAL_HOOK__?: {renderers?: Map<unknown, {getRoots?: () => unknown[]}>}}).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook?.renderers) {
          for (const r of Array.from(hook.renderers.values())) {
            if (r?.getRoots) {
              roots = roots.concat(r.getRoots());
            }
          }
        }
      }
      if (roots.length === 0) {
        return {
          error:
            'React not detected. Ensure the page has loaded a React app. Try calling enable_react_debug, then navigate to the React app.',
        };
      }
      const trees = roots.map((root: unknown, i: number) =>
        traverseFiber((root as {current?: unknown})?.current ?? null, 0, depth, String(i)),
      );
      return {
        tree: trees[0],
        trees,
        rootCount: roots.length,
        reactVersion: store.reactVersion ?? null,
      };
    },
    maxDepth,
  );
}

export const enableReactDebug = definePageTool({
  name: 'enable_react_debug',
  description: `Inject the React DevTools hook into the page to enable React debugging. Must be called before navigating to a React app, or the page will need to be reloaded after calling. Use get_react_debug_status to verify.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {},
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    try {
      await page.evaluateOnNewDocument(REACT_DEBUG_BOOTSTRAP);
      await page.evaluate(REACT_DEBUG_BOOTSTRAP);
      response.appendResponseLine(
        'React debug enabled. The hook has been injected. Navigate to a React app or reload the page to start collecting data.',
      );
      response.appendResponseLine('```json');
      response.appendResponseLine(
        JSON.stringify({success: true, message: 'React debug hook installed'}, null, 2),
      );
      response.appendResponseLine('```');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      response.appendResponseLine(`Failed to enable React debug: ${msg}`);
      response.appendResponseLine('```json');
      response.appendResponseLine(JSON.stringify({success: false, error: msg}, null, 2));
      response.appendResponseLine('```');
    }
  },
});

export const getReactDebugStatus = definePageTool({
  name: 'get_react_debug_status',
  description: `Check if React is detected and React debug is active on the current page.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {},
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const result = await page.evaluate(() => {
      interface Store {
        roots?: unknown[];
        reactVersion?: string;
      }
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: Store}).__REACT_DEBUG_STORE__;
      const hook = (window as unknown as {__REACT_DEVTOOLS_GLOBAL_HOOK__?: {renderers?: Map<unknown, unknown>}}).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const roots = store?.roots ?? [];
      const rootCount = Array.isArray(roots) ? roots.length : 0;
      const hasHook = !!hook;
      const hasRenderers = !!(hook?.renderers && hook.renderers.size > 0);
      const reactDetected = rootCount > 0 || hasRenderers;
      return {
        debugEnabled: !!store,
        reactDetected,
        rootCount,
        hasHook,
        hasRenderers,
        reactVersion: store?.reactVersion ?? null,
      };
    });
    response.appendResponseLine('React debug status:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getReactComponentTree = definePageTool({
  name: 'get_react_component_tree',
  description: `Get the React component tree for the currently selected page. Returns component names, types, props, state, and children. Requires enable_react_debug to be called first (and page navigated/reloaded).`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    maxDepth: zod
      .number()
      .int()
      .min(-1)
      .optional()
      .describe(
        'Maximum depth to traverse. -1 or omit for unlimited. Use a small value (e.g. 5) for large trees.',
      ),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const maxDepth = request.params.maxDepth ?? -1;
    const result = await evaluateGetComponentTree(page, maxDepth);
    response.appendResponseLine('React component tree:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getReactRenderEvents = definePageTool({
  name: 'get_react_render_events',
  description: `Get recent React render/commit events. Requires enable_react_debug and at least one render since navigation.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    limit: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of events to return. Default 20.'),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const limit = request.params.limit ?? 20;
    const result = await page.evaluate((lim: number) => {
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: {events?: unknown[]}}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled.'};
      }
      const events = store.events || [];
      return {events: events.slice(0, lim), total: events.length};
    }, limit);
    response.appendResponseLine('React render events:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getReactRenderTimeline = definePageTool({
  name: 'get_react_render_timeline',
  description: `Get a chronological timeline of React commits with relative timing, gaps between renders, and which components changed. More structured than get_react_render_events.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    limit: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of timeline entries. Default 50.'),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const limit = request.params.limit ?? 50;
    const result = await page.evaluate((lim: number) => {
      interface EventLike {
        id?: number;
        phase?: string;
        timestamp?: number;
        didError?: boolean;
        componentNames?: string[];
      }
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: {events?: EventLike[]}}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled.'};
      }
      const raw = (store.events || []).slice(0, lim);
      const chronological = [...raw].reverse();
      const firstTs = chronological.length > 0 ? (chronological[0].timestamp || 0) : 0;
      const timeline = chronological.map((e: EventLike, i: number) => {
        const ts = e.timestamp || 0;
        const prevTs = i > 0 ? (chronological[i - 1].timestamp || 0) : ts;
        return {
          index: i,
          id: e.id,
          relativeMs: ts - firstTs,
          gapFromPrevMs: i > 0 ? ts - prevTs : 0,
          timestamp: ts,
          didError: e.didError,
          componentNames: e.componentNames || [],
        };
      });
      return {timeline, total: (store.events || []).length, spanMs: chronological.length > 1 ? ((chronological[chronological.length - 1].timestamp || 0) - firstTs) : 0};
    }, limit);
    response.appendResponseLine('React render timeline:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getPropDiffs = definePageTool({
  name: 'get_prop_diffs',
  description: `Get prop changes between renders. Requires enable_react_debug. Note: prop diff collection is limited; full diffing may require additional instrumentation.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    limit: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of diffs to return. Default 20.'),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const limit = request.params.limit ?? 20;
    const result = await page.evaluate((lim: number) => {
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: {propDiffs?: unknown[]}}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled.'};
      }
      const diffs = (store.propDiffs || []).slice(0, lim);
      return {diffs, total: (store.propDiffs || []).length};
    }, limit);
    response.appendResponseLine('Prop diffs:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getStateUpdates = definePageTool({
  name: 'get_state_updates',
  description: `Get state/hook updates. Requires enable_react_debug. Note: state update collection is limited.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    limit: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of updates to return. Default 20.'),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const limit = request.params.limit ?? 20;
    const result = await page.evaluate((lim: number) => {
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: {stateUpdates?: unknown[]}}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled.'};
      }
      const updates = (store.stateUpdates || []).slice(0, lim);
      return {updates, total: (store.stateUpdates || []).length};
    }, limit);
    response.appendResponseLine('State updates:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getRenderCauses = definePageTool({
  name: 'get_render_causes',
  description: `Analyze why components re-rendered by correlating prop diffs and state updates with commit events. Requires enable_react_debug.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    limit: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of components to analyze. Default 20.'),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const limit = request.params.limit ?? 20;
    const result = await page.evaluate((lim: number) => {
      interface StoreShape {
        events?: Array<{componentNames?: string[]; timestamp?: number}>;
        propDiffs?: Array<{componentName?: string; propName?: string; prev?: unknown; next?: unknown; timestamp?: number}>;
        stateUpdates?: Array<{componentName?: string; prev?: unknown; next?: unknown; timestamp?: number}>;
      }
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: StoreShape}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled.'};
      }
      const propDiffs = store.propDiffs || [];
      const stateUpdates = store.stateUpdates || [];
      const componentMap: Record<string, {propChanges: string[]; stateChanged: boolean; renderCount: number; lastTimestamp: number}> = {};
      for (const d of propDiffs) {
        const name = d.componentName || 'Unknown';
        if (!componentMap[name]) {
          componentMap[name] = {propChanges: [], stateChanged: false, renderCount: 0, lastTimestamp: 0};
        }
        if (d.propName && componentMap[name].propChanges.indexOf(d.propName) === -1) {
          componentMap[name].propChanges.push(d.propName);
        }
        componentMap[name].lastTimestamp = Math.max(componentMap[name].lastTimestamp, d.timestamp || 0);
      }
      for (const u of stateUpdates) {
        const name = u.componentName || 'Unknown';
        if (!componentMap[name]) {
          componentMap[name] = {propChanges: [], stateChanged: false, renderCount: 0, lastTimestamp: 0};
        }
        componentMap[name].stateChanged = true;
        componentMap[name].lastTimestamp = Math.max(componentMap[name].lastTimestamp, u.timestamp || 0);
      }
      for (const ev of (store.events || [])) {
        for (const name of (ev.componentNames || [])) {
          if (componentMap[name]) {
            componentMap[name].renderCount++;
          }
        }
      }
      const causes = Object.entries(componentMap)
        .map(([name, info]) => {
          const reasons: string[] = [];
          if (info.propChanges.length > 0) {
            reasons.push('props changed: ' + info.propChanges.join(', '));
          }
          if (info.stateChanged) {
            reasons.push('state changed');
          }
          if (reasons.length === 0) {
            reasons.push('parent re-rendered');
          }
          return {componentName: name, reasons, propChanges: info.propChanges, stateChanged: info.stateChanged, renderCount: info.renderCount, lastTimestamp: info.lastTimestamp};
        })
        .sort((a, b) => b.lastTimestamp - a.lastTimestamp)
        .slice(0, lim);
      return {causes, total: Object.keys(componentMap).length};
    }, limit);
    response.appendResponseLine('Render causes:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});

export const getRenderDependencyGraph = definePageTool({
  name: 'get_render_dependency_graph',
  description: `Get parent-child render relationships. Returns a simplified dependency graph from the component tree.`,
  annotations: {
    category: ToolCategory.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {
    limit: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum depth for graph. Default 10.'),
  },
  handler: async (request, response, _context) => {
    const page = request.page.pptrPage;
    const limit = request.params.limit ?? 10;
    const result = await page.evaluate((maxDepth: number) => {
      const store = (window as unknown as {__REACT_DEBUG_STORE__?: {roots?: unknown[]}}).__REACT_DEBUG_STORE__;
      if (!store) {
        return {error: 'React debug not enabled.'};
      }
      const roots = store.roots || [];
      if (roots.length === 0) {
        return {error: 'No React roots. Navigate to a React app.'};
      }
      function getName(fiber: {type?: unknown} | null): string {
        if (!fiber || !fiber.type) {
          return 'Anonymous';
        }
        const t = fiber.type as string | {displayName?: string; name?: string};
        return typeof t === 'string' ? t : (t?.displayName || t?.name || 'Anonymous');
      }
      const edges: Array<{parent: string; child: string; parentName: string; childName: string}> = [];
      interface FiberLike {
        child?: FiberLike;
        sibling?: FiberLike;
        current?: FiberLike;
        type?: unknown;
      }
      function traverse(fiber: FiberLike | null | undefined, parentId: string, parentName: string, depth: number) {
        if (!fiber || depth > maxDepth) {
          return;
        }
        let child = fiber.child;
        let idx = 0;
        while (child) {
          const childId = parentId + '-' + idx;
          const childName = getName(child);
          edges.push({parent: parentId, child: childId, parentName, childName});
          traverse(child, childId, childName, depth + 1);
          child = child.sibling;
          idx++;
        }
      }
      roots.forEach((root: unknown, i: number) => {
        const r = (root as {current?: FiberLike}).current;
        if (r) {
          traverse(r, 'root-' + i, 'Root', 0);
        }
      });
      return {edges, rootCount: roots.length};
    }, limit);
    response.appendResponseLine('Render dependency graph:');
    response.appendResponseLine('```json');
    response.appendResponseLine(JSON.stringify(result, null, 2));
    response.appendResponseLine('```');
  },
});
