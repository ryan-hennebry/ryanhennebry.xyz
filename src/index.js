// Server-side visit log for ryanhennebry.xyz.
//
// The Worker runs first on every request, hands the request straight to the
// static asset server, and returns that response untouched. Logging happens
// after the response is on its way, inside ctx.waitUntil, so it adds no
// latency and cannot change what a visitor sees. Every request is stored;
// classification is a column, never a filter.
//
// No raw IP address is ever written. The IP is only an input to a SHA-256
// hash that is salted with the current calendar month, so a repeat visit is
// detectable within a month and unlinkable across months. What goes into that
// hash is the normalised address, not the address: an IPv6 client is reduced
// to its /64 prefix first, because the low 64 bits rotate daily under RFC 4941
// privacy extensions and were turning one returning person into a new visitor
// every day. See normaliseIpForHash.
//
// A second, much narrower question is asked after the row is written: is this
// worth an email? The bar is isGenuineVisit, which is deliberately tighter
// than classification === 'human'. 'human' is a residual bucket running at
// roughly two junk rows a day, and an alert that cries wolf is an alert that
// gets muted. Every alert attempt, including the suppressed ones, is written
// to alert_log, because the two ways this feature breaks (Email Routing not
// enabled on the zone, destination address not verified) both fail at runtime
// inside waitUntil where nobody would ever see them.
//
// Only the visits that clear that bar are enriched: reverse DNS, an optional
// company lookup behind a secret that may not be set, and a hand-rolled user
// agent parse. Enrichment is additive and cannot fail loudly. It also gets a
// veto: a VPN, proxy, Tor or hosting answer that the first pass could not see
// keeps the row and cancels the email as 'suppressed_enrichment'.

import { EmailMessage } from "cloudflare:email";

const ASSET_PATH = /\.(?:css|js|mjs|map|json|webmanifest|woff2?|ttf|otf|eot|ico|png|jpe?g|gif|svg|webp|avif|txt|xml|pdf)$/i;

const BOT_UA = /bot|crawl|spider|slurp|curl|wget|python-requests|headless|preview|fetch|monitor|uptime|lighthouse|gptbot|claudebot|perplexitybot|bytespider|ccbot/i;

// Internet-wide scanners and threat-intelligence crawlers. These announce
// themselves in the AS organisation name, not always in the user agent, so
// they are matched on as_org and take precedence over everything but assets.
// Censys, Driftnet and Palo Alto (Cortex Xpanse) are all present in the log.
const SCANNER_ORG = /censys|driftnet|shodan|binaryedge|palo alto networks|internet[- ]measurement|onyphe|leakix|stretchoid|alpha strike|netsystems research|recyber/i;

// Hosting, cloud and VPS networks seen in the log, plus the majors that were
// in the original set. Every entry below was observed as a real ASN in the
// visits table; the comment names the operator behind the AS organisation
// string, which is often a leaseholder rather than the provider.
const DATACENTER_ASNS = new Set([
  16509, 14618, // Amazon AWS (also announces as "A100 ROW GmbH", "Amazon Data Services *")
  15169, 396982, // Google and Google Cloud
  8075, // Microsoft Azure (also "Microsoft Singapore", "Microsoft Deutschland MCIO")
  14061, // DigitalOcean
  24940, // Hetzner
  16276, // OVH (also leased to Ahrefs)
  63949, // Linode
  12876, // Scaleway
  13335, // Cloudflare
  9009, // M247
  7203, 32613, // Leaseweb US and Canada
  40676, // Psychz Networks
  45090, 132203, // Tencent Cloud (132203 announces as "6 COLLYER QUAY", "ACEVILLE PTE.LTD.")
  45102, // Alibaba Cloud / Aliyun
  60068, 212238, // Datacamp / CDN77
  31898, // Oracle Cloud
  11320, // Massed Compute
  48090, // TECHOFF SRV LIMITED
  62164, // DEDIK SERVICES LIMITED
  210558, // 1337 Services GmbH (FlokiNET)
  211590, // FBW NETWORKS SAS (544 hits, 4 of them browser-like)
  197170, // TechTies Inc.
  34343, // Eweka Internet Services
  25369, // Hydra Communications
  201814, // MEVSPACE
  203020, // HostPapa / HostRoyale
  51747, // Internetbolaget (announces as "... Hosting customers")
  209946, // Partner Hosting
  209605, // "Cloud hosting"
  14956, // RouterHosting
  203516, // AltunHOST
  215925, // VPSVAULT.HOST
  29802, // Hivelocity (announces as "Private Customer")
  30058, // FDCservers (announces as "Private Customer")
  29066, // Rackmarkt
  39351, // 31173 Services
  62874, // Web2Objects
  154177, // LIGHT NODE LIMITED
  202412, // OMEGATECH
  204876, // UZMANSOFT
  200373, // 3xK Tech
  51167, // Internet Utilities NA
  54103, // MOD Mission Critical
  205759, // Ghosty Networks / "Cyber-Security-SG"
  219502, // FOP Danik Vyacheslav Evgenievich
]);

// Consumer and business access networks. Checked before the name heuristics
// below so that an ISP name always wins: "CABLE ONE", "BTBROADBAND-AGG-56"
// and "Bredband2 Customer" are people, not machines. The explicit ASN set
// above is checked first, so a hosting AS that calls its ranges "customers"
// is still caught.
const CONSUMER_ISP_ORG = /broadband|(?:^|[^a-z])a?dsl(?:[^a-z]|$)|\bcable\b|teleco|teleko|telefon|\bmobile\b|\bwireless\b|\bprovedor\b|banda larga|virgin media|sky (?:uk|broadband)|\bcomcast\b|\bvodafone\b|\bclaro\b|\bstarlink\b|\bspacex\b|consumer|\bcustomers?\b|residential|universit|\bfibre\b/i;

