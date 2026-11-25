import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const auditPath = path.join(repoRoot, 'scripts/audit-observers.mjs');

function runAuditWithHtml(html, { copyApp = false, extraFiles = {} } = {}) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'zerno-observer-audit-'));
  try {
    const appPath = path.join(tempRoot, 'public/app');
    mkdirSync(path.dirname(appPath), { recursive: true });
    if (copyApp) cpSync(path.join(repoRoot, 'public/app'), appPath, { recursive: true });
    else symlinkSync(path.join(repoRoot, 'public/app'), appPath, 'dir');
    writeFileSync(path.join(tempRoot, 'public/index.html'), html);
    for (const [relativePath, content] of Object.entries(extraFiles)) {
      const target = path.join(tempRoot, relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    return spawnSync(process.execPath, [auditPath], { cwd: tempRoot, encoding: 'utf8' });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

const outputOf = (result) => `${result.stdout || ''}\n${result.stderr || ''}`;

test('rejects a MutationObserver targeting document.documentElement in inline HTML', () => {
  const result = runAuditWithHtml(`\n<html><body>\n<script id="forbidden-observer">\nnew MutationObserver(() => {}).observe(\ndocument.documentElement, { attributes: true });\n</script>\n</body></html>`);
  assert.notEqual(result.status, 0);
  assert.match(outputOf(result), /public\/index\.html inline script #1/i);
  assert.match(outputOf(result), /forbidden-observer/);
});

test('rejects a MutationObserver targeting document.body across multiline formatting', () => {
  const result = runAuditWithHtml(`<script id="body-guard">\nconst observer = new MutationObserver(() => {});\nobserver\n.observe\n(\ndocument\n.body, { childList: true }\n);\n</script>`);
  assert.notEqual(result.status, 0);
  assert.match(outputOf(result), /document\.body/i);
  assert.match(outputOf(result), /body-guard/);
});

test('does not inspect external, JSON, or import-map scripts', () => {
  const result = runAuditWithHtml(`
    <script async src="/external.js">new MutationObserver(() => {}).observe(document.body, {});</script>
    <script type="application/json" id="json-data">{"observer":"new MutationObserver"}</script>
    <script type="importmap">{"imports":{}}</script>
    <script id="empty"></script>
    <script type="text/javascript" id="safe-inline">window.inlineBooted = true;</script>
  `);
  assert.equal(result.status, 0, outputOf(result));
});

test('analyzes multiple inline scripts independently and reports id and line', () => {
  const result = runAuditWithHtml(`<script id="first-safe">window.first = true;</script>\n<script data-kind="bootstrap" id="second-bad">\nnew MutationObserver(() => {}).observe(document.body, {});\n</script>`);
  assert.notEqual(result.status, 0);
  assert.match(outputOf(result), /inline script #2 \(id="second-bad"\), line 2/i);
});

test('does not treat MutationObserver mentions in comments, strings, or regex literals as code', () => {
  const result = runAuditWithHtml(`<script id="comment-only">\n// new MutationObserver(() => {}).observe(document.body, {});\n/* new MutationObserver(() => {}).observe(document.documentElement, {}); */\nconst url = "https://example.test/path";\nconst pattern = /new MutationObserver\\(\\)/;\n</script>`);
  assert.equal(result.status, 0, outputOf(result));
});

test('detects observers inside template-literal expressions', () => {
  const result = runAuditWithHtml("<script id=\"template-expression\">\nconst text = `value: ${new MutationObserver(() => {})}`;\n</script>");
  assert.notEqual(result.status, 0);
  assert.match(outputOf(result), /template-expression/);
});

test('does not stop at an escaped script closing sequence inside inline JavaScript', () => {
  const result = runAuditWithHtml(`<script id="escaped-close">\nconst text = '<\\/script>';\nnew MutationObserver(() => {}).observe(document.body, {});\n</script>`);
  assert.notEqual(result.status, 0);
  assert.match(outputOf(result), /escaped-close/);
});

test('keeps the existing isolated-container observer allowlist working', () => {
  const result = runAuditWithHtml('<script id="empty"></script>');
  assert.equal(result.status, 0, outputOf(result));
  assert.match(result.stdout, /цели изолированы, квота соблюдена/);
});

test('continues to reject forbidden targets in external JavaScript files', () => {
  const result = runAuditWithHtml('<script></script>', {
    copyApp: true,
    extraFiles: { 'public/app/unlisted-observer.js': 'new MutationObserver(() => {}).observe(document.body, {});' }
  });
  assert.notEqual(result.status, 0);
  assert.match(outputOf(result), /public\/app\/unlisted-observer\.js/);
});

test('the repository public/index.html passes the observer audit', () => {
  const result = spawnSync(process.execPath, [auditPath], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, outputOf(result));
});
