// Tests for the address normalisation that visitor_hash is built on, and for
// the two places the change had to stop short of the raw address.
//
// Nothing is re-implemented. normaliseIpForHash and logVisit are the shipped
// functions out of src/index.js, and the hash assertions are made on the value
// logVisit actually binds into the INSERT, not on a formula copied out of it.
//
// The IPv6 fixtures are the real shape of the problem: an address on a BT
// consumer /64 whose interface identifier rotates daily under RFC 4941, which
// is why the same person was reading as a new visitor every day.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadWorker } from "./harness.mjs";

const { normaliseIpForHash, logVisit, lookupPtr, reverseDnsName } = loadWorker();

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

// Three addresses on one /64, the third written with the zero groups spelled
// out, plus one address on the neighbouring /64.
const V6_A = "2a00:23c7:1ff8:2001:e5eb:34c0:3e45:97c";
const V6_B = "2a00:23c7:1ff8:2001::1";
const V6_C = "2a00:23c7:1ff8:2001:0:0:0:99";
const V6_OTHER = "2a00:23c7:1ff8:2002::1";
const PREFIX = "2a00:23c7:1ff8:2001::/64";

// --- normaliseIpForHash -----------------------------------------------------

const CASES = [
  ["IPv6 with a rotating identifier", V6_A, PREFIX, "ipv6-64"],
  ["IPv6 compressed to one group", V6_B, PREFIX, "ipv6-64"],
  ["IPv6 with the zero groups spelled out", V6_C, PREFIX, "ipv6-64"],
  ["IPv6 uppercase", "2A00:23C7:1FF8:2001:E5EB:34C0:3E45:97C", PREFIX, "ipv6-64"],
  [
    "IPv6 fully expanded, leading zeros included",
    "2a00:23c7:1ff8:2001:0000:0000:0000:0001",
    PREFIX,
    "ipv6-64",
  ],
  ["IPv6 on the neighbouring /64", V6_OTHER, "2a00:23c7:1ff8:2002::/64", "ipv6-64"],
  ["IPv6 loopback", "::1", "0000:0000:0000:0000::/64", "ipv6-64"],
  ["IPv6 unspecified", "::", "0000:0000:0000:0000::/64", "ipv6-64"],
  [
    "IPv6 with an embedded dotted quad",
    "::ffff:203.0.113.9",
    "0000:0000:0000:0000::/64",
    "ipv6-64",
  ],
  [
    "IPv6 with a short hextet, zero padded not dropped",
    "2001:db8:0:1:2:3:4:5",
    "2001:0db8:0000:0001::/64",
    "ipv6-64",
  ],
  ["IPv4 is passed through whole", "86.181.229.144", "86.181.229.144", "ipv4"],
  ["IPv4 zero octets are kept", "10.0.0.1", "10.0.0.1", "ipv4"],
  ["IPv4 documentation range", "203.0.113.9", "203.0.113.9", "ipv4"],
  ["hostname is not an address", "example.com", "example.com", "raw"],
  ["IPv4 with a bad octet", "999.1.1.1", "999.1.1.1", "raw"],
  ["IPv6 with too many groups", "1:2:3:4:5:6:7:8:9", "1:2:3:4:5:6:7:8:9", "raw"],
  ["IPv6 with a zone index", "fe80::1%eth0", "fe80::1%eth0", "raw"],
  ["empty string", "", "", "raw"],
];

for (const [name, input, value, scope] of CASES) {
  test("normalise: " + name, () => {
    assert.deepEqual(normaliseIpForHash(input), { value, scope });
  });
}

test("normalise: non-string input does not throw", () => {
  for (const input of [null, undefined, 42, {}, []]) {
    const out = normaliseIpForHash(input);
    assert.equal(out.scope, "raw");
    assert.equal(out.value, input);
  }
});

test("normalise: an IPv4 address cannot produce an IPv6 value", () => {
  const seen = new Set();
  for (const ip of [V6_A, V6_B, V6_C, V6_OTHER, "::1", "::", "::ffff:203.0.113.9"]) {
    seen.add(normaliseIpForHash(ip).value);
  }
  for (const ip of ["86.181.229.144", "203.0.113.9", "10.0.0.1", "0.0.0.0"]) {
    assert.equal(seen.has(normaliseIpForHash(ip).value), false, ip);
  }
});

