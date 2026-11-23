#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseDocument } from 'yaml';

const SPEC_PATH = new URL('../docs/openapi.yaml', import.meta.url);
const specText = await readFile(SPEC_PATH, 'utf8');
const document = parseDocument(specText, {
  strict: true,
  uniqueKeys: true,
  stringKeys: true,
});

if (document.errors.length > 0) {
  for (const error of document.errors) {
    console.error(`OpenAPI YAML error: ${error.message}`);
  }
  process.exitCode = 1;
} else if (document.warnings.length > 0) {
  for (const warning of document.warnings) {
    console.warn(`OpenAPI YAML warning: ${warning.message}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);

const spec = document.toJS();
const problems = [];

if (spec?.openapi !== '3.0.3') {
  problems.push(`Expected OpenAPI 3.0.3, received ${String(spec?.openapi)}`);
}
if (!spec?.info?.title || !spec?.info?.version) {
  problems.push('OpenAPI info.title and info.version are required');
}
if (!spec?.paths || typeof spec.paths !== 'object' || Array.isArray(spec.paths)) {
  problems.push('OpenAPI paths must be an object');
}

const orderCreate = spec?.paths?.['/api/orders']?.post;
if (!orderCreate) {
  problems.push('POST /api/orders is missing from OpenAPI paths');
} else {
  const bodySchema = orderCreate.requestBody?.content?.['application/json']?.schema;
  const properties = bodySchema?.properties || {};
  const key = properties.client_order_id;
  const itemSchema = properties.items?.items;

  if (!orderCreate.security?.some(entry => entry?.BearerAuth)) {
    problems.push('POST /api/orders must require BearerAuth');
  }
  if (!bodySchema?.required?.includes('items')) {
    problems.push('POST /api/orders must require items');
  }
  if (
    key?.type !== 'string'
    || key.minLength !== 8
    || key.maxLength !== 128
    || key.pattern !== '^[A-Za-z0-9_-]{8,128}$'
  ) {
    problems.push('POST /api/orders.client_order_id must document the 8–128 character key contract');
  }
  if (itemSchema?.type !== 'object' || !itemSchema.required?.includes('id')) {
    problems.push('POST /api/orders.items must describe object items with required id');
  }
  for (const status of ['200', '400', '401', '403', '409']) {
    if (!orderCreate.responses?.[status]) {
      problems.push(`POST /api/orders must document HTTP ${status}`);
    }
  }
  const conflict = orderCreate.responses?.['409']?.content?.['application/json']?.schema;
  if (!conflict?.properties?.code?.enum?.includes('IDEMPOTENCY_KEY_REUSED')) {
    problems.push('POST /api/orders HTTP 409 must document IDEMPOTENCY_KEY_REUSED');
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`OpenAPI contract error: ${problem}`);
  process.exitCode = 1;
} else {
  console.log('OpenAPI YAML syntax, duplicate keys, 3.0.3 declaration, and order idempotency contract passed.');
}
