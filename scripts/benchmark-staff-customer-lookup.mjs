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


function benchmarkRouteEquivalentLookup() {
  const database = new Database(':memory:');
  database.function('ph10', { deterministic: true }, ph10);
  try {
    database.exec(`
      CREATE TABLE customers (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT NOT NULL,
        stamps INTEGER DEFAULT 0, free INTEGER DEFAULT 0, cups INTEGER DEFAULT 0,
        qr TEXT, role TEXT DEFAULT 'guest', verified INTEGER DEFAULT 1,
        welcome INTEGER DEFAULT 0, tg TEXT, notify_tg INTEGER DEFAULT 1,
        notify_web INTEGER DEFAULT 1
      );
      CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT, ts TEXT, a TEXT, by TEXT
      );
    `);
    const insertCustomer = database.prepare(`
      INSERT INTO customers
        (id,name,phone,stamps,free,cups,qr,role,verified,welcome,tg,notify_tg,notify_web)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const insertHistory = database.prepare(
      'INSERT INTO history(cid,ts,a,by) VALUES(?,?,?,?)'
    );
    const targetFormats = [
      '+7 900 123-45-67',
      '8 (900) 123-45-67',
      '7 9001234567'
    ];
    const seed = database.transaction(() => {
      for (let index = 0; index < 10_000; index += 1) {
        const id = `customer-${index}`;
        const phone = index < targetFormats.length
          ? targetFormats[index]
          : formatPhone(String(2_100_000_000 + index));
        insertCustomer.run(
          id, `Synthetic Customer ${index}`, phone,
          index % 10, 0, index % 20, `QR-${index}`, 'guest', 1, 0, null, 1, 1
        );
        const historyCount = index < targetFormats.length ? 14 : 2;
        for (let row = 0; row < historyCount; row += 1) {
          insertHistory.run(id, `2026-01-01T00:00:${String(row).padStart(2, '0')}.000Z`, `Action ${row}`, 'Кассир');
        }
      }
    });
    seed();
    database.exec('CREATE INDEX idx_route_bench_customer_ph10 ON customers(ph10(phone))');

    const allCustomers = database.prepare('SELECT * FROM customers');
    const exactIndexed = database.prepare(
      'SELECT * FROM customers WHERE ph10(phone)=? ORDER BY rowid'
    );
    const historyForCustomer = database.prepare(
      'SELECT ts,a,by FROM history WHERE cid=? ORDER BY id DESC LIMIT 10'
    );
    const serializeCustomer = (customer, history) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      stamps: customer.stamps,
      free: customer.free,
      cups: customer.cups,
      qr: customer.qr,
      role: customer.role || 'guest',
      verified: customer.verified ? 1 : 0,
      welcome: customer.welcome ? 1 : 0,
      tg: customer.tg ? 1 : 0,
      notify_tg: customer.notify_tg !== 0 ? 1 : 0,
      notify_web: customer.notify_web !== 0 ? 1 : 0,
      history
    });

    const legacyRoute = () => {
      const all = allCustomers.all();
      const matches = all.filter(customer => ph10(customer.phone) === targetDigits);
      return matches.map(customer => serializeCustomer(
        customer, historyForCustomer.all(customer.id)
      ));
    };
    const optimizedCandidate = () => {
      const matches = exactIndexed.all(targetDigits);
      const ids = matches.map(customer => customer.id);
      const grouped = new Map(ids.map(id => [id, []]));
      if (ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        const rows = database.prepare(
          `SELECT cid,ts,a,by FROM history WHERE cid IN (${placeholders}) ORDER BY cid ASC,id DESC`
        ).all(...ids);
        for (const row of rows) {
          const history = grouped.get(row.cid);
          if (history.length < 10) history.push({ ts: row.ts, a: row.a, by: row.by });
        }
      }
      return matches.map(customer => serializeCustomer(customer, grouped.get(customer.id)));
    };

    const expected = legacyRoute();
    const actual = optimizedCandidate();
    assert.deepEqual(actual, expected, 'indexed exact-phone route must preserve complete cust() response');
    assert.equal(expected.length, targetFormats.length, 'all canonical duplicates must be preserved');
    assert.ok(expected.every(customer => customer.history.length === 10), 'history remains capped at ten newest rows');

    const legacyTiming = measure(legacyRoute, 30);
    const candidateTiming = measure(optimizedCandidate, 100);
    const legacyHistoryQueries = expected.length;
    const optimizedHistoryQueries = expected.length ? 1 : 0;
    return {
      customer_rows: 10_000,
      exact_phone_matches: expected.length,
      history_rows_seeded_per_match: 14,
      history_rows_returned_per_match: 10,
      legacy_customer_scan: 'SELECT * + JavaScript ph10 filter',
      candidate_customer_lookup: 'indexed SQLite ph10(phone)',
      legacy_history_queries: legacyHistoryQueries,
      candidate_history_queries: optimizedHistoryQueries,
      legacy_full_route: legacyTiming,
      indexed_and_batched_candidate: candidateTiming,
      p50_speedup: Number((legacyTiming.p50_ms / candidateTiming.p50_ms).toFixed(2)),
      equivalence: 'deepStrictEqual complete response objects'
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
  route_equivalent_lookup: benchmarkRouteEquivalentLookup(),
  results
}, null, 2));
