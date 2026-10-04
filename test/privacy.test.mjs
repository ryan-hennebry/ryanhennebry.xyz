// Tests for the visit-log privacy fix: a random daily salt held only in KV, no
// fingerprint columns, and 90-day retention.
//
// Everything runs the shipped src/index.js. The database is :memory: SQLite
// built from schema.sql behind a D1-shaped shim, the KV namespace is a fake
// that records every put() and its options, and the clock is node:test's
// mocked Date. Fixture salts are generated per run with randomBytes, so no
// salt value is ever written into this repository.

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { EXPORTED, SCHEMA, loadEntrypoint, loadWorker } from "./harness.mjs";

const worker = loadWorker();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const V4 = "86.181.229.144";
const V6 = "2a00:23c7:1ff8:2001:e5eb:34c0:3e45:97c";
const V6_PREFIX = "2a00:23c7:1ff8:2001::/64";
const DAY_ONE = "2026-10-01T09:00:00.000Z";
const DAY_TWO = "2026-10-02T09:00:00.000Z";
const FORTY_EIGHT_HOURS = 172800;

// D1 numbers its placeholders (?1, ?2); node:sqlite binds positionally.
function d1(db) {
  return {
    prepare(sql) {
      const text = sql.replace(/\?\d+/g, "?");
      let args = [];
      return {
        bind(...values) {
          args = values.map((v) => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const result = db.prepare(text).run(...args);
          return {
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid),
            },
          };
        },
        async first() {
          const row = db.prepare(text).get(...args);
          return row === undefined ? null : row;
        },
      };
    },
  };
}

function freshDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(SCHEMA, "utf8"));
  return db;
}

// A KV namespace that records reads and writes. seed pre-loads keys; options
// lets one test make a call throw or answer a re-read differently.
function fakeKv(seed, options) {
  const store = new Map(Object.entries(seed || {}));
  const puts = [];
  const gets = [];
  const opts = options || {};
  return {
    store,
    puts,
    gets,
    async get(key) {
      gets.push(key);
      if (opts.throwOnGet) {
        throw new Error("kv unavailable");
      }
      if (opts.reread && key.startsWith("salt:") && gets.filter((k) => k === key).length > 1) {
        return opts.reread;
      }
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, putOptions) {
      puts.push({ key, value, options: putOptions });
      if (opts.throwOnPut) {
        throw new Error("kv unavailable");
      }
      store.set(key, value);
    },
  };
}

function saltHex() {
  return randomBytes(32).toString("hex");
}

function hmacHex(salt, input) {
  return createHmac("sha256", Buffer.from(salt, "hex")).update(input).digest("hex");
}

function visitRequest(ip) {
  return {
    url: "https://ryanhennebry.xyz/",
    cf: {
      asn: 2856,
      asOrganization: "British Telecommunications PLC",
      country: "GB",
      httpProtocol: "HTTP/2",
      tlsVersion: "TLSv1.3",
      clientTcpRtt: 12,
    },
    headers: new Headers({
      "user-agent": UA,
      "cf-connecting-ip": ip,
      "accept-language": "en-GB,en;q=0.9",
    }),
  };
}

// Runs the shipped logVisit at a fixed instant and returns the stored row.
async function logAt(t, iso, env, ip) {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(iso) });
  const db = freshDb();
  await worker.logVisit(visitRequest(ip || V4), { status: 200 }, { ...env, DB: d1(db) });
  t.mock.timers.reset();
  const row = db.prepare("SELECT * FROM visits ORDER BY id DESC LIMIT 1").get();
  assert.ok(row, "logVisit wrote no visits row");
  return row;
}

function dohMiss() {
  return { ok: true, status: 200, json: async () => ({ Status: 3 }) };
}

async function ptrAt(t, iso, env, ip) {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(iso) });
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return dohMiss();
  };
  try {
    await worker.lookupPtr(env, ip, []);
  } finally {
    globalThis.fetch = original;
    t.mock.timers.reset();
  }
  return calls;
}

// --- harness -----------------------------------------------------------------

test("harness: every exported name is defined in src/index.js", () => {
  for (const name of EXPORTED) {
    assert.equal(typeof worker[name], "function", name + " is not defined");
  }
});

// --- daily salt --------------------------------------------------------------

test("hash: one visitor on two days of the same month gets unrelated hashes", async (t) => {
  const kv = fakeKv();
  const first = await logAt(t, DAY_ONE, { VISIT_ENRICH: kv });
  const second = await logAt(t, DAY_TWO, { VISIT_ENRICH: kv });
  assert.equal(typeof first.visitor_hash, "string");
  assert.equal(typeof second.visitor_hash, "string");
  assert.notEqual(first.visitor_hash, second.visitor_hash, "the hash links two days");
});