// --- the hash logVisit actually writes --------------------------------------

// Captures every bind() the shipped logVisit makes, and reads columns back by
// name out of the INSERT itself rather than by a hardcoded position.
function stubDb() {
  const calls = [];
  return {
    calls,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                calls.push({ sql, args });
                return { meta: { last_row_id: calls.length, changes: 1 } };
              },
              async first() {
                return null;
              },
            };
          },
        };
      },
    },
  };
}

function insertedRow(calls) {
  const call = calls.find((c) => c.sql.indexOf("INSERT INTO visits") === 0);
  assert.ok(call, "no INSERT INTO visits was issued");
  const columns = call.sql
    .slice(call.sql.indexOf("(") + 1, call.sql.indexOf(")"))
    .split(",")
    .map((c) => c.trim());
  const row = {};
  columns.forEach((column, i) => {
    row[column] = call.args[i];
  });
  return row;
}

async function logged(ip) {
  const db = stubDb();
  const request = {
    url: "https://ryanhennebry.xyz/",
    cf: { asn: 2856, asOrganization: "British Telecommunications PLC" },
    headers: new Headers({ "user-agent": UA, "cf-connecting-ip": ip }),
  };
  // No ALERT_EMAIL: maybeAlert returns before it touches anything.
  await logVisit(request, { status: 200 }, { DB: db.DB });
  return insertedRow(db.calls);
}

test("hash: three addresses on one /64 hash identically", async () => {
  const rows = await Promise.all([logged(V6_A), logged(V6_B), logged(V6_C)]);
  const months = new Set(rows.map((r) => r.ts.slice(0, 7)));
  assert.equal(months.size, 1, "test straddled a month boundary; re-run");
  assert.equal(rows[0].visitor_hash, rows[1].visitor_hash);
  assert.equal(rows[1].visitor_hash, rows[2].visitor_hash);
  assert.equal(typeof rows[0].visitor_hash, "string");
  assert.equal(rows[0].visitor_hash.length, 64);
});

test("hash: a different /64 hashes differently", async () => {
  const [same, other] = await Promise.all([logged(V6_A), logged(V6_OTHER)]);
  assert.notEqual(same.visitor_hash, other.visitor_hash);
});

test("hash: IPv4 does not collide with any of the IPv6 forms", async () => {
  const rows = await Promise.all([
    logged("86.181.229.144"),
    logged(V6_A),
    logged(V6_OTHER),
    logged("::1"),
  ]);
  assert.equal(new Set(rows.map((r) => r.visitor_hash)).size, 4);
});

test("hash: two IPv4 addresses still hash differently", async () => {
  const [a, b] = await Promise.all([logged("86.181.229.144"), logged("86.181.229.145")]);
  assert.notEqual(a.visitor_hash, b.visitor_hash);
});

test("hash_scope is written for every scope", async () => {
  const rows = await Promise.all([
    logged(V6_A),
    logged("86.181.229.144"),
    logged("example.com"),
  ]);
  assert.deepEqual(
    rows.map((r) => r.hash_scope),
    ["ipv6-64", "ipv4", "raw"]
  );
});

test("hash: an unparseable address is logged, not dropped", async () => {
  const row = await logged("not-an-address");
  assert.equal(row.hash_scope, "raw");
  assert.equal(typeof row.visitor_hash, "string");
  assert.equal(row.visitor_hash.length, 64);
});

test("hash: the salt version breaks continuity with the v1 hash", async () => {
  const row = await logged(V6_A);
  const v1 = createHash("sha256")
    .update(V6_A + UA + row.ts.slice(0, 7))
    .digest("hex");
  assert.notEqual(
    row.visitor_hash,
    v1,
    "v2 reproduced a v1 hash; the version tag is not in the input"
  );
});

// --- PTR cache --------------------------------------------------------------

