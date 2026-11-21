#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPORT_NAME = /^(base|head)-(coffee|delivery)-([1-9]\d*)\.json$/;
const BUCKETS = [
  ['base', 'coffee'],
  ['base', 'delivery'],
  ['head', 'coffee'],
  ['head', 'delivery']
];
const BREAKDOWN_KEYS = [
  'timeToFirstByte',
  'resourceLoadDelay',
  'resourceLoadDuration',
  'elementRenderDelay'
];

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function requiredNumber(value, description) {
  if (!finiteNumber(value)) {
    throw new Error(`Lighthouse report is missing a finite observed LCP metric: ${description}`);
  }
  return value;
}

function auditItems(report, auditId) {
  const items = report?.audits?.[auditId]?.details?.items;
  return Array.isArray(items) ? items : [];
}

function median(values) {
  const numbers = values.filter(finiteNumber).sort((left, right) => left - right);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2
    ? numbers[middle]
    : (numbers[middle - 1] + numbers[middle]) / 2;
}

/**
 * Parse one Lighthouse JSON report without mixing Lantern-simulated metrics
 * with observed trace metrics. In simulate mode those values are different
 * measurements and must not be added together.
 */
export function parseLighthouseRecord(filename, report) {
  const match = path.basename(String(filename)).match(REPORT_NAME);
  if (!match) {
    throw new Error(`Expected a Lighthouse filename matching base|head-coffee|delivery-N.json, received: ${filename}`);
  }

  if (!report || typeof report !== 'object' || !report.audits) {
    throw new Error(`Invalid Lighthouse report payload: ${filename}`);
  }

  const [, version, brand, sampleNumber] = match;
  const audits = report.audits;
  const metrics = audits.metrics?.details?.items?.[0];
  const observedLcpMs = requiredNumber(
    metrics?.observedLargestContentfulPaint,
    `${filename} audits.metrics.observedLargestContentfulPaint`
  );
  const observedFcpMs = requiredNumber(
    metrics?.observedFirstContentfulPaint,
    `${filename} audits.metrics.observedFirstContentfulPaint`
  );
  const observedCls = requiredNumber(
    metrics?.observedCumulativeLayoutShift,
    `${filename} audits.metrics.observedCumulativeLayoutShift`
  );

  const discoveryItems = auditItems(report, 'lcp-discovery-insight');
  const checklist = discoveryItems.find(item => item?.type === 'checklist')?.items || {};
  const node = discoveryItems.find(item => item?.type === 'node') || null;

  const breakdownTable = auditItems(report, 'lcp-breakdown-insight')
    .find(item => item?.type === 'table');
  if (!breakdownTable || !Array.isArray(breakdownTable.items)) {
    throw new Error(`Lighthouse report is missing the observed LCP breakdown table: ${filename}`);
  }

  const breakdown = {};
  for (const key of BREAKDOWN_KEYS) {
    const row = breakdownTable.items.find(item => item?.subpart === key);
    breakdown[key] = requiredNumber(row?.duration, `${filename} lcp-breakdown-insight.${key}`);
  }

  const breakdownTotal = BREAKDOWN_KEYS.reduce((sum, key) => sum + breakdown[key], 0);
  const simulatedLcpMs = requiredNumber(
    audits['largest-contentful-paint']?.numericValue,
    `${filename} audits.largest-contentful-paint.numericValue`
  );

  const lcpNode = node
    ? {
        label: node.nodeLabel || null,
        selector: node.selector || null,
        snippet: node.snippet || null
      }
    : { label: null, selector: null, snippet: null };

  return {
    sample: path.basename(String(filename)),
    version,
    brand,
    sampleNumber: Number(sampleNumber),
    lighthouseVersion: report.lighthouseVersion || null,
    performanceScore: finiteNumber(report.categories?.performance?.score)
      ? report.categories.performance.score
      : null,
    // Lantern/simulated values are used by the Lighthouse score in simulate mode.
    simulatedLcpMs,
    simulatedFcpMs: finiteNumber(audits['first-contentful-paint']?.numericValue)
      ? audits['first-contentful-paint'].numericValue
      : null,
    simulatedSpeedIndexMs: finiteNumber(audits['speed-index']?.numericValue)
      ? audits['speed-index'].numericValue
      : null,
    simulatedTbtMs: finiteNumber(audits['total-blocking-time']?.numericValue)
      ? audits['total-blocking-time'].numericValue
      : null,
    simulatedCls: finiteNumber(audits['cumulative-layout-shift']?.numericValue)
      ? audits['cumulative-layout-shift'].numericValue
      : null,
    // Observed values are read from the Lighthouse trace metrics; they are not
    // interchangeable with the simulated audit values above.
    observedLcpMs,
    observedFcpMs,
    observedCls,
    lcpNode,
    lcpDiscovery: {
      priorityHinted: typeof checklist.priorityHinted?.value === 'boolean'
        ? checklist.priorityHinted.value
        : null,
      requestDiscoverable: typeof checklist.requestDiscoverable?.value === 'boolean'
        ? checklist.requestDiscoverable.value
        : null,
      eagerlyLoaded: typeof checklist.eagerlyLoaded?.value === 'boolean'
        ? checklist.eagerlyLoaded.value
        : null
    },
    lcpBreakdownObservedMs: {
      ...breakdown,
      total: breakdownTotal
    }
  };
}

