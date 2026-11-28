import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { ph10 } from '../server/utils/phone.js';

const sizes = [1_882, 10_000, 100_000];
const targetPhone = '+7 900 123-45-67';
const targetDigits = ph10(targetPhone);
const repetitions = new Map([
  [1_882, 100],
  [10_000, 50],
  [100_000, 25]
]);

function percentile(samples, fraction) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function measure(fn, count) {
  for (let i = 0; i < 3; i += 1) fn();
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const started = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return {
    p50_ms: Number(percentile(samples, 0.5).toFixed(4)),
    p95_ms: Number(percentile(samples, 0.95).toFixed(4))
  };
}

function formatPhone(digits) {
  return `+7 ${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
}

function buildDatabase(size) {
  const database = new Database(':memory:');
  database.function('ph10', { deterministic: true }, ph10);
  database.exec(`CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT NOT NULL,
    stamps INTEGER,
    free INTEGER,
    cups INTEGER,
    qr TEXT,
    created_at TEXT,
    role TEXT,
    tg TEXT,
    pin TEXT,
    verified INTEGER,
    welcome INTEGER,
    actcode TEXT,
    notify_tg INTEGER,
    notify_web INTEGER,
    consent TEXT,
    src TEXT,
    qr_done INTEGER
  )`);

  const insert = database.prepare(`
    INSERT INTO customers (
      name, phone, stamps, free, cups, qr, created_at, role, tg, pin,
      verified, welcome, actcode, notify_tg, notify_web, consent, src, qr_done
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBatch = database.transaction((count) => {
    for (let i = 0; i < count - 1; i += 1) {
      insert.run(
        `Synthetic Customer ${i}`,
        formatPhone(String(2_000_000_000 + i)),
        0, 0, 0, `Z-BENCH-${i}`, '2026-01-01T00:00:00.000Z', 'guest',
        null, '', 1, 0, null, 1, 1, '', '', 0
      );
    }
    insert.run(
      'Synthetic Target', targetPhone, 0, 0, 0, 'Z-BENCH-TARGET',
      '2026-01-01T00:00:00.000Z', 'guest', null, '', 1, 0, null, 1, 1, '', '', 0
    );
  });
  insertBatch(size);

  database.exec('CREATE INDEX idx_bench_customers_phone_ph10 ON customers(ph10(phone))');
  return database;
}

function verifyLegacyDuplicates() {
  const database = new Database(':memory:');
  database.function('ph10', { deterministic: true }, ph10);
  database.exec('CREATE TABLE customers (id INTEGER PRIMARY KEY, phone TEXT NOT NULL)');
  const formats = [
    '+7 900 123-45-67',
    '8 (900) 123-45-67',
    '7 9001234567',
    '9001234567'
  ];
  const insert = database.prepare('INSERT INTO customers (phone) VALUES (?)');
  for (const phone of formats) insert.run(phone);

  const matches = database.prepare('SELECT id FROM customers WHERE ph10(phone)=? ORDER BY id')
    .all(targetDigits);
  assert.equal(matches.length, formats.length, 'all canonical duplicates must be returned');
  database.close();
  return matches.length;
}

function benchmarkHistorySerialization() {
  const database = new Database(':memory:');
  try {
    database.exec(`
      CREATE TABLE history (
        id INTEGER PRIMARY KEY,
        cid INTEGER NOT NULL,
        ts TEXT NOT NULL,
        a TEXT NOT NULL,
        by TEXT NOT NULL
      );
      CREATE INDEX idx_bench_history_cid_id ON history(cid, id DESC);
    `);
    const insert = database.prepare(
      'INSERT INTO history (cid, ts, a, by) VALUES (?, ?, ?, ?)'
    );
    const customerIds = [101, 102, 103, 104, 105];
    const seed = database.transaction(() => {
      for (const cid of customerIds) {
        for (let index = 0; index < 10; index += 1) {
          insert.run(cid, '2026-01-01T00:00:00.000Z', `History ${index}`, 'Кассир');
        }
      }
    });
    seed();

    const perCustomerHistory = database.prepare(
      'SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10'
    );
    const batchedHistory = database.prepare(
      `SELECT cid,ts,a,by FROM history
       WHERE cid IN (${customerIds.map(() => '?').join(',')})
       ORDER BY cid ASC, id DESC`
    );

    const serializeNPlusOne = () => customerIds.map((id) => ({
      id,
      history: perCustomerHistory.all(id)
    }));
    const serializeBatched = () => {
      const grouped = new Map(customerIds.map((id) => [id, []]));
      for (const row of batchedHistory.all(...customerIds)) {
        const history = grouped.get(row.cid);
        if (history.length < 10) {
          history.push({ ts: row.ts, a: row.a, by: row.by });
        }
      }
      return customerIds.map((id) => ({ id, history: grouped.get(id) }));
    };

    const nPlusOneResult = serializeNPlusOne();
    const batchedResult = serializeBatched();
    assert.deepEqual(
      batchedResult,
      nPlusOneResult,
      'batched history serialization must preserve per-customer rows and ordering'
    );

    const nPlusOneTiming = measure(serializeNPlusOne, 1000);
    const batchedTiming = measure(serializeBatched, 1000);
    return {
      matched_customers: customerIds.length,
      history_rows_per_customer: 10,
      legacy_history_queries: customerIds.length,
      batched_history_queries: 1,
      n_plus_one_serialization: nPlusOneTiming,
      batched_serialization: batchedTiming,
      p50_speedup: Number((nPlusOneTiming.p50_ms / batchedTiming.p50_ms).toFixed(2))
    };
  } finally {
    database.close();
  }
}

const results = [];
for (const size of sizes) {
  const database = buildDatabase(size);
  try {
    const scan = database.prepare('SELECT * FROM customers');
    const indexed = database.prepare('SELECT * FROM customers WHERE ph10(phone)=? ORDER BY id');
    const expected = scan.all().filter(row => ph10(row.phone) === targetDigits).map(row => row.id);
    const actual = indexed.all(targetDigits).map(row => row.id);
    assert.deepEqual(actual, expected, `indexed lookup must match full scan at ${size} rows`);
    assert.equal(actual.length, 1, 'the synthetic target must be unique');

    const queryPlan = database.prepare('EXPLAIN QUERY PLAN SELECT * FROM customers WHERE ph10(phone)=? ORDER BY id')
      .all(targetDigits)
      .map(row => row.detail);
    assert(
      queryPlan.some(detail => detail.includes('idx_bench_customers_phone_ph10')),
      'SQLite must use the expression index'
    );

    const reps = repetitions.get(size);
    const scanTiming = measure(() => {
      const rows = scan.all();
      return rows.filter(row => ph10(row.phone) === targetDigits);
    }, reps);
    const indexedTiming = measure(() => indexed.all(targetDigits), reps);

    results.push({
      rows: size,
      repetitions: reps,
      full_scan_js_filter: scanTiming,
      indexed_sql_lookup: indexedTiming,
      p50_speedup: Number((scanTiming.p50_ms / indexedTiming.p50_ms).toFixed(1)),
      query_plan: queryPlan
    });
  } finally {
    database.close();
  }
}

const legacyDuplicateMatches = verifyLegacyDuplicates();
console.log(JSON.stringify({
  benchmark: 'F-005 staff customer exact-phone lookup',
  note: 'Synthetic in-memory SQLite microbenchmark; excludes Express, cust() history serialization, network and production storage. The deterministic ph10() UDF is a prototype index only and would need registration on every production connection.',
  legacy_duplicate_matches: legacyDuplicateMatches,
  history_serialization: benchmarkHistorySerialization(),
  results
}, null, 2));