// Hosting, cloud and VPS by name, for networks that are not in the ASN set.
// Boundaries are deliberate: \bcolo\b must not fire on "Telmex Colombia",
// and "host" is anchored to a word start or a word end so that it catches
// "HostPapa", "AltunHOST" and "RouterHosting" without firing mid-word.
const DATACENTER_ORG = /\bhost|host\b|hosting\b|\bcloud|\bserver|\bvps|\bcolo(?:cation)?\b|data ?cent(?:er|re)|\bdatacamp\b|\bm247\b|\bovh\b|\bhetzner\b|\bdigitalocean\b|\blinode\b|\bvultr\b|\bcontabo\b|\bleaseweb\b|\bchoopa\b|\bquadranet\b|\bpsychz\b|\bscaleway\b|\brackspace\b|\bamazon\b|\baws\b|\bazure\b|\baliyun\b|\balibaba\b|\btencent\b|\bhuawei\b|\bsrv\b|\bdedik|\bcomput(?:e|ing)\b|\bflokinet\b|bulletproof/i;

function classify(pathname, ua, asn, asOrg) {
  if (ASSET_PATH.test(pathname)) {
    return "asset";
  }
  if (asOrg && SCANNER_ORG.test(asOrg)) {
    return "scanner";
  }
  if (ua && BOT_UA.test(ua)) {
    return "bot_ua";
  }
  if (typeof asn === "number" && DATACENTER_ASNS.has(asn)) {
    return "datacenter";
  }
  if (asOrg && !CONSUMER_ISP_ORG.test(asOrg) && DATACENTER_ORG.test(asOrg)) {
    return "datacenter";
  }
  return "human";
}

// ---------------------------------------------------------------------------
// Alerting
// ---------------------------------------------------------------------------

// The sender must sit on a zone with Email Routing enabled; the destination
// must be a verified Email Routing destination address. Both are dashboard
// state, not code, and both fail at send() time if absent. See alert_log.
const ALERT_FROM = "alerts@in-the-loop.studio";
const ALERT_TO = "ryanhennebry@gmail.com";
const ALERT_DOMAIN = "in-the-loop.studio";

// Anonymising networks announce themselves in the AS organisation string.
// "code200" is UAB code200, the operator behind several residential proxy
// pools; it appeared in the log with a clean macOS Chrome user agent.
const ALERT_ORG_DENY = /tor|exit|proxy|vpn|code200|relay/i;

// Referrer-spam hosts, taken from the distinct referers actually present in
// the visits table. Each arrived on a consumer ISP with a plausible desktop
// browser user agent, so nothing earlier in the pipeline catches them.
// fashionclothingnews is listed under both TLDs: .com is what the log holds,
// .co is what the same campaign has used elsewhere.
const SPAM_REFERER_HOSTS = [
  "sahammurah.com",
  "fashionclothingnews.com",
  "fashionclothingnews.co",
  "sapphirevpn.net",
];

// A real browser announces an engine and a product token. "Gecko/" carries the
// slash deliberately: every Chromium user agent contains "like Gecko)" in its
// platform comment, so a bare "Gecko" would match everything.
const BROWSER_SHAPE = /Chrome|CriOS|Safari|Firefox|FxiOS|Edg|Gecko\//;

