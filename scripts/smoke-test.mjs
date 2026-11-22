#!/usr/bin/env node
// ========================================================
// Backend smoke test (runs in CI on every PR, see .github/workflows/ci.yml)
// Starts the real server.ts against a throwaway data folder and checks:
//   - health + version, admin login, token expiry handling
//   - admin edits and deletes SURVIVE a restart with a newer bundled seed
//   - uploads accept real images only
//   - admin stays disabled when no password is configured
// Usage: npm run build && node scripts/smoke-test.mjs
// ========================================================

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'smokeTestPassword123';
const SECRET = 'smokeTestSecretValue0123456789';
const SEED = path.join(ROOT, 'src', 'data', 'galleries.json');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artgasht-smoke-'));
let server = null;

function start(extraEnv = {}) {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    DATA_DIR: dataDir,
    SERVER_ROLE: 'primary',
    SCRAPER_ENABLED: 'false',
    ADMIN_PASSWORD: PASSWORD,
    ADMIN_SECRET: SECRET,
    ...extraEnv
  };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete env[k];
  server = spawn('npx', ['tsx', 'server.ts'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => process.stdout.write(`  [server] ${d}`));
  server.stderr.on('data', (d) => process.stdout.write(`  [server] ${d}`));
  return waitForHealth();
}

async function stop() {
  if (!server) return;
  const s = server;
  server = null;
  await new Promise((resolve) => {
    s.on('exit', resolve);
    s.kill('SIGTERM');
    setTimeout(() => s.kill('SIGKILL'), 5000);
  });
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not become healthy in 30s');
}

const api = (p, opts = {}) => fetch(`${BASE}${p}`, opts);
const json = (body, token) => ({
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
});

const results = [];
async function step(name, fn) {
  await fn();
  results.push(name);
  console.log(`✔ ${name}`);
}

try {
  const appVersion = fs.readFileSync(path.join(ROOT, 'src/components/Header.tsx'), 'utf-8').match(/APP_VERSION = '([^']+)'/)[1];

  const health = await start();
  await step('health reports the current version and admin configured', async () => {
    assert.equal(health.status, 'ok');
    assert.equal(health.version, appVersion);
    assert.equal(health.adminConfigured, true);
    assert.equal(health.adminEnabled, true);
  });

  let token;
  await step('wrong password is rejected, right password returns an expiring token', async () => {
    const bad = await api('/api/admin/login', { method: 'POST', ...json({ password: 'nope' }) });
    assert.equal(bad.status, 401);
    const ok = await api('/api/admin/login', { method: 'POST', ...json({ password: PASSWORD }) });
    assert.equal(ok.status, 200);
    token = (await ok.json()).token;
    const [exp] = token.split('.');
    assert.ok(Number(exp) > Date.now(), 'token carries a future expiry');
  });

  await step('forged and expired tokens are rejected', async () => {
    const forged = await api('/api/admin/galleries/1', { method: 'PUT', ...json({ name: 'x' }, 'abc') });
    assert.equal(forged.status, 401);
    const [, sig] = token.split('.');
    const expired = await api('/api/admin/galleries/1', { method: 'PUT', ...json({ name: 'x' }, `1000.${sig}`) });
    assert.equal(expired.status, 401);
  });

  const list = await (await api('/api/galleries')).json();
  const [editTarget, deleteTarget] = list;
  const editedName = `smoke-edit-${Date.now()}`;

  await step('admin can edit and delete', async () => {
    const put = await api(`/api/admin/galleries/${editTarget.id}`, { method: 'PUT', ...json({ name: editedName }, token) });
    assert.equal(put.status, 200);
    const del = await api(`/api/admin/galleries/${deleteTarget.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(del.status, 200);
    const after = await (await api('/api/galleries')).json();
    assert.ok(after.some((g) => g.id === editTarget.id && g.name === editedName), 'edit visible');
    assert.ok(!after.some((g) => g.id === deleteTarget.id), 'deleted gallery hidden');
  });

  await step('uploads accept a real PNG and reject SVG/HTML', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const ok = await api('/api/admin/upload', {
      method: 'POST',
      ...json({ filename: 'a.png', base64Data: `data:image/png;base64,${png.toString('base64')}` }, token)
    });
    assert.equal(ok.status, 200);
    assert.match((await ok.json()).url, /\.png$/);

    for (const [mime, body] of [
      ['image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
      ['text/html', '<html><script>alert(1)</script></html>']
    ]) {
      const bad = await api('/api/admin/upload', {
        method: 'POST',
        ...json({ filename: 'x', base64Data: `data:${mime};base64,${Buffer.from(body).toString('base64')}` }, token)
      });
      assert.equal(bad.status, 415, `${mime} must be rejected`);
    }
  });

  await stop();

  await step('edits and deletes survive a restart with a newer bundled seed (deploy simulation)', async () => {
    const now = new Date();
    fs.utimesSync(SEED, now, now); // seed looks freshly built, like after a deploy
    await start();
    const after = await (await api('/api/galleries')).json();
    assert.ok(after.some((g) => g.id === editTarget.id && g.name === editedName), 'edit survived restart');
    assert.ok(!after.some((g) => g.id === deleteTarget.id), 'delete survived restart');
  });

  await stop();

  await step('admin is disabled when no password is configured', async () => {
    const h = await start({ ADMIN_PASSWORD: undefined, ADMIN_SECRET: undefined });
    assert.equal(h.adminConfigured, false);
    assert.equal(h.adminEnabled, false);
    const login = await api('/api/admin/login', { method: 'POST', ...json({ password: 'artgasht2026' }) });
    assert.equal(login.status, 403);
  });

  console.log(`\nAll ${results.length} smoke checks passed.`);
} catch (err) {
  console.error('\n✘ Smoke test failed:', err);
  process.exitCode = 1;
} finally {
  await stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
