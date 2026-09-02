// Provider tests for the shipped enrichment layer.
//
// These run the real lookupPtr and lookupCompany out of src/index.js against a
// stubbed global fetch. Nothing is re-implemented. The DoH payload in the first
// case is the verbatim response from
//   curl -H 'Accept: application/dns-json' \
//     'https://cloudflare-dns.com/dns-query?name=144.229.181.86.in-addr.arpa&type=PTR'
// captured on 2026-09-01, which is the address behind production visit 7121 -
// the visit that stored ptr NULL while the record resolved.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./harness.mjs";

const { lookupPtr, lookupCompany, enrichVisit } = loadWorker();

const IP = "86.181.229.144";
const NAME = "144.229.181.86.in-addr.arpa";
const HOST = "host86-181-229-144.range86-181.btcentralplus.com";

// The live payload, trailing dot on data included.
const LIVE_DOH = {
  Status: 0,
  TC: false,
  RD: true,
  RA: true,
  AD: false,
  CD: false,
  Question: [{ name: NAME, type: 12 }],
  Answer: [{ name: NAME, type: 12, TTL: 21600, data: HOST + "." }],
};

// A response object with only the surface the code touches.
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (typeof body === "string") {
        return JSON.parse(body);
      }
      return body;
    },
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
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

async function runPtr(handler, ip) {
  const notes = [];
  const stub = stubFetch(handler);
  try {
    const value = await lookupPtr({}, ip === undefined ? IP : ip, notes);
    return { value, notes, calls: stub.calls };
  } finally {
    stub.restore();
  }
}

// [label, fetch handler, expected return, expected note pattern]
const PTR_CASES = [
  [
    "live Cloudflare DoH payload, trailing dot stripped",
    () => jsonResponse(200, LIVE_DOH),
    HOST,
    null,
  ],
  [
    "NXDOMAIN",
    () => jsonResponse(200, { Status: 3, Question: [{ name: NAME, type: 12 }] }),
    null,
    /^ptr: NXDOMAIN$/,
  ],
  [
    "NOERROR with an empty Answer array",
    () => jsonResponse(200, { Status: 0, Answer: [] }),
    null,
    /^ptr: no PTR record in answer$/,
  ],
  [
    "SERVFAIL is a resolver failure, not an answer",
    () => jsonResponse(200, { Status: 2, Answer: [] }),
    null,
    /^ptr: dns status 2$/,
  ],
  [
    "Status field absent is read as NOERROR, the answer still counts",
    () => jsonResponse(200, { Answer: [{ type: 12, data: HOST + "." }] }),
    HOST,
    null,
  ],
  [
    "REFUSED",
    () => jsonResponse(200, { Status: 5 }),
    null,
    /^ptr: dns status 5$/,
  ],
  [
    "timeout or transport failure",
    () => {
      throw new Error("The operation was aborted due to timeout");
    },
    null,
    /^ptr: The operation was aborted due to timeout$/,
  ],
  [
    "non-2xx from the resolver",
    () => jsonResponse(500, { Status: 2 }),
    null,
    /^ptr: dns-query HTTP 500$/,
  ],
  [
    "malformed body, wire format instead of JSON",
    () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token in JSON at position 0");
      },
      text: async () => "\x00\x01binary",
    }),
    null,
    /^ptr: dns-query body unreadable: Unexpected token/,
  ],
  [
    "body is not an object",
    () => jsonResponse(200, "null"),
    null,
    /^ptr: dns-query body not an object$/,
  ],
  [
    "Answer present but not an array",
    () => jsonResponse(200, { Status: 0, Answer: "host.example.com." }),
    null,
    /^ptr: dns-query answer malformed$/,
  ],
  [
    "CNAME ahead of the PTR record in Answer",
    () =>
      jsonResponse(200, {
        Status: 0,
        Answer: [
          { name: NAME, type: 5, TTL: 300, data: "alias.example.com." },
          { name: NAME, type: 12, TTL: 21600, data: HOST + "." },
        ],
      }),
    HOST,
    null,
  ],
];

test("PTR lookup: every path either returns a name or records why not", async () => {
  for (const [label, handler, expected, notePattern] of PTR_CASES) {
    const { value, notes } = await runPtr(handler);
    assert.equal(value, expected, label + " (return value)");
    if (notePattern === null) {
      assert.deepEqual(notes, [], label + " (no note expected)");
    } else {
      assert.equal(notes.length, 1, label + " (exactly one note): " + notes.join("; "));
      assert.match(notes[0], notePattern, label + " (note text)");
    }
  }
});

test("PTR lookup: no trailing dot survives on the returned name", async () => {
  const { value } = await runPtr(() => jsonResponse(200, LIVE_DOH));
  assert.equal(value, HOST);
  assert.equal(value.endsWith("."), false);
});

test("PTR lookup: an unusable address is reported, not silently dropped", async () => {
  const { value, notes, calls } = await runPtr(
    () => jsonResponse(200, LIVE_DOH),
    "not-an-address"
  );
  assert.equal(value, null);
  assert.deepEqual(notes, ["ptr: no reverse name for address"]);
  assert.equal(calls.length, 0);
});

