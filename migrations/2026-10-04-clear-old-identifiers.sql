-- Clears the visitor identifiers written before the v3 hash, and the four
-- fingerprint columns, from the live visit log.
--
-- Nothing runs this file: not deploy.sh, not verify.sh, not the Worker. It is
-- optional. Without it the same rows age out under the 90-day purge. Run it by
-- hand, once, after the v3 Worker is deployed and has logged at least one
-- visit, and only with Ryan's yes:
--   npx --yes wrangler@4.125.0 d1 execute ryanhennebry-visits --remote \
--     --file=migrations/2026-10-04-clear-old-identifiers.sql
--
-- Why: v1 and v2 hashes were salted with the month, a value anyone can read in
-- this public repository, so an IPv4 visitor can be recovered from them by
-- brute force. They cannot be re-hashed under the new salt because no IP was
-- ever stored, so the only fix is to clear them.
--
-- Pre-cutover means, in visits, any hash whose hash_scope does not start with
-- 'v3:'. alerts_sent and alert_log have no hash_scope, so there it means any
-- hash that no v3 visits row carries. Matching on the hash, not on time,
-- also catches rows an old isolate wrote while the deploy rolled out. Until
-- the v3 Worker has written a row, the EXISTS guard makes those two
-- statements change nothing.
--
-- alerts_sent.visitor_hash is NOT NULL and part of the primary key, so its
-- pre-cutover rows are deleted rather than cleared. Each is only the
-- one-alert-per-day lock for a day that has already passed.
--
-- Safe to run twice: a second run finds nothing left to change.

UPDATE visits
SET visitor_hash = NULL
WHERE visitor_hash IS NOT NULL
  AND (hash_scope IS NULL OR hash_scope NOT LIKE 'v3:%');

UPDATE alert_log
SET visitor_hash = NULL
WHERE visitor_hash IS NOT NULL
  AND EXISTS (SELECT 1 FROM visits WHERE hash_scope LIKE 'v3:%')
  AND visitor_hash NOT IN (
    SELECT visitor_hash FROM visits
    WHERE hash_scope LIKE 'v3:%' AND visitor_hash IS NOT NULL
  );

DELETE FROM alerts_sent
WHERE EXISTS (SELECT 1 FROM visits WHERE hash_scope LIKE 'v3:%')
  AND visitor_hash NOT IN (
    SELECT visitor_hash FROM visits
    WHERE hash_scope LIKE 'v3:%' AND visitor_hash IS NOT NULL
  );

UPDATE visits
SET accept_language = NULL,
    http_protocol = NULL,
    tls_version = NULL,
    client_tcp_rtt = NULL
WHERE accept_language IS NOT NULL
   OR http_protocol IS NOT NULL
   OR tls_version IS NOT NULL
   OR client_tcp_rtt IS NOT NULL;