test("hash: one visitor twice on the same day hashes identically", async (t) => {
  const kv = fakeKv();
  const first = await logAt(t, DAY_ONE, { VISIT_ENRICH: kv });
  const second = await logAt(t, "2026-10-01T21:30:00.000Z", { VISIT_ENRICH: kv });
  assert.equal(first.visitor_hash, second.visitor_hash);
});

test("hash: visitor_hash is HMAC-SHA256 under the KV day salt", async (t) => {
  const salt = saltHex();
  const kv = fakeKv({ "salt:v3:2026-10-01": salt });
  const v4 = await logAt(t, DAY_ONE, { VISIT_ENRICH: kv }, V4);
  const v6 = await logAt(t, DAY_ONE, { VISIT_ENRICH: kv }, V6);
  assert.equal(v4.visitor_hash, hmacHex(salt, "v3|ipv4|" + V4 + "|" + UA));
  assert.equal(v6.visitor_hash, hmacHex(salt, "v3|ipv6-64|" + V6_PREFIX + "|" + UA));
  assert.equal(v4.hash_scope, "v3:ipv4");
  assert.equal(v6.hash_scope, "v3:ipv6-64");
});

test("hash: two different KV salts on one day give two different hashes", async (t) => {
  const a = await logAt(t, DAY_ONE, { VISIT_ENRICH: fakeKv({ "salt:v3:2026-10-01": saltHex() }) });
  const b = await logAt(t, DAY_ONE, { VISIT_ENRICH: fakeKv({ "salt:v3:2026-10-01": saltHex() }) });
  assert.notEqual(a.visitor_hash, b.visitor_hash, "the hash does not depend on the KV salt");
});

test("salt: the first visit of a UTC day stores 32 random bytes for 48 hours", async (t) => {
  const kv = fakeKv();
  await logAt(t, DAY_ONE, { VISIT_ENRICH: kv });
  await logAt(t, "2026-10-01T23:59:59.000Z", { VISIT_ENRICH: kv });
  const saltPuts = kv.puts.filter((p) => p.key.startsWith("salt:"));
  assert.equal(saltPuts.length, 1, "one salt per day, written once");
  assert.equal(saltPuts[0].key, "salt:v3:2026-10-01");
  assert.match(saltPuts[0].value, /^[0-9a-f]{64}$/);
  assert.deepEqual(saltPuts[0].options, { expirationTtl: FORTY_EIGHT_HOURS });

  const other = fakeKv();
  await logAt(t, DAY_ONE, { VISIT_ENRICH: other });
  assert.notEqual(other.store.get("salt:v3:2026-10-01"), saltPuts[0].value, "the salt is not random");
});

test("salt: a concurrent writer's salt, read back from KV, is the one used", async (t) => {
  const winner = saltHex();
  const kv = fakeKv({}, { reread: winner });
  const row = await logAt(t, DAY_ONE, { VISIT_ENRICH: kv });
  assert.equal(row.visitor_hash, hmacHex(winner, "v3|ipv4|" + V4 + "|" + UA));
});

test("hash: no VISIT_ENRICH binding stores visitor_hash NULL, not a public-salt hash", async (t) => {
  const row = await logAt(t, DAY_ONE, {});
  assert.equal(row.visitor_hash, null);
  assert.equal(row.hash_scope, null);
  assert.equal(row.path, "/", "the visit itself is still logged");
});

test("hash: a KV read failure stores visitor_hash NULL", async (t) => {
  const row = await logAt(t, DAY_ONE, { VISIT_ENRICH: fakeKv({}, { throwOnGet: true }) });
  assert.equal(row.visitor_hash, null);
});

test("hash: a KV write failure stores visitor_hash NULL", async (t) => {
  const row = await logAt(t, DAY_ONE, { VISIT_ENRICH: fakeKv({}, { throwOnPut: true }) });
  assert.equal(row.visitor_hash, null);
});

test("ptr: the cache key is HMAC under the KV day salt, not a repo constant", async (t) => {
  const saltA = saltHex();
  const saltB = saltHex();
  const kvA = fakeKv({ "salt:v3:2026-10-01": saltA });
  const kvB = fakeKv({ "salt:v3:2026-10-01": saltB });
  await ptrAt(t, DAY_ONE, { VISIT_ENRICH: kvA }, V6);
  await ptrAt(t, DAY_ONE, { VISIT_ENRICH: kvB }, V6);
  const keyA = kvA.puts.find((p) => p.key.startsWith("ptr:")).key;
  const keyB = kvB.puts.find((p) => p.key.startsWith("ptr:")).key;
  assert.notEqual(keyA, keyB, "the PTR key does not depend on the KV salt");
  assert.equal(keyA, "ptr:" + hmacHex(saltA, V6_PREFIX).slice(0, 32));
});

