# React Debug Tools — AI Agent Guide

This document is for AI agents that call the React debugging MCP tools. It describes when to call each tool, what parameters to pass, and what to expect in responses.

---

## Required Call Order

1. **Always call `enable_react_debug` first** — before navigating to a React app or before the page loads React.
2. **Then navigate** to the target page (or reload if already on a React app).
3. **Then call any other tool** — `get_react_debug_status`, `get_react_component_tree`, etc.

If you skip step 1, all other tools will return `{ error: "React debug not enabled." }`.

---

## Tool Reference

### 1. `enable_react_debug`

**When to call:** Before navigating to a React app, or when you need to start debugging React on the current page (then reload).

**Parameters:** None.

**Success response:**
```json
{
  "success": true,
  "message": "React debug hook installed"
}
```

**Error response:**
```json
{
  "success": false,
  "error": "<error message>"
}
```

---

### 2. `get_react_debug_status`

**When to call:** To check if React is detected and debug is active. Use after `enable_react_debug` + navigation to verify setup.

**Parameters:** None.

**Success response:**
```json
{
  "debugEnabled": true,
  "reactDetected": true,
  "rootCount": 1,
  "hasHook": true,
  "hasRenderers": true,
  "reactVersion": "18.2.0"
}
```

**When debug not enabled:**
```json
{
  "debugEnabled": false,
  "reactDetected": false,
  "rootCount": 0,
  "hasHook": false,
  "hasRenderers": false,
  "reactVersion": null
}
```

---

### 3. `get_react_component_tree`

**When to call:** To inspect the React component hierarchy — names, types, props, state, and children. Use when you need to understand the app structure or find a specific component.

**Parameters:**

| Name     | Type   | Required | Default | Description                                      |
|----------|--------|----------|---------|--------------------------------------------------|
| maxDepth | number | No       | -1      | Max depth to traverse. Use 5–10 for large trees. |

**Success response:**
```json
{
  "tree": {
    "id": "0",
    "name": "App",
    "type": "function",
    "tag": 0,
    "children": [
      {
        "id": "0-0",
        "name": "Header",
        "type": "function",
        "props": { "title": "Hello" },
        "state": { "memoizedState": 0 },
        "children": []
      }
    ]
  },
  "trees": [...],
  "rootCount": 1,
  "reactVersion": "18.2.0"
}
```

**Error response:**
```json
{
  "error": "React debug not enabled. Call enable_react_debug first, then navigate or reload the page."
}
```
or
```json
{
  "error": "React not detected. Ensure the page has loaded a React app. Try calling enable_react_debug, then navigate to the React app."
}
```

---

### 4. `get_react_render_events`

**When to call:** To see recent React commit/render events. Use after a user action (click, input) to see what re-rendered. Events are newest-first.

**Parameters:**

| Name  | Type   | Required | Default | Description                    |
|-------|--------|----------|---------|--------------------------------|
| limit | number | No       | 20      | Max number of events to return |

**Success response:**
```json
{
  "events": [
    {
      "id": 5,
      "phase": "commit",
      "timestamp": 1700000000000,
      "commitTime": 1700000000000,
      "didError": false,
      "componentNames": ["Counter", "App"]
    }
  ],
  "total": 5
}
```

**Error response:**
```json
{
  "error": "React debug not enabled."
}
```

---

### 5. `get_react_render_timeline`

**When to call:** When you need a chronological view of commits with timing (oldest-first). Use for performance analysis or to see gaps between renders.

**Parameters:**

| Name  | Type   | Required | Default | Description                    |
|-------|--------|----------|---------|--------------------------------|
| limit | number | No       | 50      | Max number of timeline entries |

**Success response:**
```json
{
  "timeline": [
    {
      "index": 0,
      "id": 0,
      "relativeMs": 0,
      "gapFromPrevMs": 0,
      "timestamp": 1700000000000,
      "didError": false,
      "componentNames": ["App"]
    },
    {
      "index": 1,
      "id": 1,
      "relativeMs": 150,
      "gapFromPrevMs": 150,
      "timestamp": 1700000000150,
      "didError": false,
      "componentNames": ["Counter", "App"]
    }
  ],
  "total": 2,
  "spanMs": 150
}
```

---

### 6. `get_prop_diffs`

**When to call:** After a re-render to see which props changed on which components. Use when debugging "why did this component re-render?" — prop changes are a common cause.

**Parameters:**

| Name  | Type   | Required | Default | Description                 |
|-------|--------|----------|---------|-----------------------------|
| limit | number | No       | 20      | Max number of diffs to return |

**Success response:**
```json
{
  "diffs": [
    {
      "componentName": "ListItem",
      "propName": "item",
      "prev": { "id": 1, "name": "Old" },
      "next": { "id": 2, "name": "New" },
      "timestamp": 1700000000000
    }
  ],
  "total": 1
}
```

