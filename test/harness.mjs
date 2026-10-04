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
//
// A name in EXPORTED that src/index.js does not define comes back undefined
// rather than throwing at load, so one missing function fails its own tests
// and the "harness" test in privacy.test.mjs, not every suite at once.

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

export const EXPORTED = [
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
  "purgeOldRows",
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
    body +
      "\nreturn { " +
      EXPORTED.map((name) => name + ": typeof " + name + " === 'undefined' ? undefined : " + name).join(", ") +
      " };"
  );
  return factory(StubEmailMessage);
}

// The whole Worker module, export default included, evaluated as a body that
// returns its default export. This is how the scheduled handler is reached.
export function loadEntrypoint() {
  const src = readFileSync(SRC, "utf8");
  if (src.indexOf("export default") === -1) {
    throw new Error("export default not found in src/index.js");
  }
  const body = src
    .replace(/^import\s.*$/m, "")
    .replace("export default", "return");
  return new Function("EmailMessage", body)(StubEmailMessage);
}
