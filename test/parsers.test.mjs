// Unit tests for the two pure parsers, run against the shipped source.
//
// The ip6.arpa expectations were generated with Python's ipaddress module
// (ipaddress.ip_address(x).reverse_pointer), not by reading the JS back to
// itself, so they are an independent check rather than a snapshot.

import test from "node:test";
import assert from "node:assert/strict";
import { loadWorker } from "./harness.mjs";

const { reverseDnsName, parseUserAgent } = loadWorker();

const PTR_CASES = [
  ["IPv4", "8.8.4.4", "4.4.8.8.in-addr.arpa"],
  ["IPv4 documentation range", "203.0.113.9", "9.113.0.203.in-addr.arpa"],
  ["IPv4 low octets", "1.2.3.4", "4.3.2.1.in-addr.arpa"],
  ["IPv4 zero octet", "10.0.0.1", "1.0.0.10.in-addr.arpa"],
  [
    "IPv6 with :: in the middle",
    "2001:4860:4860::8888",
    "8.8.8.8.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.6.8.4.0.6.8.4.1.0.0.2.ip6.arpa",
  ],
  [
    "IPv6 loopback",
    "::1",
    "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa",
  ],
  [
    "IPv6 all zeroes",
    "::",
    "0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa",
  ],
  [
    "IPv6 resolver address",
    "2606:4700:4700::1111",
    "1.1.1.1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.7.4.0.0.7.4.6.0.6.2.ip6.arpa",
  ],
  [
    "IPv6 fully written out",
    "2a00:1450:4009:081f:0000:0000:0000:200e",
    "e.0.0.2.0.0.0.0.0.0.0.0.0.0.0.0.f.1.8.0.9.0.0.4.0.5.4.1.0.0.a.2.ip6.arpa",
  ],
  [
    "IPv6 with an embedded dotted quad",
    "::ffff:203.0.113.9",
    "9.0.1.7.0.0.b.c.f.f.f.f.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.ip6.arpa",
  ],
  ["IPv4 octet out of range", "256.1.1.1", null],
  ["IPv4 with three octets", "1.2.3", null],
  ["IPv4 with a leading zero octet", "01.2.3.4", null],
  ["IPv6 with two :: runs", "2001::db8::1", null],
  ["IPv6 with a non-hex group", "gggg::1", null],
  ["IPv6 with a zone index", "fe80::1%eth0", null],
  ["IPv6 one group too long", "1:2:3:4:5:6:7", null],
  ["empty string", "", null],
  ["not a string", null, null],
];

test("reverse DNS name builder", () => {
  for (const [label, input, expected] of PTR_CASES) {
    assert.equal(reverseDnsName(input), expected, label + " (" + String(input) + ")");
  }
});

const UA_CASES = [
  [
    "Chrome on macOS",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    { browser: "Chrome 141", os: "macOS 10.15", device: "desktop" },
  ],
  [
    "Safari on macOS",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
    { browser: "Safari 18", os: "macOS 10.15", device: "desktop" },
  ],
  [
    "Safari on iPhone",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    { browser: "Safari 17", os: "iOS 17.5", device: "mobile" },
  ],
  [
    "Chrome on iPhone announces CriOS, not Chrome",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
    { browser: "Chrome 130", os: "iOS 18.0", device: "mobile" },
  ],
  [
    "Firefox on Windows 10 or 11, which the string cannot tell apart",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
    { browser: "Firefox 143", os: "Windows", device: "desktop" },
  ],
  [
    "Firefox on Windows 7, which it can",
    "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:52.0) Gecko/20100101 Firefox/52.0",
    { browser: "Firefox 52", os: "Windows 7", device: "desktop" },
  ],
  [
    "Edge is tested before Chrome",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.66",
    { browser: "Edge 140", os: "Windows", device: "desktop" },
  ],
  [
    "Opera is tested before Chrome",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0",
    { browser: "Opera 111", os: "Windows", device: "desktop" },
  ],
  [
    "Samsung Internet is tested before Chrome",
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
    { browser: "Samsung Internet 23", os: "Android 13", device: "mobile" },
  ],
  [
    "Chrome on Android phone",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
    { browser: "Chrome 141", os: "Android 14", device: "mobile" },
  ],
  [
    "Android without Mobile is a tablet",
    "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    { browser: "Chrome 120", os: "Android 13", device: "tablet" },
  ],
  [
    "iPad in its own mode",
    "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    { browser: "Safari 17", os: "iOS 17.5", device: "tablet" },
  ],
  [
    "Chrome on Linux",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    { browser: "Chrome 139", os: "Linux", device: "desktop" },
  ],
  [
    "Chrome OS",
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    { browser: "Chrome 126", os: "Chrome OS", device: "desktop" },
  ],
  [
    "Firefox on iOS announces FxiOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15",
    { browser: "Firefox 126", os: "iOS 17.4", device: "mobile" },
  ],
  [
    "curl says nothing this parser will guess at",
    "curl/8.4.0",
    { browser: null, os: null, device: null },
  ],
  [
    "a bare WebKit string is not confidently any browser",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36",
    { browser: null, os: null, device: null },
  ],
  ["empty user agent", "", { browser: null, os: null, device: null }],
  ["missing user agent", null, { browser: null, os: null, device: null }],
];

test("user agent parser", () => {
  for (const [label, input, expected] of UA_CASES) {
    assert.deepEqual(parseUserAgent(input), expected, label);
  }
});
