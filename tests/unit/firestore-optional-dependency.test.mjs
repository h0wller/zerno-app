import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const packages = lock.packages || {};

test('firebase-admin resolves the refreshed optional Firestore dependency tree', () => {
  const firestorePath = 'node_modules/@google-cloud/firestore';
  const firestore = packages[firestorePath];
  assert.equal(firestore?.version, '9.4.0');
  assert.match(firestore?.dependencies?.['@google-cloud/firestore-api'] || '', /^\^0\.7\./);

  const apiEntries = Object.entries(packages).filter(([path, entry]) =>
    (path === 'node_modules/@google-cloud/firestore-api' ||
      path.endsWith('/node_modules/@google-cloud/firestore-api')) &&
    /^0\.7\./.test(entry.version || '')
  );
  assert.ok(apiEntries.length, 'Firestore 9.4.0 must resolve firestore-api 0.7.x');

  const apiPaths = apiEntries.map(([path]) => path);
  for (const apiPath of apiPaths) {
    for (const name of ['glob', 'minimatch', 'rimraf']) {
      assert.equal(
        packages[`${apiPath}/node_modules/${name}`],
        undefined,
        `Firestore API 0.7.x must not retain nested ${name}`
      );
    }
  }
});
