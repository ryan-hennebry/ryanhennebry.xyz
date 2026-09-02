// Loads the shipped Worker source and hands back its internal functions.
//
// Nothing is re-implemented here and nothing is exported from src/index.js for
// the sake of the tests: the file that runs in production is the file under
// test. Two things have to be worked around. Node cannot resolve
// "cloudflare:email", so the import line is stripped and EmailMessage is
// injected as a Function parameter instead of being left as a silent
// undefined - a bare ReferenceError inside maybeAlert would be swallowed by
// its own try/catch and look exactly like a real defect. And the trailing
// "export default" block is cut so the remainder can be evaluated as a body.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
export const SRC = join(here, "..", "src", "index.js");
export const SCHEMA = join(here, "..", "schema.sql");

export class StubEmailMessage {
  constructor(from, to, raw) {
    this.from = from;
    this.to = to;
    this.raw = raw;
  }
}

const EXPORTED = [
  "classify",
  "normaliseIpForHash",
  "logVisit",
  "isGenuineVisit",
  "reverseDnsName",
  "parseUserAgent",
  "enrichVisit",
  "enrichmentSuppresses",
  "storeEnrichment",
  "buildAlertEmail",
  "maybeAlert",
  "lookupPtr",
  "lookupCompany",
];

export function loadWorker() {
  const src = readFileSync(SRC, "utf8");
  const cut = src.indexOf("export default");
  if (cut === -1) {
    throw new Error("export default not found in src/index.js");
  }
  const body = src
    .slice(0, cut)
    .replace(/^import\s.*$/m, "");
  const factory = new Function(
    "EmailMessage",
    body + "\nreturn { " + EXPORTED.join(", ") + " };"
  );
  return factory(StubEmailMessage);
}