**Note:** On initial mount there is no prior state, so `diffs` may be empty. Diffs appear after subsequent renders.

---

### 7. `get_state_updates`

**When to call:** After a user interaction (e.g. button click) to see which components had state changes. Use when debugging state-driven re-renders.

**Parameters:**

| Name  | Type   | Required | Default | Description                    |
|-------|--------|----------|---------|--------------------------------|
| limit | number | No       | 20      | Max number of updates to return |

**Success response:**
```json
{
  "updates": [
    {
      "componentName": "Counter",
      "prev": 0,
      "next": 1,
      "timestamp": 1700000000000
    }
  ],
  "total": 1
}
```

---

### 8. `get_render_causes`

**When to call:** To get an analyzed summary of why components re-rendered. Correlates prop diffs and state updates into human-readable reasons. Use when you want a quick "what caused this render?" answer.

**Parameters:**

| Name  | Type   | Required | Default | Description                         |
|-------|--------|----------|---------|-------------------------------------|
| limit | number | No       | 20      | Max number of components to analyze |

**Success response:**
```json
{
  "causes": [
    {
      "componentName": "Counter",
      "reasons": ["state changed"],
      "propChanges": [],
      "stateChanged": true,
      "renderCount": 2,
      "lastTimestamp": 1700000000000
    },
    {
      "componentName": "ListItem",
      "reasons": ["props changed: item"],
      "propChanges": ["item"],
      "stateChanged": false,
      "renderCount": 1,
      "lastTimestamp": 1700000000000
    }
  ],
  "total": 2
}
```

**`reasons` values:** `"props changed: <propNames>"`, `"state changed"`, or `"parent re-rendered"` (when no direct prop/state change detected).

---

### 9. `get_render_dependency_graph`

**When to call:** To see the parent-child component hierarchy as a graph. Use when you need to understand render propagation or component relationships.

**Parameters:**

| Name  | Type   | Required | Default | Description              |
|-------|--------|----------|---------|--------------------------|
| limit | number | No       | 10      | Max depth for the graph  |

**Success response:**
```json
{
  "edges": [
    {
      "parent": "root-0",
      "child": "root-0-0",
      "parentName": "Root",
      "childName": "App"
    },
    {
      "parent": "root-0-0",
      "child": "root-0-0-0",
      "parentName": "App",
      "childName": "Counter"
    }
  ],
  "rootCount": 1
}
```

**Error response:**
```json
{
  "error": "No React roots. Navigate to a React app."
}
```

---

## Error Handling

All tools return `{ error: "<message>" }` when:

- React debug is not enabled: call `enable_react_debug` first.
- React is not detected: the page may not be a React app, or the page was loaded before React. Ensure the page has loaded a React app and reload after `enable_react_debug`.

**Always check for `error` in the response before parsing other fields.**

---

## Workflow Examples

### Inspect app structure

1. `enable_react_debug`
2. Navigate to the React app
3. `get_react_debug_status` (verify `reactDetected: true`)
4. `get_react_component_tree` (optionally with `maxDepth: 10` for large trees)

### Debug why a component re-rendered after a click

1. `enable_react_debug` + navigate
2. Perform the user action (e.g. click)
3. `get_render_causes` — quick summary of reasons
4. Or `get_state_updates` + `get_prop_diffs` — detailed changes
5. `get_react_render_events` — which components rendered

### Analyze render timing

1. `enable_react_debug` + navigate
2. Perform several actions
3. `get_react_render_timeline` — chronological order, `gapFromPrevMs`, `spanMs`

### Map component hierarchy

1. `enable_react_debug` + navigate
2. `get_render_dependency_graph` — edges with `parentName` and `childName`

---

## Decision Flow: Which Tool to Use?

| Goal | Tool(s) |
|------|---------|
| Start debugging | `enable_react_debug` |
| Verify setup | `get_react_debug_status` |
| See component tree | `get_react_component_tree` |
| See what rendered recently | `get_react_render_events` |
| See render timing | `get_react_render_timeline` |
| See prop changes | `get_prop_diffs` |
| See state changes | `get_state_updates` |
| See why components re-rendered | `get_render_causes` |
| See parent-child hierarchy | `get_render_dependency_graph` |

---

## Limitations

- **Minified builds:** Component names may show as `"Anonymous"`.
- **Non-serializable values:** DOM nodes, functions in props/state are replaced with placeholders like `[DOMNode]`, `[Function]`.
- **Initial mount:** No prop diffs on first render (no alternate fiber yet).
- **Multiple roots:** Use `rootCount` and `trees` to distinguish.