test("PTR lookup: request carries the dns-json Accept header and a timeout", async () => {
  const { calls } = await runPtr(() => jsonResponse(200, LIVE_DOH));
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(url.origin + url.pathname, "https://cloudflare-dns.com/dns-query");
  assert.equal(url.searchParams.get("name"), NAME);
  assert.equal(url.searchParams.get("type"), "PTR");
  // Without this header Cloudflare answers in binary wire format and JSON.parse
  // throws, which is exactly how a resolvable name turns into a null.
  assert.equal(calls[0].init.headers.Accept, "application/dns-json");
  assert.ok(calls[0].init.signal, "an abort signal is attached");
  assert.equal(calls[0].init.signal.aborted, false);
});

// --- IPLocate ---------------------------------------------------------------
//
// Every fixture below is shaped from the vendor's own documented payloads, not
// invented and not carried over from the provider this replaced:
//   https://www.iplocate.io/docs/ip-intelligence-api/data-types  (company,
//     privacy and asn objects, and the company.type vocabulary)
//   https://www.iplocate.io/docs/reference/api-errors  ({"error": "..."} and
//     401 for both a missing and an invalid key)
//   https://www.iplocate.io/docs/getting-started/authentication  (apikey query
//     parameter or X-API-Key header; this code uses the header)

const UNAUTHORIZED_BODY = JSON.stringify({ error: "Invalid API key" });

// The 8.8.8.8 example response from the data-types page, trimmed to the two
// objects lookupCompany reads.
const DOC_EXAMPLE = {
  ip: "8.8.8.8",
  asn: {
    asn: "AS15169",
    route: "8.8.8.0/24",
    netname: "GOOGLE",
    name: "Google LLC",
    country_code: "US",
    domain: "google.com",
    type: "hosting",
    rir: "ARIN",
  },
  privacy: {
    is_abuser: false,
    is_anonymous: true,
    is_bogon: false,
    is_hosting: true,
    is_icloud_relay: false,
    is_proxy: false,
    is_tor: false,
    is_vpn: true,
  },
  company: {
    name: "Google LLC",
    domain: "google.com",
    country_code: "US",
    type: "hosting",
  },
};

async function companyError(response) {
  const stub = stubFetch(() => response);
  try {
    await lookupCompany({ IPLOCATE_KEY: "k" }, IP, 5607);
    return null;
  } catch (err) {
    return err.message;
  } finally {
    stub.restore();
  }
}

test("iplocate: a 401 carries the error body, not just the status", async () => {
  const message = await companyError(jsonResponse(401, UNAUTHORIZED_BODY));
  assert.match(message, /^iplocate HTTP 401 /);
  assert.match(message, /Invalid API key/);
});

test("iplocate: a 429 is distinguishable from a rejected key", async () => {
  const message = await companyError(
    jsonResponse(
      429,
      JSON.stringify({
        error: "Rate limit exceeded. Please upgrade your plan at iplocate.io/account",
      })
    )
  );
  assert.match(message, /^iplocate HTTP 429 /);
  assert.match(message, /Rate limit exceeded/);
});

test("iplocate: the captured body is capped at 200 ASCII characters", async () => {
  const message = await companyError(jsonResponse(401, "x\n".repeat(400)));
  const detail = message.slice("iplocate HTTP 401 ".length);
  assert.equal(detail.length, 200);
  assert.equal(/[^\x20-\x7e]/.test(detail), false);
  assert.equal(detail.indexOf("\n"), -1);
});

test("iplocate: an unreadable body still yields a diagnosable message", async () => {
  const message = await companyError({
    ok: false,
    status: 401,
    text: async () => {
      throw new Error("stream already consumed");
    },
  });
  assert.equal(message, "iplocate HTTP 401 body unreadable: stream already consumed");
});

test("iplocate: the documented example response maps onto the row", async () => {
  const stub = stubFetch(() => jsonResponse(200, DOC_EXAMPLE));
  try {
    const out = await lookupCompany({ IPLOCATE_KEY: "k" }, IP, 15169);
    assert.deepEqual(out, {
      companyName: "Google LLC",
      companyDomain: "google.com",
      companyType: "hosting",
      isVpn: 1,
      isProxy: 0,
      isTor: 0,
      isAbuser: 0,
      isHosting: 1,
    });
  } finally {
    stub.restore();
  }
});

test("iplocate: an isp answer with a live abuser flag", async () => {
  const stub = stubFetch(() =>
    jsonResponse(200, {
      company: { name: "BT", domain: "bt.com", country_code: "GB", type: "isp" },
      privacy: {
        is_abuser: true,
        is_anonymous: false,
        is_bogon: false,
        is_hosting: false,
        is_icloud_relay: false,
        is_proxy: false,
        is_tor: false,
        is_vpn: false,
      },
    })
  );
  try {
    const out = await lookupCompany({ IPLOCATE_KEY: "k" }, IP, 2856);
    assert.deepEqual(out, {
      companyName: "BT",
      companyDomain: "bt.com",
      companyType: "isp",
      isVpn: 0,
      isProxy: 0,
      isTor: 0,
      isAbuser: 1,
      isHosting: 0,
    });
  } finally {
    stub.restore();
  }
});

