// Integration tests for the enrichment path in maybeAlert, run against the
// shipped source with a real SQLite database behind a D1-shaped shim.
//
// Nothing here touches the network: globalThis.fetch is replaced by a router
// over the two provider hostnames, and every response is a fixture. The
// database is :memory: and is built from the checked-in schema.sql, so a
// column that exists in the test but not in the deployed schema is a failure
// rather than a silent pass.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { loadWorker, SCHEMA } from "./harness.mjs";

const worker = loadWorker();

const UA_CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const IP = "203.0.113.9";

// D1 numbers its placeholders (?1, ?2); node:sqlite binds positionally and
// rejects the numbered form, so they are normalised on the way through.
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

function kv() {
  const store = new Map();
  return {
    keys: store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

const PTR_ANSWER = jsonResponse({
  Status: 0,
  Answer: [{ name: "9.113.0.203.in-addr.arpa.", type: 12, TTL: 3600, data: "gateway.acme-corp.example." }],
});

// A provider route table. Anything not listed is a test bug, not a fallback.
function stubFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url) => {
    const text = String(url);
    calls.push(text);
    for (const [needle, handler] of routes) {
      if (text.includes(needle)) {
        return typeof handler === "function" ? await handler(text) : handler;
      }
    }
    throw new Error("unrouted fetch: " + text);
  };
  return calls;
}

function setup(options) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(SCHEMA, "utf8"));

  const sent = [];
  const env = {
    DB: d1(db),
    VISIT_ENRICH: kv(),
    ALERT_EMAIL: {
      async send(message) {
        sent.push(message);
      },
    },
  };
  if (options && options.key) {
    env.IPLOCATE_KEY = options.key;
  }

  const ts = "2026-09-01T14:32:10.000Z";
  const insert = db
    .prepare(
      "INSERT INTO visits (ts, path, status, asn, as_org, country, city, classification, visitor_hash, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(ts, "/", 200, 12345, "Acme Broadband", "GB", "London", "human", "visitor-hash-1", UA_CHROME_MAC);

  const visit = {
    id: Number(insert.lastInsertRowid),
    ts,
    path: "/",
    status: 200,
    asn: 12345,
    asOrg: "Acme Broadband",
    country: "GB",
    city: "London",
    referer: null,
    ua: UA_CHROME_MAC,
    ip: IP,
    classification: "human",
    visitorHash: "visitor-hash-1",
  };

  // The premise of every test below: this visit already clears the first-pass
  // filter, so anything that stops the email came from enrichment.
  assert.equal(worker.isGenuineVisit(visit), true);

  return {
    db,
    env,
    sent,
    visit,
    enrichmentRow: () => db.prepare("SELECT * FROM enrichment WHERE visit_id = ?").get(visit.id) ?? null,
    // node:sqlite returns null-prototype rows; deepEqual wants plain objects.
    alertLog: () =>
      db
        .prepare("SELECT outcome, detail FROM alert_log ORDER BY id")
        .all()
        .map((row) => ({ outcome: row.outcome, detail: row.detail })),
  };
}

const realFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("late signal: an enriched VPN answer stores the row and cancels the email", async () => {
  const ctx = setup({ key: "test-key" });
  stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Sapphire VPN", domain: "sapphirevpn.net", type: "hosting" },
        privacy: { is_vpn: true, is_proxy: false, is_tor: false, is_abuser: false },
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(ctx.sent.length, 0, "no email may be sent");
  assert.deepEqual(ctx.alertLog(), [{ outcome: "suppressed_enrichment", detail: "is_vpn" }]);

  const row = ctx.enrichmentRow();
  assert.ok(row, "the enrichment row is still stored");
  assert.equal(row.is_vpn, 1);
  assert.equal(row.company_name, "Sapphire VPN");
  assert.equal(row.source, "ptr+iplocate");
});

test("late signal: a hosting company type cancels the email even with clean flags", async () => {
  const ctx = setup({ key: "test-key" });
  stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "DigitalOcean", domain: "digitalocean.com", type: "hosting" },
        privacy: { is_vpn: false, is_proxy: false, is_tor: false },
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(ctx.sent.length, 0);
  assert.deepEqual(ctx.alertLog(), [
    { outcome: "suppressed_enrichment", detail: "company_type=hosting" },
  ]);
  assert.equal(ctx.enrichmentRow().company_type, "hosting");
});

