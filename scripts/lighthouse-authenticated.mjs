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
    if (chromeProcess.exitCode !== null || chromeProcess.signalCode !== null) {
      throw new Error('Chrome exited before opening DevTools (code ' + chromeProcess.exitCode + ', signal ' + chromeProcess.signalCode + ')');
    }
    try {
      const [port] = (await fs.readFile(activePortFile, 'utf8')).trim().split(/\\r?\\n/);
      const parsed = Number(port);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    } catch {}
    await delay(100);
  }
  throw new Error('Timed out waiting for Chrome DevToolsActivePort');
}

function waitForChromeExit(chromeProcess, timeoutMs, signal) {
  if (chromeProcess.exitCode !== null || chromeProcess.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      chromeProcess.removeListener('exit', onExit);
      chromeProcess.removeListener('error', onError);
    };
    const onExit = () => {
      cleanup();
      resolve();
    };
    const onError = error => {
      cleanup();
      reject(error);
    };
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Chrome to exit after ' + signal));
    }, timeoutMs);

    chromeProcess.once('exit', onExit);
    chromeProcess.once('error', onError);

    // Close the race between the state check and listener registration.
    if (chromeProcess.exitCode !== null || chromeProcess.signalCode !== null) onExit();
  });
}

async function stopChrome(chromeProcess) {
  if (chromeProcess.exitCode !== null || chromeProcess.signalCode !== null) return;

  chromeProcess.kill('SIGTERM');
  try {
    await waitForChromeExit(chromeProcess, 4_000, 'SIGTERM');
    return;
  } catch (error) {
    if (chromeProcess.exitCode !== null || chromeProcess.signalCode !== null) return;
    if (error.message !== 'Timed out waiting for Chrome to exit after SIGTERM') throw error;
  }

  chromeProcess.kill('SIGKILL');
  await waitForChromeExit(chromeProcess, 4_000, 'SIGKILL');
}

async function removeProfile(profileDir) {
  await fs.rm(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200
  });
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
let primaryError;

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
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (chromeProcess) {
    try {
      await stopChrome(chromeProcess);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await removeProfile(profileDir);
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (primaryError && cleanupErrors.length) {
    primaryError = new AggregateError(
      [primaryError, ...cleanupErrors],
      'Lighthouse run failed and cleanup reported additional errors'
    );
  } else if (cleanupErrors.length === 1) {
    primaryError = cleanupErrors[0];
  } else if (cleanupErrors.length > 1) {
    primaryError = new AggregateError(cleanupErrors, 'Lighthouse cleanup failed');
  }
}

if (primaryError) {
  throw primaryError;
}