test("ptr: with no usable salt the cache is skipped and the lookup still runs", async (t) => {
  const kv = fakeKv({}, { throwOnGet: true });
  const calls = await ptrAt(t, DAY_ONE, { VISIT_ENRICH: kv }, V4);
  assert.equal(calls.length, 1, "the DNS lookup still ran");
  assert.equal(kv.puts.filter((p) => p.key.startsWith("ptr:")).length, 0, "no PTR entry written");
});

test("salt: no salt reaches a log line or a table", async (t) => {
  const salt = saltHex();
  const kv = fakeKv({ "salt:v3:2026-10-01": salt });
  const lines = [];
  for (const level of ["log", "error", "warn", "info"]) {
    t.mock.method(console, level, (...args) => lines.push(args.map(String).join(" ")));
  }
  const row = await logAt(t, DAY_ONE, { VISIT_ENRICH: kv });
  await ptrAt(t, DAY_ONE, { VISIT_ENRICH: kv }, V4);
  assert.equal(lines.join("\n").includes(salt), false, "salt printed");
  assert.equal(JSON.stringify(row).includes(salt), false, "salt stored in visits");
});

// --- no fingerprint fields ---------------------------------------------------

test("visits: accept-language, protocol, TLS version and TCP RTT are stored NULL", async (t) => {
  const row = await logAt(t, DAY_ONE, { VISIT_ENRICH: fakeKv() });
  assert.deepEqual(
    {
      accept_language: row.accept_language,
      http_protocol: row.http_protocol,
      tls_version: row.tls_version,
      client_tcp_rtt: row.client_tcp_rtt,
    },
    { accept_language: null, http_protocol: null, tls_version: null, client_tcp_rtt: null }
  );
  assert.equal(row.ua, UA, "the user agent is still stored for classification");
  assert.equal(row.country, "GB");
});

// --- alert email --------------------------------------------------------------