test("iplocate: the request is the documented lookup URL with the key in a header", async () => {
  const stub = stubFetch(() => jsonResponse(200, DOC_EXAMPLE));
  try {
    await lookupCompany({ IPLOCATE_KEY: "secret-key" }, IP, 2856);
    assert.equal(stub.calls.length, 1);
    // The key never appears in the URL, so it cannot leak through a log line,
    // a redirect or a captured error string.
    assert.equal(stub.calls[0].url, "https://iplocate.io/api/lookup/" + IP);
    assert.equal(stub.calls[0].url.includes("secret-key"), false);
    assert.equal(stub.calls[0].init.headers["X-API-Key"], "secret-key");
    assert.equal(stub.calls[0].init.headers.Accept, "application/json");
    assert.ok(stub.calls[0].init.signal, "an abort signal is attached");
    assert.equal(stub.calls[0].init.signal.aborted, false);
  } finally {
    stub.restore();
  }
});

// The data-types page states that a top-level object is absent, not null, when
// IPLocate has nothing for the address. A missing company must read as "no
// answer", never as a crash.
test("iplocate: an absent company or privacy object degrades to nulls", async () => {
  const stub = stubFetch(() => jsonResponse(200, { ip: IP, country: "United Kingdom" }));
  try {
    const out = await lookupCompany({ IPLOCATE_KEY: "k" }, IP, 2856);
    assert.deepEqual(out, {
      companyName: null,
      companyDomain: null,
      companyType: null,
      isVpn: null,
      isProxy: null,
      isTor: null,
      isAbuser: null,
      isHosting: null,
    });
  } finally {
    stub.restore();
  }
});

// --- Orchestration ----------------------------------------------------------

test("visit 7121 shape: both failures now appear in the error column", async () => {
  const stub = stubFetch((url) => {
    if (url.indexOf("cloudflare-dns.com") !== -1) {
      return jsonResponse(200, { Status: 0, Answer: [] });
    }
    return jsonResponse(401, UNAUTHORIZED_BODY);
  });
  try {
    const out = await enrichVisit(
      { IPLOCATE_KEY: "k" },
      {
        ip: IP,
        asn: 2856,
        ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      }
    );
    assert.equal(out.ptr, null);
    assert.equal(out.source, "ua-only");
    assert.match(out.error, /ptr: no PTR record in answer/);
    assert.match(out.error, /iplocate HTTP 401 .*Invalid API key/);
    // The user agent half of the row was never in doubt and stays intact.
    assert.equal(out.browser, "Chrome 141");
    assert.equal(out.device, "desktop");
  } finally {
    stub.restore();
  }
});

test("visit 7121 shape: the PTR that resolves is now stored", async () => {
  const stub = stubFetch((url) => {
    if (url.indexOf("cloudflare-dns.com") !== -1) {
      return jsonResponse(200, LIVE_DOH);
    }
    return jsonResponse(401, UNAUTHORIZED_BODY);
  });
  try {
    const out = await enrichVisit({ IPLOCATE_KEY: "k" }, { ip: IP, asn: 2856, ua: "" });
    assert.equal(out.ptr, HOST);
    assert.equal(out.source, "ptr");
    assert.match(out.error, /^iplocate: iplocate HTTP 401 /);
  } finally {
    stub.restore();
  }
});

// AbortSignal.timeout(3000) rejects with this message. It has to survive into
// the error column, or a slow provider is indistinguishable from an absent one.
test("iplocate: a timeout degrades to source=ptr with the reason recorded", async () => {
  const stub = stubFetch((url) => {
    if (url.indexOf("cloudflare-dns.com") !== -1) {
      return jsonResponse(200, LIVE_DOH);
    }
    throw new Error("The operation was aborted due to timeout");
  });
  try {
    const out = await enrichVisit({ IPLOCATE_KEY: "k" }, { ip: IP, asn: 2856, ua: "" });
    assert.equal(out.ptr, HOST);
    assert.equal(out.source, "ptr");
    assert.equal(out.companyName, null);
    assert.equal(out.isVpn, null);
    assert.equal(out.error, "iplocate: The operation was aborted due to timeout");
  } finally {
    stub.restore();
  }
});

test("iplocate: no key means no request and no invented provider", async () => {
  const stub = stubFetch(() => jsonResponse(200, LIVE_DOH));
  try {
    const out = await enrichVisit({}, { ip: IP, asn: 2856, ua: "" });
    assert.equal(
      stub.calls.filter((c) => c.url.includes("iplocate.io")).length,
      0,
      "the provider is not called without a key"
    );
    assert.equal(out.source, "ptr");
    assert.equal(out.error, "iplocate: IPLOCATE_KEY secret absent");
  } finally {
    stub.restore();
  }
});