test("a clean enriched visit sends, and the email carries the enrichment", async () => {
  const ctx = setup({ key: "test-key" });
  stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
        privacy: { is_vpn: false, is_proxy: false, is_tor: false, is_abuser: false },
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(ctx.sent.length, 1);
  assert.deepEqual(ctx.alertLog(), [{ outcome: "sent", detail: null }]);

  const raw = ctx.sent[0].raw;
  assert.match(raw, /^Subject: Visit - Acme Corp \(GB\)$/m);
  assert.match(raw, /^Company:  Acme Corp \(acme-corp\.example, business\)$/m);
  assert.match(raw, /^rDNS:     gateway\.acme-corp\.example$/m);
  assert.match(raw, /^Device:   Chrome 141 on macOS 10\.15, desktop$/m);
  assert.match(raw, /^Referrer: \(direct\)$/m);
  assert.equal(/null/.test(raw), false, "no line prints the word null");
  assert.equal(raw.includes(IP), false, "the address never reaches the message");

  assert.equal(ctx.enrichmentRow().source, "ptr+iplocate");
});

test("graceful degradation: no IPLOCATE_KEY still stores source=ptr and still sends", async () => {
  const ctx = setup();
  const calls = stubFetch([["cloudflare-dns.com", PTR_ANSWER]]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(calls.filter((c) => c.includes("iplocate.io")).length, 0, "no provider is invented");
  assert.equal(ctx.sent.length, 1, "the alert still sends");
  assert.deepEqual(ctx.alertLog(), [{ outcome: "sent", detail: null }]);

  const row = ctx.enrichmentRow();
  assert.equal(row.source, "ptr");
  assert.equal(row.ptr, "gateway.acme-corp.example");
  assert.equal(row.company_name, null);
  assert.equal(row.is_vpn, null);
  assert.equal(row.error, "iplocate: IPLOCATE_KEY secret absent");

  const raw = ctx.sent[0].raw;
  assert.match(raw, /^Subject: Visit - Acme Broadband \(GB\)$/m);
  assert.equal(/^Company:/m.test(raw), false, "the Company line is omitted, not blank");
  assert.match(raw, /^rDNS:     gateway\.acme-corp\.example$/m);
});

test("graceful degradation: both providers failing still stores source=ua-only and still sends", async () => {
  const ctx = setup();
  stubFetch([
    [
      "cloudflare-dns.com",
      () => {
        throw new Error("timed out");
      },
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(ctx.sent.length, 1);
  const row = ctx.enrichmentRow();
  assert.equal(row.source, "ua-only");
  assert.equal(row.ptr, null);
  assert.equal(row.browser, "Chrome 141");
  assert.equal(row.device, "desktop");
  assert.match(row.error, /^ptr: timed out; iplocate: IPLOCATE_KEY secret absent$/);
  assert.match(ctx.sent[0].raw, /^Device:   Chrome 141 on macOS 10\.15, desktop$/m);
});

test("a hostile PTR record cannot inject a header", async () => {
  const ctx = setup();
  stubFetch([
    [
      "cloudflare-dns.com",
      jsonResponse({
        Answer: [{ type: 12, data: "evil.example\r\nBcc: victim@example.com\r\n" }],
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  const raw = ctx.sent[0].raw;
  assert.equal(/Bcc:/i.test(raw.split("\r\n\r\n")[0]), false, "no header was injected");
  // Every CR and LF became "?", including the pair the record ended with, so
  // the trailing-dot strip found no dot to strip. That is the point: the
  // sanitiser runs before anything else looks at the value.
  assert.match(raw, /^rDNS:     evil\.example\?\?Bcc: victim@example\.com\?\?$/m);
});

test("the address is never written to a table or to a cache key", async () => {
  const ctx = setup({ key: "test-key" });
  stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({ company: { name: "Acme Corp", type: "business" }, privacy: {} }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  for (const table of ["visits", "enrichment", "alerts_sent", "alert_log"]) {
    const dump = JSON.stringify(ctx.db.prepare("SELECT * FROM " + table).all());
    assert.equal(dump.includes(IP), false, "raw IP found in " + table);
  }
  const keys = [...ctx.env.VISIT_ENRICH.keys.keys()];
  assert.ok(keys.length > 0, "the cache was written");
  for (const key of keys) {
    assert.equal(key.includes(IP), false, "raw IP found in cache key " + key);
  }
});

test("the ASN cache spares the second lookup but not the security verdict", async () => {
  const ctx = setup({ key: "test-key" });
  const calls = stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
        privacy: { is_vpn: false },
      }),
    ],
  ]);

  const first = await worker.enrichVisit(ctx.env, ctx.visit);
  assert.equal(first.isVpn, 0, "a live answer carries the flag");

  const second = await worker.enrichVisit(ctx.env, ctx.visit);
  assert.equal(calls.filter((c) => c.includes("iplocate.io")).length, 1, "the ASN cache answered");
  assert.equal(second.companyName, "Acme Corp");
  assert.equal(second.isVpn, null, "a cached company carries no per-address verdict");
  assert.equal(worker.enrichmentSuppresses(second), null);
});

// Each privacy flag on its own is enough. IPLocate reports these per address,
// under privacy.*, and is_anonymous is deliberately not one of them: it is a
// convenience OR over is_proxy, is_tor, is_vpn and is_icloud_relay, and an
// iCloud Private Relay exit is a person, not a machine.
const PRIVACY_FLAG_CASES = [
  ["is_vpn", "is_vpn"],
  ["is_proxy", "is_proxy"],
  ["is_tor", "is_tor"],
  ["is_abuser", "is_abuser"],
  ["is_hosting", "is_hosting"],
];

for (const [flag, detail] of PRIVACY_FLAG_CASES) {
  test("late signal: privacy." + flag + " alone cancels the email", async () => {
    const ctx = setup({ key: "test-key" });
    const privacy = {
      is_abuser: false,
      is_anonymous: false,
      is_bogon: false,
      is_hosting: false,
      is_icloud_relay: false,
      is_proxy: false,
      is_tor: false,
      is_vpn: false,
    };
    privacy[flag] = true;
    stubFetch([
      ["cloudflare-dns.com", PTR_ANSWER],
      [
        "iplocate.io",
        jsonResponse({
          company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
          privacy,
        }),
      ],
    ]);

    await worker.maybeAlert(ctx.env, ctx.visit);

    assert.equal(ctx.sent.length, 0, "no email may be sent for " + flag);
    assert.deepEqual(ctx.alertLog(), [
      { outcome: "suppressed_enrichment", detail },
    ]);
    const row = ctx.enrichmentRow();
    assert.equal(row.company_name, "Acme Corp", "the row is still stored");
    if (flag === "is_abuser") {
      // The one suppressing flag with no column of its own. It decides in
      // memory and is visible only as alert_log.detail, which is why the
      // deepEqual on alertLog() above is the whole record of it.
      assert.equal(flag in row, false, "is_abuser is deliberately not a column");
    } else {
      assert.equal(row[flag], 1, "the flag that suppressed is on the stored row");
    }
  });
}

test("late signal: is_anonymous on its own is not a suppression", async () => {
  const ctx = setup({ key: "test-key" });
  stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
        privacy: {
          is_abuser: false,
          is_anonymous: true,
          is_bogon: false,
          is_hosting: false,
          is_icloud_relay: true,
          is_proxy: false,
          is_tor: false,
          is_vpn: false,
        },
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(ctx.sent.length, 1);
  assert.deepEqual(ctx.alertLog(), [{ outcome: "sent", detail: null }]);
});

test("the API key never appears in a request URL", async () => {
  const ctx = setup({ key: "sk-do-not-log-me" });
  const calls = stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
        privacy: { is_vpn: false },
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(calls.filter((c) => c.includes("iplocate.io")).length, 1);
  for (const call of calls) {
    assert.equal(call.includes("sk-do-not-log-me"), false, "key found in " + call);
  }
});

// is_hosting is per-address, so it must not survive an ASN-keyed cache hit.
// The first visit suppresses on a live answer; the second reads the cached
// company for the same ASN, gets is_hosting back as null - "not asked" - and
// alerts. Inheriting the first address's verdict for the whole network would
// silently mute every visitor behind that ASN.
test("late signal: is_hosting is not inherited from an ASN cache hit", async () => {
  const ctx = setup({ key: "test-key" });
  const calls = stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
        privacy: {
          is_abuser: false,
          is_anonymous: false,
          is_bogon: false,
          is_hosting: true,
          is_icloud_relay: false,
          is_proxy: false,
          is_tor: false,
          is_vpn: false,
        },
      }),
    ],
  ]);

  const live = await worker.enrichVisit(ctx.env, ctx.visit);
  assert.equal(live.isHosting, 1, "a live answer carries the flag");
  assert.equal(worker.enrichmentSuppresses(live), "is_hosting");

  const cached = await worker.enrichVisit(ctx.env, ctx.visit);
  assert.equal(calls.filter((c) => c.includes("iplocate.io")).length, 1, "the ASN cache answered");
  assert.equal(cached.companyName, "Acme Corp", "the company is served from cache");
  assert.equal(cached.isHosting, null, "a cached company carries no per-address verdict");
  assert.equal(worker.enrichmentSuppresses(cached), null);
});

test("the stored row records is_hosting as 1, 0 and NULL distinctly", async () => {
  const ctx = setup({ key: "test-key" });
  stubFetch([
    ["cloudflare-dns.com", PTR_ANSWER],
    [
      "iplocate.io",
      jsonResponse({
        company: { name: "Acme Corp", domain: "acme-corp.example", type: "business" },
        privacy: { is_vpn: false, is_hosting: false },
      }),
    ],
  ]);

  await worker.maybeAlert(ctx.env, ctx.visit);

  assert.equal(ctx.sent.length, 1, "a clean answer still sends");
  const row = ctx.enrichmentRow();
  assert.equal(row.is_hosting, 0, "a false answer is stored as 0, not NULL");
  assert.equal(row.is_tor, null, "an absent flag stays NULL");
});
