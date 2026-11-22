#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { patchHtmlDocument } from './patch-html.mjs';

const [sourcePath, destinationPath, variant] = process.argv.slice(2);
if (!sourcePath || !destinationPath || !['C7', 'C8'].includes(variant)) {
  throw new Error('Usage: node prepare-html-variant.mjs <source-index.html> <destination-index.html> C7|C8');
}
const html = await fs.readFile(sourcePath, 'utf8');
const patched = patchHtmlDocument(html, variant);
await fs.mkdir(path.dirname(destinationPath), { recursive: true });
await fs.writeFile(destinationPath, patched, 'utf8');
console.log(JSON.stringify({
  variant,
  source: sourcePath,
  destination: destinationPath,
  sourceBytes: Buffer.byteLength(html),
  patchedBytes: Buffer.byteLength(patched),
}));
