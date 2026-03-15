#!/usr/bin/env node
/**
 * E2E test for React debug tools on a real page.
 * Usage: node scripts/test-react-tools-e2e.mjs
 *
 * Prerequisites:
 * - App running at http://localhost:5173
 * - Login: 9535888738 / kamal123
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

function runCli(...args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [
        path.join(PROJECT_ROOT, 'build/src/bin/chrome-devtools.js'),
        ...args,
        '--output-format',
        'json',
      ],
      { cwd: PROJECT_ROOT, stdio: ['inherit', 'pipe', 'pipe'] }
    );
    let out = '';
    let err = '';
    proc.stdout?.on('data', (d) => (out += d.toString()));
    proc.stderr?.on('data', (d) => (err += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(out || '{}'));
        } catch {
          resolve(out || {});
        }
      } else {
        reject(new Error(err || out || `Exit ${code}`));
      }
    });
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const TOOLS_TO_TEST = [
  { name: 'enable_react_debug', args: {} },
  { name: 'get_react_debug_status', args: {} },
  { name: 'get_react_component_tree', args: { maxDepth: 5 } },
  { name: 'get_react_render_events', args: { limit: 10 } },
  { name: 'get_react_render_timeline', args: { limit: 10 } },
  { name: 'get_prop_diffs', args: { limit: 10 } },
  { name: 'get_state_updates', args: { limit: 10 } },
  { name: 'get_render_causes', args: { limit: 10 } },
  { name: 'get_render_dependency_graph', args: { limit: 10 } },
];

async function main() {
  const results = [];
  const TARGET_URL = 'http://localhost:5173/chat/694788a0d40b2f3effa7933f';

  console.log('=== React Debug Tools E2E Test ===\n');

  // 1. Start server
  console.log('1. Starting MCP server...');
  try {
    await runCli('start', '--no-headless');
  } catch (e) {
    console.log('   (Server may already be running)');
  }
  await sleep(3000);

  // 2. enable_react_debug first
  console.log('2. enable_react_debug');
  try {
    const r = await runCli('enable_react_debug');
    console.log('   Result:', JSON.stringify(r, null, 2).slice(0, 200));
    results.push({ tool: 'enable_react_debug', ok: !r.error, result: r });
  } catch (e) {
    results.push({ tool: 'enable_react_debug', ok: false, error: String(e) });
    console.error('   Error:', e.message);
  }

  // 3. Navigate
  console.log('3. navigate_page to', TARGET_URL);
  try {
    await runCli('navigate_page', '--type', 'url', '--url', TARGET_URL);
    await sleep(3000);
  } catch (e) {
    console.error('   Error:', e.message);
  }

  // 4. Try to login via evaluate_script
  console.log('4. Attempting login via evaluate_script...');
  try {
    const loginResult = await runCli('evaluate_script', '--function', `() => {
      const inputs = document.querySelectorAll('input');
      let phone, pass;
      for (const i of inputs) {
        if (i.type === 'password') pass = i;
        else if (i.type === 'tel' || i.placeholder?.includes('phone') || i.name?.includes('phone') || i.placeholder?.includes('number')) phone = i;
      }
      if (!phone) phone = inputs[0];
      if (phone) { phone.value = '9535888738'; phone.dispatchEvent(new Event('input', { bubbles: true })); }
      if (pass) { pass.value = 'kamal123'; pass.dispatchEvent(new Event('input', { bubbles: true })); }
      const btn = document.querySelector('button[type="submit"]') || document.querySelector('button') || document.querySelector('input[type="submit"]');
      if (btn) { btn.click(); return { clicked: true }; }
      return { found: !!phone && !!pass, clicked: false };
    }`);
    console.log('   Login result:', JSON.stringify(loginResult));
    await sleep(3000);
  } catch (e) {
    console.log('   Login may need manual step. Error:', e.message);
  }

  // 5. Reload to ensure React debug hook is active
  console.log('5. Reloading page...');
  try {
    await runCli('navigate_page', '--type', 'reload');
    await sleep(3000);
  } catch (e) {
    console.error('   Error:', e.message);
  }

  // 6. Test each React tool (skip enable_react_debug, already done)
  for (const { name, args } of TOOLS_TO_TEST) {
    if (name === 'enable_react_debug') continue;
    console.log(`\n6. Testing ${name}`);
    try {
      const argList = [];
      for (const [k, v] of Object.entries(args)) {
        argList.push(`--${k}`, String(v));
      }
      const r = await runCli(name, ...argList);
      const hasError = r?.error != null;
      results.push({ tool: name, ok: !hasError, result: r });
      console.log('   OK:', !hasError, hasError ? r?.error : '(see result)');
    } catch (e) {
      results.push({ tool: name, ok: false, error: String(e) });
      console.error('   Error:', e.message);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  results.forEach((r) => {
    console.log(`  ${r.tool}: ${r.ok ? 'PASS' : 'FAIL'}`);
  });

  const outPath = path.join(PROJECT_ROOT, 'scripts/react-tools-e2e-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log('\nFull results saved to', outPath);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
