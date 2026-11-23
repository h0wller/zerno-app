#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { chromium } from '@playwright/test';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(command + ' exited with code ' + (code ?? 'null') + ' (signal ' + (signal ?? 'none') + ')'));
    });
  });
}

async function waitForDebuggingPort(profileDir, chromeProcess) {
  const activePortFile = path.join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (chromeProcess.exitCode !== null) {
      throw new Error('Chrome exited before opening DevTools (code ' + chromeProcess.exitCode + ')');
    }
    try {
      const [port] = (await fs.readFile(activePortFile, 'utf8')).trim().split(/\r?\n/);
      const parsed = Number(port);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    } catch {}
    await delay(100);
  }
  throw new Error('Timed out waiting for Chrome DevToolsActivePort');
}

async function stopChrome(chromeProcess) {
  if (chromeProcess.exitCode !== null) return;
  chromeProcess.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => chromeProcess.once('exit', resolve)),
    delay(4_000)
  ]);
  if (chromeProcess.exitCode === null) chromeProcess.kill('SIGKILL');
}

const [targetUrl, reportPath] = process.argv.slice(2);
const chromePath = process.env.CHROME_PATH;
const tokenFile = process.env.LCP_STAFF_TOKEN_FILE;
if (!targetUrl || !reportPath || !chromePath || !tokenFile) {
  throw new Error('Usage: CHROME_PATH=... LCP_STAFF_TOKEN_FILE=... node scripts/lighthouse-authenticated.mjs <url> <report.json>');
}
const token = (await fs.readFile(tokenFile, 'utf8')).trim();
if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error('Lighthouse staff fixture token is invalid');

const origin = new URL(targetUrl).origin;
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zerno-lighthouse-auth-'));
let chromeProcess;
let browser;

try {
  chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profileDir,
    'about:blank'
  ], { stdio: 'ignore' });

  const port = await waitForDebuggingPort(profileDir, chromeProcess);
  browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { timeout: 15_000 });
  const context = browser.contexts()[0];
  if (!context) throw new Error('Chrome did not expose its default browser context');

  const page = await context.newPage();
  await page.goto(origin + '/api/health', { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.evaluate(sessionToken => {
    localStorage.setItem('zt_user', sessionToken);
    localStorage.setItem('zt_brand', 'coffee');
    localStorage.setItem('zt_onb', '1');
    localStorage.setItem('zt_inst_hide', '1');
  }, token);
  const verifiedRole = await page.evaluate(async () => {
    const sessionToken = localStorage.getItem('zt_user');
    const response = await fetch('/api/me', {
      headers: { Authorization: 'Bearer ' + sessionToken }
    });
    if (!response.ok) throw new Error('Lighthouse fixture /api/me returned HTTP ' + response.status);
    const payload = await response.json();
    return payload.customer?.role || '';
  });
  if (verifiedRole !== 'admin') {
    throw new Error('Lighthouse staff fixture was not verified as admin by /api/me');
  }
  await page.close();
  await browser.close();
  browser = null;

  console.log('[lighthouse-authenticated] Seeded an isolated admin session in local Chrome storage.');
  await run('npx', [
    '--yes',
    'lighthouse@13.5.0',
    targetUrl,
    '--port=' + port,
    '--form-factor=mobile',
    '--throttling-method=simulate',
    '--throttling.rttMs=150',
    '--throttling.throughputKbps=1638.4',
    '--throttling.cpuSlowdownMultiplier=4',
    '--screenEmulation.mobile=true',
    '--screenEmulation.width=360',
    '--screenEmulation.height=800',
    '--screenEmulation.deviceScaleFactor=1.75',
    '--only-categories=performance',
    '--max-wait-for-load=45000',
    '--output=json',
    '--output-path=' + reportPath,
    '--quiet'
  ]);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (chromeProcess) await stopChrome(chromeProcess);
  await fs.rm(profileDir, { recursive: true, force: true });
}
