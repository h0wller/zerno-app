import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseLighthouseRecord,
  summarizeLighthouseRecords
} from '../../scripts/lighthouse-summary.mjs';

function report(overrides = {}) {
  return {
    categories: { performance: { score: 0.82 } },
    audits: {
      'largest-contentful-paint': { numericValue: 5057 },
      'first-contentful-paint': { numericValue: 1478 },
      'speed-index': { numericValue: 2002 },
      'total-blocking-time': { numericValue: 17 },
      'cumulative-layout-shift': { numericValue: 0 },
      metrics: {
        details: {
          items: [{
            largestContentfulPaint: 5057,
            observedLargestContentfulPaint: 278,
            observedFirstContentfulPaint: 131,
            observedCumulativeLayoutShift: 0
          }]
        }
      },
      'lcp-discovery-insight': {
        details: {
          items: [
            {
              type: 'checklist',
              items: {
                priorityHinted: { value: true },
                requestDiscoverable: { value: true },
                eagerlyLoaded: { value: true }
              }
            },
            {
              type: 'node',
              nodeLabel: 'Маргарита',
              selector: 'div#deliveryGrid > article.card > div.media > img',
              snippet: '<img alt="Маргарита" fetchpriority="high">'
            }
          ]
        }
      },
      'lcp-breakdown-insight': {
        details: {
          items: [
            {
              type: 'table',
              items: [
                { subpart: 'timeToFirstByte', duration: 5.6 },
                { subpart: 'resourceLoadDelay', duration: 49.9 },
                { subpart: 'resourceLoadDuration', duration: 9 },
                { subpart: 'elementRenderDelay', duration: 213.5 }
              ]
            }
          ]
        }
      }
    },
    ...overrides
  };
}

test('Lighthouse report parser keeps simulated and observed LCP separate', () => {
  const parsed = parseLighthouseRecord('head-delivery-1.json', report());

  assert.equal(parsed.version, 'head');
  assert.equal(parsed.brand, 'delivery');
  assert.equal(parsed.sampleNumber, 1);
  assert.equal(parsed.simulatedLcpMs, 5057);
  assert.equal(parsed.observedLcpMs, 278);
  assert.equal(parsed.observedFcpMs, 131);
  assert.equal(parsed.lcpNode.label, 'Маргарита');
  assert.equal(parsed.lcpNode.selector, 'div#deliveryGrid > article.card > div.media > img');
  assert.deepEqual(parsed.lcpDiscovery, {
    priorityHinted: true,
    requestDiscoverable: true,
    eagerlyLoaded: true
  });
  assert.equal(parsed.lcpBreakdownObservedMs.resourceLoadDelay, 49.9);
  assert.equal(parsed.lcpBreakdownObservedMs.total, 278);
});

test('Lighthouse summary calculates medians for each brand and reports both LCP values', () => {
  const records = [
    parseLighthouseRecord('base-coffee-1.json', report()),
    parseLighthouseRecord('base-coffee-2.json', report({
      audits: {
        ...report().audits,
        'largest-contentful-paint': { numericValue: 4800 },
        metrics: { details: { items: [{ observedLargestContentfulPaint: 500 }] } }
      }
    })),
    parseLighthouseRecord('head-coffee-1.json', report({
      audits: {
        ...report().audits,
        'largest-contentful-paint': { numericValue: 4400 },
        metrics: { details: { items: [{ observedLargestContentfulPaint: 400 }] } }
      }
    })),
    parseLighthouseRecord('head-coffee-2.json', report({
      audits: {
        ...report().audits,
        'largest-contentful-paint': { numericValue: 4200 },
        metrics: { details: { items: [{ observedLargestContentfulPaint: 300 }] } }
      }
    })),
    parseLighthouseRecord('base-delivery-1.json', report()),
    parseLighthouseRecord('base-delivery-2.json', report()),
    parseLighthouseRecord('head-delivery-1.json', report()),
    parseLighthouseRecord('head-delivery-2.json', report())
  ];

  const summary = summarizeLighthouseRecords(records, 2);
  const coffeeBase = summary.find(row => row.version === 'base' && row.brand === 'coffee');
  const coffeeHead = summary.find(row => row.version === 'head' && row.brand === 'coffee');

  assert.equal(coffeeBase.simulatedLcpMs, 4928.5);
  assert.equal(coffeeBase.observedLcpMs, 389);
  assert.equal(coffeeHead.simulatedLcpMs, 4300);
  assert.equal(coffeeHead.observedLcpMs, 350);
  assert.equal(coffeeHead.requestDiscoverableRuns.length, 2);
});

test('Lighthouse report parser rejects report names and missing observed LCP rather than hiding gaps', () => {
  assert.throws(() => parseLighthouseRecord('latest.json', report()), /expected.*base|head/i);

  const withoutObservedLcp = report();
  delete withoutObservedLcp.audits.metrics.details.items[0].observedLargestContentfulPaint;
  assert.throws(() => parseLighthouseRecord('head-delivery-1.json', withoutObservedLcp), /observed.*LCP/i);
});

test('Lighthouse summary requires every base/head and coffee/delivery comparison bucket', () => {
  const single = parseLighthouseRecord('head-coffee-1.json', report());
  assert.throws(() => summarizeLighthouseRecords([single], 2), /expected 2.*base.*coffee|missing.*base.*coffee/i);
});