export function summarizeLighthouseRecords(records, expectedRuns = 2) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No Lighthouse records were supplied for the comparison');
  }
  if (!Number.isInteger(expectedRuns) || expectedRuns < 1) {
    throw new Error('expectedRuns must be a positive integer');
  }

  const summary = [];
  for (const [version, brand] of BUCKETS) {
    const rows = records
      .filter(row => row.version === version && row.brand === brand)
      .sort((left, right) => left.sampleNumber - right.sampleNumber);

    if (rows.length !== expectedRuns) {
      throw new Error(`Expected ${expectedRuns} reports for ${version} ${brand}, received ${rows.length}`);
    }

    const aggregate = selector => median(rows.map(selector));
    const breakdown = {};
    for (const key of BREAKDOWN_KEYS) {
      breakdown[key] = aggregate(row => row.lcpBreakdownObservedMs[key]);
    }
    breakdown.total = aggregate(row => row.lcpBreakdownObservedMs.total);

    summary.push({
      version,
      brand,
      runs: rows.length,
      performanceScore: aggregate(row => row.performanceScore),
      simulatedLcpMs: aggregate(row => row.simulatedLcpMs),
      observedLcpMs: aggregate(row => row.observedLcpMs),
      simulatedFcpMs: aggregate(row => row.simulatedFcpMs),
      observedFcpMs: aggregate(row => row.observedFcpMs),
      simulatedSpeedIndexMs: aggregate(row => row.simulatedSpeedIndexMs),
      simulatedTbtMs: aggregate(row => row.simulatedTbtMs),
      simulatedCls: aggregate(row => row.simulatedCls),
      observedCls: aggregate(row => row.observedCls),
      lcpBreakdownObservedMs: breakdown,
      lcpElements: [...new Set(rows.map(row => row.lcpNode.selector || row.lcpNode.label).filter(Boolean))],
      lcpElementLabels: [...new Set(rows.map(row => row.lcpNode.label).filter(Boolean))],
      requestDiscoverableRuns: rows.map(row => row.lcpDiscovery.requestDiscoverable),
      priorityHintedRuns: rows.map(row => row.lcpDiscovery.priorityHinted),
      eagerlyLoadedRuns: rows.map(row => row.lcpDiscovery.eagerlyLoaded)
    });
  }

  return summary;
}

function runCli() {
  const directory = path.resolve(
    process.argv[2] ||
    process.env.LIGHTHOUSE_REPORT_DIR ||
    path.join(process.env.RUNNER_TEMP || process.cwd(), 'lighthouse-reports')
  );
  const expectedRuns = Number(process.env.LIGHTHOUSE_EXPECTED_RUNS || 2);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    throw new Error(`Lighthouse report directory does not exist: ${directory}`);
  }

  const filenames = fs.readdirSync(directory)
    .filter(name => REPORT_NAME.test(name))
    .sort();
  const records = filenames.map(name => {
    const payload = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
    return parseLighthouseRecord(name, payload);
  });
  const summary = summarizeLighthouseRecords(records, expectedRuns);
  const result = {
    lighthouseVersion: [...new Set(records.map(row => row.lighthouseVersion).filter(Boolean))],
    baseBranch: process.env.LCP_BASE_REF || null,
    baseBranchSha: process.env.LCP_BASE_REF_SHA || null,
    baselineSha: process.env.LCP_BASE_SHA || null,
    headSha: process.env.PR_HEAD_SHA || null,
    expectedRuns,
    records,
    summary
  };

  fs.writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

const isDirectExecution = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`[lighthouse-summary] ${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}