// "(compatible;" inside a Mozilla/5.0 string is a bot tell. Of the 22 'human'
// rows in the table exactly one carries it, the CT-WP-Probe/1.2 WordPress
// scanner, and none of the accepted rows do. The cost is Trident-era Internet
// Explorer, which announced Mozilla/4.0 or 5.0 (compatible; MSIE ...) and is
// not a browser this page needs to alert on.
const UA_COMPATIBLE = /\(compatible;/i;

// Tighter than "contains Mozilla". BOT_UA is reused, not restated: it is the
// same list the classifier already uses, so the two cannot drift apart.
function isBrowserUa(ua) {
  if (!ua || !ua.includes("Mozilla/5.0")) {
    return false;
  }
  if (!BROWSER_SHAPE.test(ua)) {
    return false;
  }
  if (UA_COMPATIBLE.test(ua) || BOT_UA.test(ua)) {
    return false;
  }
  return true;
}

// A referer pointing back at this site is a self-referral, not a spam signal.
// It is treated exactly as a direct hit: it neither disqualifies a visit nor
// counts as evidence for one.
const SELF_REFERER_HOSTS = ["ryanhennebry.xyz", "www.ryanhennebry.xyz"];

// "none" | "self" | "spam" | "external"
function refererKind(referer) {
  if (!referer) {
    return "none";
  }
  let host;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch (err) {
    return "external";
  }
  if (SELF_REFERER_HOSTS.includes(host)) {
    return "self";
  }
  for (const spam of SPAM_REFERER_HOSTS) {
    if (host === spam || host.endsWith("." + spam)) {
      return "spam";
    }
  }
  return "external";
}

// A document, not a file. The last path segment carries no dot, which also
// removes the /wp-login.php, /xmlrpc.php and /.env probes that arrive from
// compromised home routers and therefore classify as 'human'.
function isDocumentPath(pathname) {
  const last = String(pathname || "").split("/").pop();
  return !last.includes(".");
}

function isGenuineVisit(visit) {
  if (!visit || visit.classification !== "human") {
    return false;
  }
  if (!isBrowserUa(visit.ua)) {
    return false;
  }
  if (!isDocumentPath(visit.path)) {
    return false;
  }
  if (typeof visit.status !== "number" || visit.status >= 400) {
    return false;
  }
  // T1 is Cloudflare's country code for the Tor network. It closes the exit
  // nodes whose AS organisation does not confess, such as "KeFF Customers".
  if (visit.country === "T1") {
    return false;
  }
  if (visit.asOrg && ALERT_ORG_DENY.test(visit.asOrg)) {
    return false;
  }
  if (refererKind(visit.referer) === "spam") {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------
//
// Runs only for visits that clear isGenuineVisit, which is a handful a month.
// It is strictly additive: every call site is wrapped, every provider is
// optional, and a total enrichment failure still writes the visit row, still
// writes an enrichment row and still sends the alert. It never touches the
// served response, which has already left the Worker by the time this runs.
//
// The IP address is an input here, never a column. It reaches the PTR query
// and the IPLocate query and is otherwise only ever hashed.

// 2000ms was too tight for a cold DoH lookup out of a Worker: the abort
// fired before cloudflare-dns.com answered and the name went missing.
const PTR_TIMEOUT_MS = 3000;
const IPLOCATE_TIMEOUT_MS = 3000;
// Two TTLs, not one. A name that resolved is stable for a week. A miss is
// not: IPv6 is now the common case, consumer IPv6 lines publish no PTR at all
// (verified on the BT line whose IPv4 does have one), and the address itself
// rotates daily. A week-long negative entry is therefore both the usual answer
// and the one most likely to be stale, and re-asking costs one DoH request at
// this traffic volume.
const PTR_CACHE_HIT_TTL = 7 * 24 * 60 * 60; // 7 days
const PTR_CACHE_MISS_TTL = 6 * 60 * 60; // 6 hours
const COMPANY_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days

// A fixed salt on the PTR cache key. The month salt used for visitor_hash is
// deliberately not reused: this key has to survive a month boundary, and a
// bare SHA-256 of an IPv4 address is enumerable in seconds.
const PTR_CACHE_SALT = "ryanhennebry.xyz/ptr/v1";

// Version tag mixed into every visitor_hash.
//
// IMPORTANT: hashes written before this constant existed (v1: the full IP
// concatenated with the user agent and the month, no version, no scope) are
// NOT comparable with hashes written after it. The same person hashes
// differently either side of the change, so a v1 hash and a v2 hash can never
// be joined, counted together, or read as the same visitor. Pre-change rows
// are identifiable in the table as the ones with hash_scope NULL. Bump this
// again for any future change to the hash input, so the two generations
// separate cleanly instead of silently colliding.
const VISITOR_HASH_VERSION = "v2";

function errText(err) {
  return err && err.message ? String(err.message) : String(err);
}

// --- Reverse DNS names ------------------------------------------------------

// Returns the four octets, or null. Leading zeros are rejected: "01.2.3.4" is
// not a form Cloudflare emits, and Number() would read it as decimal while a
// resolver might not.
function ipv4Bytes(text) {
  const parts = String(text).split(".");
  if (parts.length !== 4) {
    return null;
  }
  const bytes = [];
  for (const part of parts) {
    if (!/^(?:0|[1-9][0-9]{0,2})$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (n > 255) {
      return null;
    }
    bytes.push(n);
  }
  return bytes;
}

function ipv6Groups(chunk) {
  if (chunk === "") {
    return [];
  }
  const out = [];
  for (const group of chunk.split(":")) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
      return null;
    }
    const n = parseInt(group, 16);
    out.push((n >> 8) & 0xff, n & 0xff);
  }
  return out;
}

// Returns 16 bytes, or null. Handles "::" compression and the embedded
// dotted-quad form ("::ffff:203.0.113.9") by rewriting the tail to hex first.
function ipv6Bytes(input) {
  let text = String(input);
  if (text.indexOf("%") !== -1) {
    return null; // zone index; never arrives over the wire
  }
  if (text.indexOf(".") !== -1) {
    const cut = text.lastIndexOf(":");
    if (cut === -1) {
      return null;
    }
    const quad = ipv4Bytes(text.slice(cut + 1));
    if (!quad) {
      return null;
    }
    text =
      text.slice(0, cut + 1) +
      (((quad[0] << 8) | quad[1]).toString(16)) +
      ":" +
      (((quad[2] << 8) | quad[3]).toString(16));
  }
  const halves = text.split("::");
  if (halves.length > 2) {
    return null;
  }
  if (halves.length === 2) {
    const head = ipv6Groups(halves[0]);
    const tail = ipv6Groups(halves[1]);
    if (head === null || tail === null) {
      return null;
    }
    const fill = 16 - head.length - tail.length;
    if (fill < 2) {
      return null; // "::" must stand for at least one whole group
    }
    return head.concat(new Array(fill).fill(0), tail);
  }
  const all = ipv6Groups(text);
  return all !== null && all.length === 16 ? all : null;
}

// "8.8.4.4" -> "4.4.8.8.in-addr.arpa"
// "::1"     -> "1.0.0. ... .0.ip6.arpa" (32 reversed nibbles)
function reverseDnsName(ip) {
  if (typeof ip !== "string" || ip === "") {
    return null;
  }
  if (ip.indexOf(":") !== -1) {
    const bytes = ipv6Bytes(ip);
    if (!bytes) {
      return null;
    }
    const nibbles = [];
    for (const b of bytes) {
      nibbles.push(((b >> 4) & 0xf).toString(16), (b & 0xf).toString(16));
    }
    return nibbles.reverse().join(".") + ".ip6.arpa";
  }
  const bytes = ipv4Bytes(ip);
  if (!bytes) {
    return null;
  }
  return bytes.slice().reverse().join(".") + ".in-addr.arpa";
}

// --- Address normalisation --------------------------------------------------

// The part of an address that does not rotate, for use as a hash input.
//
// Most real traffic here arrives over IPv6, and RFC 4941 privacy extensions
// rotate the interface identifier - the low 64 bits - roughly daily on macOS,
// iOS and Android. Hashing the full address turned one returning person into a
// brand new visitor every day: "Repeat: Nth visit" undercounted and
// COUNT(DISTINCT visitor_hash) was inflated. The /64 prefix is the subnet the
// ISP delegates to the router; only the identifier below it moves.
//
// This also stores less than before, not more. The hash now covers a coarser
// identifier than the address that produced it.
//
// Returns { value, scope } and never throws:
//   ipv4      the dotted quad, unchanged
//   ipv6-64   the first four hextets, lowercase, zero padded, "::" expanded
//             and then written in prefix notation, so that
//             "2a00:23c7:1ff8:2001:e5eb:34c0:3e45:97c",
//             "2a00:23c7:1ff8:2001::1" and "2A00:23C7:1FF8:2001:0:0:0:99" all
//             give "2a00:23c7:1ff8:2001::/64"
//   raw       anything that does not parse, returned untouched. An
//             unparseable value is still a stable identifier, and dropping
//             the visitor rather than hashing it would be worse.
//
// The v4 and v6 forms cannot collide: one contains dots and no colons, the
// other colons and no dots, and the scope is mixed into the hash beside the
// value in any case.
function normaliseIpForHash(ip) {
  if (typeof ip !== "string" || ip === "") {
    return { value: ip, scope: "raw" };
  }
  if (ip.indexOf(":") === -1) {
    return ipv4Bytes(ip)
      ? { value: ip, scope: "ipv4" }
      : { value: ip, scope: "raw" };
  }
  const bytes = ipv6Bytes(ip);
  if (!bytes) {
    return { value: ip, scope: "raw" };
  }
  const hextets = [];
  for (let i = 0; i < 8; i += 2) {
    hextets.push(
      (((bytes[i] << 8) | bytes[i + 1]) >>> 0).toString(16).padStart(4, "0")
    );
  }
  return { value: hextets.join(":") + "::/64", scope: "ipv6-64" };
}

// --- User agent parsing -----------------------------------------------------

// Order is the whole design. Every Chromium fork ships "Chrome/" in its user
// agent, so Edge, Opera, Vivaldi, Brave and Samsung Internet have to be tested
// before it, and Safari last because Chrome and Edge on macOS both end in
// "Safari/". Only the major version is kept; the trailing ".0.0.0" that
// Chromium now emits carries no information.
const UA_BROWSER_RULES = [
  ["Edge", /\b(?:Edg|EdgA|EdgiOS)\/([0-9]+)/],
  ["Opera", /\b(?:OPR|OPiOS)\/([0-9]+)/],
  ["Samsung Internet", /\bSamsungBrowser\/([0-9]+)/],
  ["Vivaldi", /\bVivaldi\/([0-9]+)/],
  ["Brave", /\bBrave\/([0-9]+)/],
  ["Firefox", /\b(?:Firefox|FxiOS)\/([0-9]+)/],
  ["Chrome", /\b(?:Chrome|CriOS)\/([0-9]+)/],
  ["Safari", /\bVersion\/([0-9]+)(?:\.[0-9]+)*\s+(?:Mobile\/\S+\s+)?Safari\//],
];

// Windows NT 10.0 is sent by both Windows 10 and Windows 11. The user agent
// cannot tell them apart, so the version is dropped rather than guessed; only
// the releases that are actually distinguishable get a number.
const WINDOWS_NT = {
  "5.1": "Windows XP",
  "6.0": "Windows Vista",
  "6.1": "Windows 7",
  "6.2": "Windows 8",
  "6.3": "Windows 8.1",
};

function parseBrowser(ua) {
  for (const rule of UA_BROWSER_RULES) {
    const m = rule[1].exec(ua);
    if (m) {
      return m[1] ? rule[0] + " " + m[1] : rule[0];
    }
  }
  return null;
}

function parseOs(ua) {
  let m = /\bWindows NT ([0-9]+\.[0-9]+)/.exec(ua);
  if (m) {
    return WINDOWS_NT[m[1]] || "Windows";
  }
  if (/\bAndroid\b/.test(ua)) {
    m = /\bAndroid[ /]([0-9]+(?:\.[0-9]+)?)/.exec(ua);
    return m ? "Android " + m[1] : "Android";
  }
  if (/\biPhone\b|\biPad\b|\biPod\b/.test(ua)) {
    m = /\b(?:iPhone OS|CPU OS) ([0-9]+(?:_[0-9]+)?)/.exec(ua);
    return m ? "iOS " + m[1].replace(/_/g, ".") : "iOS";
  }
  if (/\bCrOS\b/.test(ua)) {
    return "Chrome OS";
  }
  if (/\bMac OS X\b|\bMacintosh\b/.test(ua)) {
    // Frozen at 10_15_7 by every current browser, so this is the true ceiling
    // of what the string can say, not a parsing shortfall.
    m = /\bMac OS X ([0-9]+)[._]([0-9]+)/.exec(ua);
    return m ? "macOS " + m[1] + "." + m[2] : "macOS";
  }
  if (/\bX11\b|\bLinux\b/.test(ua)) {
    return "Linux";
  }
  return null;
}

// iPadOS 13 and later send the desktop Macintosh string by default. That is
// genuinely indistinguishable from a Mac, so it reads as "desktop" rather than
// being guessed at.
function parseDevice(ua) {
  if (/\biPad\b/.test(ua)) {
    return "tablet";
  }
  if (/\bAndroid\b/.test(ua)) {
    return /\bMobile\b/.test(ua) ? "mobile" : "tablet";
  }
  if (/\biPhone\b|\biPod\b/.test(ua)) {
    return "mobile";
  }
  if (/\bMobile\b|\bMobi\b/.test(ua)) {
    return "mobile";
  }
  if (/\bMacintosh\b|\bWindows NT\b|\bCrOS\b|\bX11\b/.test(ua)) {
    return "desktop";
  }
  return null;
}

// Hand-rolled, no library, and null wherever the string does not actually say.
// A wrong browser name in an alert is worse than a blank one: it would be
// believed.
function parseUserAgent(ua) {
  if (typeof ua !== "string" || ua === "") {
    return { browser: null, os: null, device: null };
  }
  return { browser: parseBrowser(ua), os: parseOs(ua), device: parseDevice(ua) };
}

// --- Cache ------------------------------------------------------------------

// The KV binding is optional in exactly the same way the providers are. A
// missing namespace costs one extra upstream call and nothing else.
async function cacheGet(env, key) {
  if (!env.VISIT_ENRICH) {
    return null;
  }
  try {
    return await env.VISIT_ENRICH.get(key);
  } catch (err) {
    console.error("enrich cache read failed", errText(err));
    return null;
  }
}

async function cachePut(env, key, value, ttl) {
  if (!env.VISIT_ENRICH) {
    return;
  }
  try {
    await env.VISIT_ENRICH.put(key, value, { expirationTtl: ttl });
  } catch (err) {
    console.error("enrich cache write failed", errText(err));
  }
}

// --- Providers --------------------------------------------------------------

// Cloudflare DNS-over-HTTPS. No key, no account, and the PTR record often
// names the corporate or ISP tenant that the AS organisation string does not.
// Cached under a hash of the IP, never the IP: a KV key is stored data.
// "-" is a cached miss, so a nameless address is asked about once a week.
//
// Never throws, and never returns a bare null: every path that yields no name
// pushes its reason onto notes. The silent null was the defect. Visit 7121
// stored source='ua-only' with nothing in error to say why the name was
// missing, for an address whose PTR record demonstrably resolves.
async function lookupPtr(env, ip, notes) {
  function note(text) {
    if (Array.isArray(notes)) {
      notes.push("ptr: " + text);
    }
  }

  const name = reverseDnsName(ip);
  if (!name) {
    note("no reverse name for address");
    return null;
  }
  // Keyed on the normalised address, never on the raw one. A rotating IPv6
  // identifier would otherwise write a fresh entry every day and read none of
  // them back. The DNS query below still goes out against the full address:
  // PTR is a per-address record and a /64 prefix has no PTR to look up. The
  // cost of the coarser key is that every host behind one /64 shares one
  // cached answer, which for a home line is one household.
  const key =
    "ptr:" +
    (await sha256Hex(PTR_CACHE_SALT + normaliseIpForHash(ip).value)).slice(0, 32);
  const cached = await cacheGet(env, key);
  if (typeof cached === "string") {
    if (cached === "-") {
      note("cached miss");
      return null;
    }
    return cached;
  }

  let res = null;
  try {
    res = await fetch(
      "https://cloudflare-dns.com/dns-query?name=" +
        encodeURIComponent(name) +
        "&type=PTR",
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(PTR_TIMEOUT_MS),
      }
    );
  } catch (err) {
    // Bare errText, no prefix: the note is already namespaced "ptr: ", and the
    // stored error text for this case is a contract alerting.test.mjs locks.
    note(errText(err));
    return null;
  }
  if (!res || !res.ok) {
    note("dns-query HTTP " + (res ? res.status : "?"));
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    note("dns-query body unreadable: " + errText(err));
    return null;
  }
  if (!data || typeof data !== "object") {
    note("dns-query body not an object");
    return null;
  }

  // Status is the DNS RCODE. 0 is NOERROR and 3 is NXDOMAIN, and those are the
  // only two that are answers about this name; anything else (2 SERVFAIL, 5
  // REFUSED) is the resolver failing and must not be cached as a miss. An
  // absent Status is read as NOERROR rather than rejected: Cloudflare always
  // sends the field, and discarding a well-formed Answer over a missing one
  // would reintroduce the null this change exists to remove.
  const status = typeof data.Status === "number" ? data.Status : 0;
  if (status !== 0 && status !== 3) {
    note("dns status " + status);
    return null;
  }
  if (data.Answer !== undefined && !Array.isArray(data.Answer)) {
    note("dns-query answer malformed");
    return null;
  }

  let ptr = null;
  const answers = Array.isArray(data.Answer) ? data.Answer : [];
  for (const answer of answers) {
    if (answer && answer.type === 12 && typeof answer.data === "string" && answer.data) {
      ptr = answer.data.replace(/\.$/, "");
      break;
    }
  }
  if (ptr === null) {
    note(status === 3 ? "NXDOMAIN" : "no PTR record in answer");
  }
  await cachePut(
    env,
    key,
    ptr === null ? "-" : ptr,
    ptr === null ? PTR_CACHE_MISS_TTL : PTR_CACHE_HIT_TTL
  );
  return ptr;
}

function flag01(value) {
  return value === true ? 1 : value === false ? 0 : null;
}

function textOrNull(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

// IPLocate, gated on an optional secret. The caller has already checked that
// the secret exists.
//
// Endpoint and field names are taken from the vendor documentation, not from
// the provider this replaced: https://www.iplocate.io/docs/getting-started/authentication
// and https://www.iplocate.io/docs/ip-intelligence-api/data-types. The key
// travels in the X-API-Key header rather than the documented apikey query
// parameter, so it never reaches a URL, a redirect or an error string. The
// company object is company.{name,domain,type}; the per-address verdicts are
// privacy.{is_vpn,is_proxy,is_tor,is_abuser,is_hosting}. Both top-level objects
// are absent, not null, when IPLocate has nothing for the address, which is why
// each is defaulted to {} before it is read.
//
// Only the company fields are cached, and they are cached by ASN because that
// is the level the attribution is actually derived at. The security flags are
// per-address and are deliberately NOT cached and NOT served from cache: a
// cache hit returns them as null, meaning "not asked this time", which the
// suppression guard treats as no signal rather than as a clean bill of health.
async function lookupCompany(env, ip, asn) {
  const key = typeof asn === "number" ? "company:as" + asn : null;
  if (key) {
    const cached = await cacheGet(env, key);
    if (typeof cached === "string") {
      let parsed = null;
      try {
        parsed = JSON.parse(cached);
      } catch (err) {
        parsed = null;
      }
      if (parsed) {
        return {
          companyName: textOrNull(parsed.name),
          companyDomain: textOrNull(parsed.domain),
          companyType: textOrNull(parsed.type),
          isVpn: null,
          isProxy: null,
          isTor: null,
          isAbuser: null,
          isHosting: null,
        };
      }
    }
  }

  const res = await fetch(
    "https://iplocate.io/api/lookup/" + encodeURIComponent(ip),
    {
      headers: {
        "X-API-Key": env.IPLOCATE_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(IPLOCATE_TIMEOUT_MS),
    }
  );
  if (!res || !res.ok) {
    // The status on its own is not a diagnosis. IPLocate answers 401 for both
    // "Missing API key" and "Invalid API key" and 429 for a spent quota, and
    // only the body's error property says which. ascii() strips the newlines
    // and caps the length, so an error body can never widen a stored row or an
    // alert line.
    let detail = "";
    if (res) {
      try {
        detail = ascii(await res.text(), 200);
      } catch (err) {
        detail = "body unreadable: " + errText(err);
      }
    }
    throw new Error(
      "iplocate HTTP " + (res ? res.status : "?") + (detail ? " " + detail : "")
    );
  }
  const data = await res.json();
  const company = data && data.company ? data.company : {};
  const privacy = data && data.privacy ? data.privacy : {};

  const out = {
    companyName: textOrNull(company.name),
    companyDomain: textOrNull(company.domain),
    companyType: textOrNull(company.type),
    isVpn: flag01(privacy.is_vpn),
    isProxy: flag01(privacy.is_proxy),
    isTor: flag01(privacy.is_tor),
    isAbuser: flag01(privacy.is_abuser),
    isHosting: flag01(privacy.is_hosting),
  };

  if (key) {
    await cachePut(
      env,
      key,
      JSON.stringify({
        name: out.companyName,
        domain: out.companyDomain,
        type: out.companyType,
      }),
      COMPANY_CACHE_TTL
    );
  }
  return out;
}

// --- Orchestration ----------------------------------------------------------

// Never throws. source names the providers that actually answered; error
// carries why the others did not, including the ordinary case of the
// IPLocate secret simply not being set.
async function enrichVisit(env, visit) {
  const parsed = parseUserAgent(visit.ua);
  const out = {
    ptr: null,
    companyName: null,
    companyDomain: null,
    companyType: null,
    isVpn: null,
    isProxy: null,
    isTor: null,
    isAbuser: null,
    isHosting: null,
    browser: parsed.browser,
    os: parsed.os,
    device: parsed.device,
    source: "ua-only",
    error: null,
  };

  const answered = [];
  const notes = [];

  if (visit.ip) {
    try {
      const ptr = await lookupPtr(env, visit.ip, notes);
      if (ptr) {
        out.ptr = ptr;
        answered.push("ptr");
      }
    } catch (err) {
      notes.push("ptr: " + errText(err));
    }

    if (!env.IPLOCATE_KEY) {
      notes.push("iplocate: IPLOCATE_KEY secret absent");
    } else {
      try {
        const company = await lookupCompany(env, visit.ip, visit.asn);
        if (company) {
          out.companyName = company.companyName;
          out.companyDomain = company.companyDomain;
          out.companyType = company.companyType;
          out.isVpn = company.isVpn;
          out.isProxy = company.isProxy;
          out.isTor = company.isTor;
          out.isAbuser = company.isAbuser;
          out.isHosting = company.isHosting;
          answered.push("iplocate");
        }
      } catch (err) {
        notes.push("iplocate: " + errText(err));
      }
    }
  } else {
    notes.push("no address available");
  }

  out.source = answered.length ? answered.join("+") : "ua-only";
  // 600, not 300: a captured IPLocate error body is up to 200 characters
  // on its own, and truncating it back off would undo the diagnostic.
  out.error = notes.length ? notes.join("; ").slice(0, 600) : null;
  return out;
}

// INSERT OR REPLACE, not INSERT: the primary key is visits.id, so a retry of
// the same visit rewrites its row instead of failing on the key.
async function storeEnrichment(env, visitId, enrichment) {
  if (!env.DB || typeof visitId !== "number" || !enrichment) {
    return;
  }
  try {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO enrichment (visit_id, ts, ptr, company_name, company_domain, company_type, is_vpn, is_proxy, is_tor, is_hosting, browser, os, device, source, error) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"
    )
      .bind(
        visitId,
        new Date().toISOString(),
        enrichment.ptr,
        enrichment.companyName,
        enrichment.companyDomain,
        enrichment.companyType,
        enrichment.isVpn,
        enrichment.isProxy,
        enrichment.isTor,
        enrichment.isHosting,
        enrichment.browser,
        enrichment.os,
        enrichment.device,
        enrichment.source,
        enrichment.error
      )
      .run();
  } catch (err) {
    console.error("enrichment write failed", errText(err));
  }
}

// The late signal. isGenuineVisit runs on what Cloudflare hands the Worker;
// this runs on what the providers came back with, which is data the first pass
// did not have. A true flag or a hosting company type means the visit is a
// machine wearing a browser user agent, so the row is kept and the email is
// not sent. null means the question was not asked and is not evidence either
// way.
//
// IPLocate's company.type vocabulary is business, hosting, government,
// education, isp and unknown, so "hosting" is the one value here that is a
// verdict rather than a description.
function enrichmentSuppresses(enrichment) {
  if (!enrichment) {
    return null;
  }
  if (enrichment.isVpn === 1) {
    return "is_vpn";
  }
  if (enrichment.isProxy === 1) {
    return "is_proxy";
  }
  if (enrichment.isTor === 1) {
    return "is_tor";
  }
  if (enrichment.isAbuser === 1) {
    return "is_abuser";
  }
  // Per-address, and therefore stronger evidence than company.type: IPLocate
  // sets this for an address it has seen hosting services, even inside a
  // network whose company.type is 'business' or 'isp'. It is read on its own
  // and never through privacy.is_anonymous, which ORs in is_icloud_relay - a
  // Private Relay exit is a person and must still alert.
  if (enrichment.isHosting === 1) {
    return "is_hosting";
  }
  if (
    typeof enrichment.companyType === "string" &&
    enrichment.companyType.toLowerCase() === "hosting"
  ) {
    return "company_type=hosting";
  }
  return null;
}

// Everything that reaches the message is forced to printable ASCII. City
// names in the log include "Skelleftea", "Bogota" and "Montreal" with
// accents, and a header must never carry CR or LF: that is header injection.
function ascii(value, max) {
  const text = value === null || value === undefined ? "" : String(value);
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0);
    out += code >= 32 && code <= 126 ? ch : "?";
  }
  return typeof max === "number" ? out.slice(0, max) : out;
}

const RFC2822_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RFC2822_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function rfc2822Date(date) {
  return (
    RFC2822_DAYS[date.getUTCDay()] +
    ", " +
    pad2(date.getUTCDate()) +
    " " +
    RFC2822_MONTHS[date.getUTCMonth()] +
    " " +
    date.getUTCFullYear() +
    " " +
    pad2(date.getUTCHours()) +
    ":" +
    pad2(date.getUTCMinutes()) +
    ":" +
    pad2(date.getUTCSeconds()) +
    " +0000"
  );
}

function ordinal(n) {
  const value = typeof n === "number" && n > 0 ? n : 1;
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) {
    return value + "th";
  }
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th";
  return value + suffix;
}

