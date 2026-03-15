/**
 * @license
 * React DevTools MCP - React tools tests
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import {fileURLToPath} from 'node:url';

import assert from 'node:assert';
import {beforeEach, describe, it} from 'node:test';

import {
  enableReactDebug,
  getPropDiffs,
  getReactComponentTree,
  getReactDebugStatus,
  getReactRenderEvents,
  getStateUpdates,
} from '../../src/tools/react.js';
import {serverHooks} from '../server.js';
import {html, withMcpContext} from '../utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getReactAppHtml(scriptBaseUrl: string) {
  return html`
    <div id="root"></div>
    <script src="${scriptBaseUrl}/react.js"></script>
    <script src="${scriptBaseUrl}/react-dom.js"></script>
    <script>
      const App = function App() {
        return React.createElement('div', { className: 'app' }, 'Hello React');
      };
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    </script>
  `;
}

function getReactAppWithStateHtml(scriptBaseUrl: string) {
  return html`
    <div id="root"></div>
    <script src="${scriptBaseUrl}/react.js"></script>
    <script src="${scriptBaseUrl}/react-dom.js"></script>
    <script>
      const Counter = function Counter() {
        const [count, setCount] = React.useState(0);
        return React.createElement('button', {
          onClick: function() { setCount(count + 1); },
          'data-testid': 'counter'
        }, 'Count: ' + count);
      };
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(Counter));
    </script>
  `;
}

describe('react', () => {
  const server = serverHooks();

  beforeEach(() => {
    const projectRoot = path.join(__dirname, '../..');
    const reactPath = path.join(
      projectRoot,
      'node_modules/react/umd/react.development.js',
    );
    const reactDomPath = path.join(
      projectRoot,
      'node_modules/react-dom/umd/react-dom.development.js',
    );
    server.addFileRoute('/react.js', reactPath, 'application/javascript');
    server.addFileRoute('/react-dom.js', reactDomPath, 'application/javascript');
    server.addHtmlRoute('/react-app', getReactAppHtml(server.baseUrl));
    server.addHtmlRoute('/react-app-state', getReactAppWithStateHtml(server.baseUrl));
  });

  describe('enable_react_debug', () => {
    it('injects the React debug hook', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.strictEqual(parsed.success, true);
      });
    });
  });

  describe('get_react_debug_status', () => {
    it('returns status when debug not enabled', async () => {
      await withMcpContext(async (response, context) => {
        await getReactDebugStatus.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.strictEqual(parsed.debugEnabled, false);
      });
    });

    it('returns status when debug enabled and React loaded', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        await context.getSelectedPptrPage().goto(server.getRoute('/react-app'));
        await new Promise(r => setTimeout(r, 500));

        response.resetResponseLineForTesting();
        await getReactDebugStatus.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.strictEqual(parsed.debugEnabled, true);
        assert.strictEqual(parsed.reactDetected, true);
      });
    });
  });

  describe('get_react_component_tree', () => {
    it('returns error when React debug not enabled', async () => {
      await withMcpContext(async (response, context) => {
        await getReactComponentTree.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.ok(parsed.error);
        assert.ok(parsed.error.includes('React debug not enabled'));
      });
    });

    it('returns error when React not detected', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        await context.getSelectedPptrPage().setContent(html`<h1>No React here</h1>`);

        response.resetResponseLineForTesting();
        await getReactComponentTree.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.ok(parsed.error);
        assert.ok(parsed.error.includes('React not detected'));
      });
    });

    it('returns component tree for React app', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        await context.getSelectedPptrPage().goto(server.getRoute('/react-app'));
        await new Promise(r => setTimeout(r, 500));

        response.resetResponseLineForTesting();
        await getReactComponentTree.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.ok(!parsed.error, `Expected no error, got: ${parsed.error}`);
        assert.ok(parsed.tree);
        assert.ok(parsed.rootCount >= 1);
        assert.ok(parsed.tree.name === 'App' || parsed.tree.children);
      });
    });
  });

  describe('get_react_render_events', () => {
    it('returns events when React has rendered', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        await context.getSelectedPptrPage().goto(server.getRoute('/react-app'));
        await new Promise(r => setTimeout(r, 500));

        response.resetResponseLineForTesting();
        await getReactRenderEvents.handler(
          {params: {limit: 10}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.ok(!parsed.error);
        assert.ok(Array.isArray(parsed.events));
      });
    });
  });

  describe('get_prop_diffs', () => {
    it('returns empty diffs on initial render (no prior state)', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        await context.getSelectedPptrPage().goto(server.getRoute('/react-app'));
        await new Promise(r => setTimeout(r, 300));

        response.resetResponseLineForTesting();
        await getPropDiffs.handler(
          {params: {limit: 20}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.ok(!parsed.error);
        assert.ok(Array.isArray(parsed.diffs));
        assert.ok(typeof parsed.total === 'number');
      });
    });
  });

  describe('get_state_updates', () => {
    it('returns state updates after user interaction', async () => {
      await withMcpContext(async (response, context) => {
        await enableReactDebug.handler(
          {params: {}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        await context.getSelectedPptrPage().goto(server.getRoute('/react-app-state'));
        await new Promise(r => setTimeout(r, 300));

        const page = context.getSelectedPptrPage();
        const button = await page.$('[data-testid="counter"]');
        assert.ok(button, 'Counter button should exist');
        await button.click();
        await new Promise(r => setTimeout(r, 300));

        response.resetResponseLineForTesting();
        await getStateUpdates.handler(
          {params: {limit: 20}, page: context.getSelectedMcpPage()},
          response,
          context,
        );
        const lastLine = response.responseLines.at(-2);
        assert.ok(lastLine);
        const parsed = JSON.parse(lastLine);
        assert.ok(!parsed.error);
        assert.ok(Array.isArray(parsed.updates));
        assert.ok(parsed.updates.length > 0, 'Should have state updates after click');
        const counterUpdate = parsed.updates.find(
          (u: {componentName?: string}) => u.componentName === 'Counter',
        );
        assert.ok(counterUpdate, 'Should have a state update for Counter component');
      });
    });
  });
});
