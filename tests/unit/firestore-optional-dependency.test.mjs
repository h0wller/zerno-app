import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));
const packages = lock.packages || {};

test('firebase-admin uses the refreshed optional Firestore dependency tree', () => {
  assert.equal(packages['node_modules/@google-cloud/firestore']?.version, '9.4.0');
  assert.match(
    packages['node_modules/@google-cloud/firestore-api']?.version || '',
    /^0\.7\./
  );

  for (const name of ['glob', 'minimatch', 'rimraf']) {
    assert.equal(
      packages[`node_modules/@google-cloud/firestore-api/node_modules/${name}`],
      undefined,
      `Firestore API must not retain its old nested ${name} dependency`
    );
  }

  const oldGax = packages['node_modules/@google-cloud/firestore-api/node_modules/google-gax'];
  assert.equal(oldGax, undefined, 'Firestore API must not retain the legacy nested google-gax 5.x tree');
});
