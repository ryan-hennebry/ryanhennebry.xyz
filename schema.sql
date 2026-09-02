CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  path TEXT NOT NULL,
  status INTEGER,
  asn INTEGER,
  as_org TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  timezone TEXT,
  colo TEXT,
  referer TEXT,
  ua TEXT,
  accept_language TEXT,
  http_protocol TEXT,
  tls_version TEXT,
  client_tcp_rtt INTEGER,
  classification TEXT NOT NULL,
  visitor_hash TEXT
  -- hash_scope TEXT is not declared here. It is added by the migration at the
  -- foot of this file, which is the only definition of it, so that a fresh
  -- database and the live one take the same path and neither gets a duplicate
  -- column error on first application.
);
CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits(ts);
CREATE INDEX IF NOT EXISTS idx_visits_class ON visits(classification);
CREATE INDEX IF NOT EXISTS idx_visits_asn ON visits(asn);

-- One alert per visitor per UTC day. The primary key is the debounce lock:
-- INSERT OR IGNORE either claims the day (meta.changes === 1) or it does not,
-- so two concurrent requests cannot both decide they are the first.
CREATE TABLE IF NOT EXISTS alerts_sent (
  visitor_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  ts TEXT NOT NULL,
  PRIMARY KEY (visitor_hash, day)
);

-- Every alert attempt, including the suppressed ones. Sending depends on
-- dashboard state (Email Routing enabled on the zone, destination address
-- verified) that fails at runtime inside waitUntil. Without this table a
-- broken alert is silently invisible.
--   outcome  'sent' | 'failed' | 'suppressed_debounce' |
--            'suppressed_enrichment'
--   detail   the error message on failure, truncated to 300 characters
CREATE TABLE IF NOT EXISTS alert_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  visitor_hash TEXT,
  outcome TEXT,
  detail TEXT
);

-- Enrichment for the small number of visits that clear isGenuineVisit(). One
-- row per alert-worthy visit, keyed to visits.id, written whether or not any
-- provider answered. Still no raw IP: the address is an input to the PTR
-- lookup and to the cache key hash, and is never a column here.
--   ptr           reverse DNS name, from Cloudflare DNS-over-HTTPS
--   company_*     IPLocate, only when the IPLOCATE_KEY secret is present
--   is_vpn/proxy/tor  IPLocate privacy flags, 1/0/NULL (NULL = not asked)
--   is_hosting    IPLocate privacy.is_hosting, added by the migration at the
--                 foot of this file and not declared in the CREATE TABLE
--   browser/os/device hand-rolled user agent parse, NULL when not confident
--   source        which providers actually answered: 'ua-only', 'ptr',
--                 'ptr+iplocate', 'iplocate'
--   error         first failure message, truncated, for the silent cases
CREATE TABLE IF NOT EXISTS enrichment (
  visit_id INTEGER PRIMARY KEY,
  ts TEXT,
  ptr TEXT,
  company_name TEXT,
  company_domain TEXT,
  company_type TEXT,
  is_vpn INTEGER,
  is_proxy INTEGER,
  is_tor INTEGER,
  -- is_hosting INTEGER is not declared here, for the same reason hash_scope is
  -- not declared on visits: the migration at the foot of the file is its only
  -- definition, so a fresh database and the live one take the same path.
  browser TEXT,
  os TEXT,
  device TEXT,
  source TEXT,
  error TEXT
);

-- --- Migrations -------------------------------------------------------------
--
-- hash_scope records which normalisation produced visitor_hash:
--   'ipv4'     the full dotted quad
--   'ipv6-64'  the /64 prefix only, because RFC 4941 privacy extensions rotate
--              the interface identifier roughly daily and were turning one
--              returning person into a new visitor every day
--   'raw'      an address that did not parse, hashed as it arrived
-- NULL means the row was written before this column existed. Those hashes were
-- built from the full address under the v1 salt, so a NULL row can never be
-- joined to, counted with, or compared against a row written since. Filter on
-- hash_scope IS NOT NULL for any repeat-visit or distinct-visitor question that
-- must not mix the two generations.
--
-- SQLite has no ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so the guard here is
-- position, not syntax: this is the last statement in the file, and the CREATE
-- TABLE above deliberately does not declare the column, so first application
-- against any database - fresh or live - runs cleanly. Re-running the file
-- afterwards stops here with "duplicate column name: hash_scope", which is the
-- migration saying it has nothing to do: no table is created twice, no data is
-- touched, and no later statement is skipped because there is none. To re-run
-- with no error at all, run everything above by hand, or run the ALTER alone
-- and only when this returns 0:
--   wrangler d1 execute ryanhennebry-visits --remote --command \
--     "SELECT COUNT(*) FROM pragma_table_info('visits') WHERE name='hash_scope';"
ALTER TABLE visits ADD COLUMN hash_scope TEXT;

-- is_hosting records IPLocate's per-address privacy.is_hosting flag, 1/0/NULL,
-- where NULL means the question was not asked - either no key, a failed lookup,
-- or an ASN cache hit, which deliberately returns every per-address verdict as
-- null rather than inheriting one address's answer for the whole network. A 1
-- suppresses the alert with outcome='suppressed_enrichment', detail='is_hosting'.
--
-- Same positional guard as hash_scope above, with one consequence worth stating:
-- there are now two ALTERs, so re-running the whole file against the live
-- database stops at the hash_scope duplicate and never reaches this one. On any
-- database that already has hash_scope, run this statement alone, and only when
-- the count comes back 0:
--   wrangler d1 execute ryanhennebry-visits --remote --command \
--     "SELECT COUNT(*) FROM pragma_table_info('enrichment') WHERE name='is_hosting';"
ALTER TABLE enrichment ADD COLUMN is_hosting INTEGER;