test("alert: the repeat line counts today's visits, not the month's", async () => {
  const db = freshDb();
  const insert = db.prepare(
    "INSERT INTO visits (ts, path, status, asn, as_org, country, classification, visitor_hash, ua) VALUES (?, '/', 200, 12345, 'Acme Broadband', 'GB', 'human', 'h', ?)"
  );
  insert.run("2026-10-01T10:00:00.000Z", UA);
  insert.run("2026-10-02T08:00:00.000Z", UA);
  const id = Number(insert.run("2026-10-02T09:00:00.000Z", UA).lastInsertRowid);

  const sent = [];
  const env = {
    DB: d1(db),
    ALERT_EMAIL: { async send(message) { sent.push(message); } },
  };
  const original = globalThis.fetch;
  globalThis.fetch = async () => dohMiss();
  try {
    await worker.maybeAlert(env, {
      id,
      ts: "2026-10-02T09:00:00.000Z",
      path: "/",
      status: 200,
      asn: 12345,
      asOrg: "Acme Broadband",
      country: "GB",
      city: null,
      referer: null,
      ua: UA,
      ip: V4,
      classification: "human",
      visitorHash: "h",
    });
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(sent.length, 1);
  assert.match(sent[0].raw, /^Repeat:   2nd visit today$/m);
});

// --- retention -----------------------------------------------------------------

const NOW = new Date("2026-12-01T03:17:00.000Z");
const OLD = "2026-09-01T03:16:00.000Z"; // 91 days before NOW
const KEPT = "2026-09-03T03:17:00.000Z"; // 89 days before NOW

function seedRetention() {
  const db = freshDb();
  for (const [ts, hash] of [[OLD, "old"], [KEPT, "kept"]]) {
    const id = Number(
      db
        .prepare("INSERT INTO visits (ts, path, classification, visitor_hash) VALUES (?, '/', 'human', ?)")
        .run(ts, hash).lastInsertRowid
    );
    db.prepare("INSERT INTO enrichment (visit_id, ts, source) VALUES (?, ?, 'ua-only')").run(id, ts);
    db.prepare("INSERT INTO alerts_sent (visitor_hash, day, ts) VALUES (?, ?, ?)").run(hash, ts.slice(0, 10), ts);
    db.prepare("INSERT INTO alert_log (ts, visitor_hash, outcome) VALUES (?, ?, 'sent')").run(ts, hash);
  }
  return db;
}

function remaining(db) {
  const out = {};
  for (const table of ["visits", "enrichment", "alerts_sent", "alert_log"]) {
    out[table] = db.prepare("SELECT ts FROM " + table + " ORDER BY ts").all().map((r) => r.ts);
  }
  return out;
}

const ONLY_KEPT = { visits: [KEPT], enrichment: [KEPT], alerts_sent: [KEPT], alert_log: [KEPT] };

test("purge: rows older than 90 days go from all four tables, younger rows stay", async () => {
  const db = seedRetention();
  assert.equal(typeof worker.purgeOldRows, "function", "purgeOldRows is not defined");
  await worker.purgeOldRows({ DB: d1(db) }, NOW);
  assert.deepEqual(remaining(db), ONLY_KEPT);
});

test("purge: the scheduled handler runs the purge at the trigger time", async () => {
  const db = seedRetention();
  const entry = loadEntrypoint();
  assert.equal(typeof entry.scheduled, "function", "no scheduled handler");
  const pending = [];
  await entry.scheduled(
    { scheduledTime: NOW.getTime(), cron: "17 3 * * *" },
    { DB: d1(db) },
    { waitUntil: (p) => pending.push(p) }
  );
  await Promise.all(pending);
  assert.deepEqual(remaining(db), ONLY_KEPT);
});

test("purge: wrangler.jsonc declares one daily cron trigger", () => {
  const text = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const config = JSON.parse(text);
  assert.ok(config.triggers, "no triggers block");
  assert.equal(config.triggers.crons.length, 1);
  assert.match(config.triggers.crons[0], /^\d{1,2} \d{1,2} \* \* \*$/);
});

// --- migration -------------------------------------------------------------------

// Runs the unrun migration against :memory: SQLite only, never against D1.
test("migration: clears pre-v3 identifiers and fingerprints, keeps v3 rows, runs twice", () => {
  const db = freshDb();
  const visit = db.prepare(
    "INSERT INTO visits (ts, path, classification, visitor_hash, hash_scope, accept_language, http_protocol, tls_version, client_tcp_rtt) VALUES (?, '/', 'human', ?, ?, 'en-GB', 'HTTP/2', 'TLSv1.3', 12)"
  );
  visit.run("2026-09-01T10:00:00.000Z", "v1hash", null);
  visit.run("2026-10-01T10:00:00.000Z", "v2hash", "ipv4");
  visit.run("2026-10-06T10:00:00.000Z", "v3hash", "v3:ipv4");
  for (const [ts, hash] of [["2026-10-01T10:00:00.000Z", "v2hash"], ["2026-10-06T10:00:00.000Z", "v3hash"]]) {
    db.prepare("INSERT INTO alerts_sent (visitor_hash, day, ts) VALUES (?, ?, ?)").run(hash, ts.slice(0, 10), ts);
    db.prepare("INSERT INTO alert_log (ts, visitor_hash, outcome) VALUES (?, ?, 'sent')").run(ts, hash);
  }

  const sql = readFileSync(join(ROOT, "migrations", "2026-10-04-clear-old-identifiers.sql"), "utf8");
  db.exec(sql);
  db.exec(sql);

  const plain = (rows) => rows.map((r) => ({ ...r }));
  assert.deepEqual(
    plain(db.prepare("SELECT visitor_hash, accept_language, http_protocol, tls_version, client_tcp_rtt FROM visits ORDER BY ts").all()),
    [
      { visitor_hash: null, accept_language: null, http_protocol: null, tls_version: null, client_tcp_rtt: null },
      { visitor_hash: null, accept_language: null, http_protocol: null, tls_version: null, client_tcp_rtt: null },
      { visitor_hash: "v3hash", accept_language: null, http_protocol: null, tls_version: null, client_tcp_rtt: null },
    ]
  );
  assert.deepEqual(plain(db.prepare("SELECT visitor_hash FROM alerts_sent").all()), [{ visitor_hash: "v3hash" }]);
  assert.deepEqual(plain(db.prepare("SELECT visitor_hash FROM alert_log ORDER BY ts").all()), [
    { visitor_hash: null },
    { visitor_hash: "v3hash" },
  ]);
});

test("migration: before any v3 row exists the alert tables are untouched", () => {
  const db = freshDb();
  db.prepare("INSERT INTO alerts_sent (visitor_hash, day, ts) VALUES ('v2hash', '2026-10-01', '2026-10-01T10:00:00.000Z')").run();
  db.prepare("INSERT INTO alert_log (ts, visitor_hash, outcome) VALUES ('2026-10-01T10:00:00.000Z', 'v2hash', 'sent')").run();
  db.exec(readFileSync(join(ROOT, "migrations", "2026-10-04-clear-old-identifiers.sql"), "utf8"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM alerts_sent").get().n, 1);
  assert.equal(db.prepare("SELECT visitor_hash FROM alert_log").get().visitor_hash, "v2hash");
});

// --- verify.sh -------------------------------------------------------------------

test("verify.sh fails when index.html is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "verify-"));
  try {
    copyFileSync(join(ROOT, "verify.sh"), join(dir, "verify.sh"));
    const run = spawnSync("sh", [join(dir, "verify.sh")], { encoding: "utf8" });
    assert.notEqual(run.status, 0, "verify.sh exited 0 with no index.html:\n" + run.stdout);
    assert.match(run.stdout, /FAIL .*index\.html/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