function messageId(date) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "<" + date.getTime() + "." + rand + "@" + ALERT_DOMAIN + ">";
}

// "Chrome 141 on macOS 10.15, desktop", from whichever of the three parts the
// user agent actually said. Returns null when it said none of them, so the
// caller omits the line rather than printing a row of nulls.
function deviceLine(enrichment) {
  if (!enrichment) {
    return null;
  }
  const browser = ascii(enrichment.browser, 40);
  const os = ascii(enrichment.os, 40);
  const device = ascii(enrichment.device, 12);
  let head = browser && os ? browser + " on " + os : browser || os;
  if (head && device) {
    return head + ", " + device;
  }
  return head || device || null;
}

function companyLine(enrichment) {
  if (!enrichment) {
    return null;
  }
  const name = ascii(enrichment.companyName, 80);
  if (!name) {
    return null;
  }
  const extra = [ascii(enrichment.companyDomain, 80), ascii(enrichment.companyType, 24)]
    .filter(Boolean)
    .join(", ");
  return extra ? name + " (" + extra + ")" : name;
}

// Hand-rolled RFC 5322. No dependency: this repo has no build step, no
// package.json and no node_modules, and it stays that way. CRLF everywhere,
// one blank line between headers and body.
//
// Every enrichment value goes through ascii() for the same reason the city
// name always did, only more so: a PTR record is a string an outsider chooses,
// so rDNS is the one field in this message an attacker can write directly. CR
// and LF are below code 32 and become "?", which is what closes header
// injection.
function buildAlertEmail(visit, repeatCount, now, enrichment) {
  const date = now instanceof Date ? now : new Date();
  const org = ascii(visit.asOrg, 80) || "(unknown org)";
  const country = ascii(visit.country, 8) || "??";
  const city = ascii(visit.city, 60) || "(unknown)";
  const asn = typeof visit.asn === "number" ? "AS" + visit.asn : "AS?";
  const kind = refererKind(visit.referer);
  const referer =
    kind === "none" || kind === "self" ? "(direct)" : ascii(visit.referer, 120);

  const company = companyLine(enrichment);
  const ptr = enrichment ? ascii(enrichment.ptr, 120) : "";
  const device = deviceLine(enrichment);
  const subjectWho = (enrichment && ascii(enrichment.companyName, 80)) || org;

  const headers = [
    "From: Visit alerts <" + ALERT_FROM + ">",
    "To: <" + ALERT_TO + ">",
    "Subject: " + ascii("Visit - " + subjectWho + " (" + country + ")", 160),
    "Date: " + rfc2822Date(date),
    "Message-ID: " + messageId(date),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
  ];

  const body = [
    pad2(date.getUTCHours()) +
      ":" +
      pad2(date.getUTCMinutes()) +
      " UTC  " +
      ascii(visit.path, 120),
    "Org:      " + org + " (" + asn + ")",
  ];
  if (company) {
    body.push("Company:  " + company);
  }
  if (ptr) {
    body.push("rDNS:     " + ptr);
  }
  body.push("Country:  " + country);
  body.push("City:     " + city);
  if (device) {
    body.push("Device:   " + device);
  } else {
    // Nothing was parsed with confidence, so the raw string goes in instead.
    // Losing the user agent entirely would make an unparsed visit the one
    // visit there is nothing to look at.
    body.push("UA:       " + ascii(visit.ua, 60));
  }
  body.push("Referrer: " + referer);
  body.push("Repeat:   " + ordinal(repeatCount) + " visit this month");
  body.push("");

  return headers.join("\r\n") + "\r\n\r\n" + body.join("\r\n");
}