const HIT_TTL = 7 * 24 * 60 * 60;
const MISS_TTL = 6 * 60 * 60;

function stubKv() {
  const store = new Map();
  const puts = [];
  const gets = [];
  return {
    puts,
    gets,
    env: {
      VISIT_ENRICH: {
        async get(key) {
          gets.push(key);
          return store.has(key) ? store.get(key) : null;
        },
        async put(key, value, options) {
          puts.push({ key, value, options });
          store.set(key, value);
        },
      },
    },
  };
}

function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return handler(String(url), init || {});
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function dohResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

async function ptr(kv, ip, body) {
  const stub = stubFetch(async () => dohResponse(body));
  try {
    const value = await lookupPtr(kv.env, ip, []);
    return { value, calls: stub.calls };
  } finally {
    stub.restore();
  }
}

test("ptr: the DNS query uses the full address, not the /64", async () => {
  const kv = stubKv();
  const { calls } = await ptr(kv, V6_A, { Status: 3 });
  assert.equal(calls.length, 1);
  const name = new URL(calls[0].url).searchParams.get("name");
  assert.equal(name, reverseDnsName(V6_A));
  // 32 nibbles: the whole 128 bits, so the interface identifier is present.
  assert.equal(name.split(".").length, 34);
  assert.notEqual(name, reverseDnsName(V6_B));
});

test("ptr: a rotating identifier reuses one cache key", async () => {
  const kv = stubKv();
  const first = await ptr(kv, V6_A, {
    Status: 0,
    Answer: [{ type: 12, data: "host.example.net." }],
  });
  assert.equal(first.value, "host.example.net");
  assert.equal(first.calls.length, 1);

  // Same /64, new identifier: served from the entry the first call wrote.
  const second = await ptr(kv, V6_B, { Status: 3 });
  assert.equal(second.value, "host.example.net");
  assert.equal(second.calls.length, 0, "a rotated address missed the cache");
  assert.deepEqual(kv.gets[0], kv.gets[1]);
});

test("ptr: a different /64 does not share the cache entry", async () => {
  const kv = stubKv();
  await ptr(kv, V6_A, { Status: 0, Answer: [{ type: 12, data: "host.example.net." }] });
  const other = await ptr(kv, V6_OTHER, { Status: 3 });
  assert.equal(other.value, null);
  assert.equal(other.calls.length, 1);
});

test("ptr: a hit is cached for 7 days", async () => {
  const kv = stubKv();
  await ptr(kv, V6_A, { Status: 0, Answer: [{ type: 12, data: "host.example.net." }] });
  assert.equal(kv.puts.length, 1);
  assert.equal(kv.puts[0].value, "host.example.net");
  assert.deepEqual(kv.puts[0].options, { expirationTtl: HIT_TTL });
});

test("ptr: a miss is cached for 6 hours", async () => {
  const kv = stubKv();
  await ptr(kv, V6_A, { Status: 3 });
  assert.equal(kv.puts.length, 1);
  assert.equal(kv.puts[0].value, "-");
  assert.deepEqual(kv.puts[0].options, { expirationTtl: MISS_TTL });
});

test("ptr: the two TTLs are different, and the miss is the shorter", async () => {
  const kv = stubKv();
  await ptr(kv, V6_A, { Status: 3 });
  await ptr(kv, "86.181.229.144", {
    Status: 0,
    Answer: [{ type: 12, data: "host.example.net." }],
  });
  const ttls = kv.puts.map((p) => p.options.expirationTtl);
  assert.deepEqual(ttls, [MISS_TTL, HIT_TTL]);
  assert.ok(ttls[0] < ttls[1]);
});

test("ptr: the cache key never contains the address", async () => {
  const kv = stubKv();
  await ptr(kv, V6_A, { Status: 3 });
  for (const key of kv.gets.concat(kv.puts.map((p) => p.key))) {
    assert.equal(key.indexOf("2a00"), -1, key);
    assert.equal(key.indexOf(V6_A), -1, key);
    assert.match(key, /^ptr:[0-9a-f]{32}$/);
  }
});
