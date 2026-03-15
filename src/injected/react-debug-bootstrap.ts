/**
 * @license
 * React DevTools MCP - Bootstrap script for React debugging
 * SPDX-License-Identifier: Apache-2.0
 *
 * This script must run before React loads (via evaluateOnNewDocument).
 * It creates the __REACT_DEVTOOLS_GLOBAL_HOOK__ and stores fiber roots
 * for later inspection by MCP tools.
 */

/**
 * Bootstrap script as a string for evaluateOnNewDocument.
 * Creates the React DevTools hook and stores roots on commit.
 */
export const REACT_DEBUG_BOOTSTRAP = `
(function() {
  if (typeof window === 'undefined') return;
  if (window.__REACT_DEBUG_INSTALLED__) return;
  window.__REACT_DEBUG_INSTALLED__ = true;

  const store = {
    roots: [],
    events: [],
    propDiffs: [],
    stateUpdates: [],
    maxEvents: 100,
    maxDiffs: 200,
    error: null,
    reactVersion: null
  };
  window.__REACT_DEBUG_STORE__ = store;

  function getComponentName(fiber) {
    if (!fiber || !fiber.type) return 'Anonymous';
    var t = fiber.type;
    return typeof t === 'string' ? t : (t.displayName || t.name || 'Anonymous');
  }

  function safeForStore(v, depth) {
    depth = depth || 0;
    if (depth > 3) return '[Max depth]';
    if (v === null || v === undefined) return v;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'function') return '[Function]';
    if (typeof v === 'object') {
      if (typeof v.nodeType === 'number') return '[DOMNode]';
      try {
        var keys = Object.keys(v).slice(0, 8);
        var out = {};
        for (var i = 0; i < keys.length; i++) {
          try { out[keys[i]] = safeForStore(v[keys[i]], depth + 1); } catch (e) { out[keys[i]] = '[Error]'; }
        }
        return out;
      } catch (e) {
        return String(v).slice(0, 80);
      }
    }
    return String(v);
  }

  function isComposite(tag) {
    return tag === 0 || tag === 1 || tag === 2 || tag === 14 || tag === 15;
  }

  function collectChangedComponentNames(fiber, names, seen) {
    if (!fiber || seen.has(fiber)) return;
    seen.add(fiber);
    if (isComposite(fiber.tag)) {
      var alt = fiber.alternate;
      if (!alt || alt.memoizedProps !== fiber.memoizedProps || alt.memoizedState !== fiber.memoizedState) {
        var n = getComponentName(fiber);
        if (n && n !== 'Anonymous') names.push(n);
      }
    }
    if (fiber.child) collectChangedComponentNames(fiber.child, names, seen);
    if (fiber.sibling) collectChangedComponentNames(fiber.sibling, names, seen);
  }

  function diffFibers(fiber, ts) {
    var alt = fiber.alternate;
    if (!alt) return;
    if (!isComposite(fiber.tag)) return;
    var name = getComponentName(fiber);
    var prevProps = alt.memoizedProps;
    var nextProps = fiber.memoizedProps;
    if (prevProps !== nextProps && prevProps && nextProps && typeof prevProps === 'object' && typeof nextProps === 'object') {
      var allKeys = {};
      for (var k in prevProps) allKeys[k] = true;
      for (var k in nextProps) allKeys[k] = true;
      for (var k in allKeys) {
        if (k === 'children') continue;
        var p = prevProps[k];
        var n = nextProps[k];
        if (p !== n) {
          store.propDiffs.unshift({ componentName: name, propName: k, prev: safeForStore(p), next: safeForStore(n), timestamp: ts });
          if (store.propDiffs.length > store.maxDiffs) store.propDiffs.pop();
        }
      }
    }
    var prevState = alt.memoizedState;
    var nextState = fiber.memoizedState;
    if (prevState !== nextState) {
      store.stateUpdates.unshift({ componentName: name, prev: safeForStore(prevState), next: safeForStore(nextState), timestamp: ts });
      if (store.stateUpdates.length > store.maxDiffs) store.stateUpdates.pop();
    }
  }

  function traverseAndDiff(fiber, ts, seen) {
    if (!fiber || seen.has(fiber)) return;
    seen.add(fiber);
    try { diffFibers(fiber, ts); } catch (e) {}
    if (fiber.child) traverseAndDiff(fiber.child, ts, seen);
    if (fiber.sibling) traverseAndDiff(fiber.sibling, ts, seen);
  }

  const existingHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const hook = existingHook || {};
  const origOnCommit = hook.onCommitFiberRoot;
  const origInject = hook.inject;
  let nextRendererId = 1;

  hook.supportsFiber = true;
  hook.renderers = hook.renderers || new Map();

  hook.inject = function(internals) {
    const id = origInject ? origInject.call(this, internals) : nextRendererId++;
    if (internals && internals.version) {
      store.reactVersion = internals.version;
    }
    return id;
  };

  hook.onCommitFiberRoot = function(rendererID, root, schedulerPriority, didError) {
    try {
      if (root && root.current) {
        if (store.roots.indexOf(root) === -1) {
          store.roots.push(root);
        }
        var ts = Date.now();
        var componentNames = [];
        collectChangedComponentNames(root.current, componentNames, new Set());
        var event = {
          id: store.events.length,
          phase: 'commit',
          timestamp: ts,
          commitTime: ts,
          didError: !!didError,
          componentNames: componentNames.slice(0, 50)
        };
        store.events.unshift(event);
        if (store.events.length > store.maxEvents) {
          store.events.pop();
        }
        traverseAndDiff(root.current, ts, new Set());
      }
    } catch (e) {
      store.error = String(e);
    }
    if (origOnCommit) {
      origOnCommit.apply(this, arguments);
    }
  };

  if (typeof hook.onPostCommitFiberRoot === 'function') {
    var origPostCommit = hook.onPostCommitFiberRoot;
    hook.onPostCommitFiberRoot = function(rendererID, root) {
      if (origPostCommit) origPostCommit.apply(this, arguments);
    };
  }

  if (!existingHook) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }
})();
`;