async function recordAlertAttempt(env, visitorHash, outcome, detail) {
  try {
    await env.DB.prepare(
      "INSERT INTO alert_log (ts, visitor_hash, outcome, detail) VALUES (?1, ?2, ?3, ?4)"
    )
      .bind(
        new Date().toISOString(),
        visitorHash || null,
        outcome,
        detail === null || detail === undefined ? null : String(detail).slice(0, 300)
      )
      .run();
  } catch (err) {
    console.error("alert_log write failed", err && err.message ? err.message : err);
  }
}

// Runs after the visit row is written, so the repeat count includes this hit.
async function maybeAlert(env, visit) {
  try {
    if (!env.DB || !env.ALERT_EMAIL || !visit.visitorHash) {
      return;
    }
    if (!isGenuineVisit(visit)) {
      return;
    }

    // One alert per visitor per UTC day. The primary key is the lock: the
    // insert either claims the day or it does not, so two concurrent
    // requests cannot both decide they are the first.
    const day = visit.ts.slice(0, 10);
    const claim = await env.DB.prepare(
      "INSERT OR IGNORE INTO alerts_sent (visitor_hash, day, ts) VALUES (?1, ?2, ?3)"
    )
      .bind(visit.visitorHash, day, visit.ts)
      .run();

    if (!claim || !claim.meta || claim.meta.changes !== 1) {
      await recordAlertAttempt(env, visit.visitorHash, "suppressed_debounce", null);
      return;
    }

    let repeatCount = 1;
    try {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM visits WHERE visitor_hash = ?1 AND ts >= ?2"
      )
        .bind(visit.visitorHash, visit.ts.slice(0, 7) + "-01T00:00:00.000Z")
        .first();
      if (row && typeof row.n === "number" && row.n > 0) {
        repeatCount = row.n;
      }
    } catch (err) {
      console.error("repeat count failed", err && err.message ? err.message : err);
    }

    // Enrichment runs after the debounce claim, not before it: the claim is
    // the concurrency lock and has to stay the first side effect, and there is
    // no point paying for a lookup that feeds an email nobody will send. It
    // runs before the send so the message carries what it found.
    let enrichment = null;
    try {
      enrichment = await enrichVisit(env, visit);
      await storeEnrichment(env, visit.id, enrichment);
    } catch (err) {
      console.error("enrichment failed", err && err.message ? err.message : err);
    }

    // The second-chance filter. The row is already stored; only the email is
    // withheld, and alert_log says why.
    const suppressedBy = enrichmentSuppresses(enrichment);
    if (suppressedBy) {
      await recordAlertAttempt(env, visit.visitorHash, "suppressed_enrichment", suppressedBy);
      return;
    }

    const raw = buildAlertEmail(visit, repeatCount, new Date(), enrichment);

    try {
      await env.ALERT_EMAIL.send(new EmailMessage(ALERT_FROM, ALERT_TO, raw));
      await recordAlertAttempt(env, visit.visitorHash, "sent", null);
    } catch (err) {
      await recordAlertAttempt(
        env,
        visit.visitorHash,
        "failed",
        err && err.message ? err.message : String(err)
      );
    }
  } catch (err) {
    // An alert failure never touches the response or the visit log.
    console.error("alert failed", err && err.message ? err.message : err);
  }
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function logVisit(request, response, env) {
  try {
    if (!env.DB) {
      return;
    }

    const url = new URL(request.url);
    const headers = request.headers;
    const cf = request.cf || {};

    const ts = new Date().toISOString();
    const month = ts.slice(0, 7); // YYYY-MM, the rotating hash salt.

    const ua = headers.get("user-agent");
    const ip = headers.get("cf-connecting-ip");
    const referer = headers.get("referer");

    const asn = typeof cf.asn === "number" ? cf.asn : null;
    const asOrg = cf.asOrganization || null;
    const status = response ? response.status : null;
    const classification = classify(url.pathname, ua, asn, asOrg);

    // The IP exists only inside these two expressions. It is never stored,
    // and what is hashed is the /64 for an IPv6 client, not the address.
    //
    // The version tag and the scope are part of the input, so a v1 hash can
    // never equal a v2 hash by accident. hash_scope is written on every new
    // row, including the no-IP case, which is what makes NULL in that column
    // mean exactly one thing: this row predates the change and its hash is
    // not comparable with anything written since.
    const address = normaliseIpForHash(ip || "");
    const visitorHash =
      ip || ua
        ? await sha256Hex(
            VISITOR_HASH_VERSION +
              "|" +
              address.scope +
              "|" +
              address.value +
              "|" +
              (ua || "") +
              "|" +
              month
          )
        : null;
    const hashScope = visitorHash === null ? null : address.scope;

    const insert = await env.DB.prepare(
      "INSERT INTO visits (ts, path, status, asn, as_org, country, city, region, timezone, colo, referer, ua, accept_language, http_protocol, tls_version, client_tcp_rtt, classification, visitor_hash, hash_scope) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)"
    )
      .bind(
        ts,
        url.pathname,
        status,
        asn,
        asOrg,
        cf.country || null,
        cf.city || null,
        cf.region || null,
        cf.timezone || null,
        cf.colo || null,
        referer,
        ua,
        headers.get("accept-language"),
        cf.httpProtocol || null,
        cf.tlsVersion || null,
        typeof cf.clientTcpRtt === "number" ? cf.clientTcpRtt : null,
        classification,
        visitorHash,
        hashScope
      )
      .run();

    const visitId =
      insert && insert.meta && typeof insert.meta.last_row_id === "number"
        ? insert.meta.last_row_id
        : null;

    // The ip field is the one place the address travels past the hash, and it
    // travels in memory only: enrichment needs an address to ask about, and
    // nothing downstream of maybeAlert writes it. It is not a column in
    // visits, in enrichment or in alert_log.
    await maybeAlert(env, {
      id: visitId,
      ts,
      path: url.pathname,
      status,
      asn,
      asOrg,
      country: cf.country || null,
      city: cf.city || null,
      referer,
      ua,
      ip,
      classification,
      visitorHash,
    });
  } catch (err) {
    // A logging failure is never allowed to reach the visitor.
    console.error("visit log failed", err && err.message ? err.message : err);
  }
}

export default {
  async fetch(request, env, ctx) {
    const response = await env.ASSETS.fetch(request);

    try {
      ctx.waitUntil(logVisit(request, response, env));
    } catch (err) {
      console.error("visit log dispatch failed", err && err.message ? err.message : err);
    }

    return response;
  },
};
