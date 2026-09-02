-- Ready-to-run reads for the ryanhennebry.xyz visit log.
--
-- Run one at a time, remotely:
--   npx --yes wrangler@4.125.0 d1 execute ryanhennebry-visits --remote \
--     --command "<paste a single query here>"
--
-- Or run the whole file against the local dev database:
--   npx --yes wrangler@4.125.0 d1 execute ryanhennebry-visits --local --file=queries.sql
--
--
-- HOW TO READ THESE
--
-- classification is a stored column, never a drop filter. Every request is
-- written. The classifier in src/index.js sorts each row into, in order of
-- precedence:
--   asset      a file request: stylesheet, font, favicon, robots.txt
--   scanner    Censys, Driftnet, Palo Alto Cortex Xpanse and friends, matched
--              on the AS organisation because they often send a browser UA
--   bot_ua     the user agent says bot, crawl, spider, curl, headless, ...
--   datacenter hosting, cloud and VPS networks, by ASN and by org name
--   human      the residual. It means "not obviously a machine". It does NOT
--              mean "a person read the page".
--
-- Because 'human' is a residual, the headline queries below add two more
-- filters and call the result a CANDIDATE visit:
--   ua LIKE '%Mozilla%'   a real browser announces itself; bare HTTP clients
--                         and most exploit scripts do not
--   path NOT LIKE '%.%'   the document, not a file. This also removes the
--                         /wp-login.php, /xmlrpc.php and /.env probes that
--                         arrive from compromised home routers, which are on
--                         consumer ISPs and so land in 'human' by definition
--
-- That triple is the STRICT filter. It is the default in queries 1 to 4.
-- Query 6 is the same data with nothing filtered at all.
--
-- visitor_hash is a salted hash of address plus user agent, re-salted every
-- calendar month. It joins within a month and cannot be joined across months.
-- No raw IP is stored anywhere.
--
--
-- TWO GENERATIONS OF visitor_hash. READ THIS BEFORE COUNTING VISITORS.
--
-- hash_scope IS NULL   v1. The hash covered the FULL address. Most traffic here
--                      is IPv6, and IPv6 privacy extensions rotate the low 64
--                      bits of the address roughly daily on macOS, iOS and
--                      Android, so one returning person produced a new hash
--                      most days. These hashes are unstable: they overcount
--                      distinct visitors and undercount repeats.
-- hash_scope NOT NULL  v2. The hash covers the IPv6 /64 prefix (or the whole
--                      IPv4 address), which does not rotate, under a new salt
--                      version.
--
-- The two never agree. The same person has a different hash either side of the
-- change, and a v1 hash can never equal a v2 hash, so counting them together
-- counts that person twice. Every query below that counts distinct visitors or
-- looks for repeats therefore restricts itself to hash_scope IS NOT NULL, and
-- says so in its column name. Hit counts and row listings still cover the whole
-- log; it is only visitor identity that is v2-only.


-- 1. CANDIDATE REAL VISITS, most recent first.
--    The main list. One row per document request that survived the strict
--    filter. Read as_org first: a company or university name is the signal,
--    a consumer ISP name is background.
SELECT ts,
       COALESCE(as_org, '(unknown)')  AS as_org,
       COALESCE(country, '??')        AS country,
       COALESCE(referer, '(none)')    AS referer,
       path,
       COALESCE(city, '')             AS city,
       visitor_hash
FROM visits
WHERE classification = 'human'
  AND ua LIKE '%Mozilla%'
  AND path NOT LIKE '%.%'
ORDER BY ts DESC
LIMIT 100;


-- 2. REPEAT VISITORS THIS CALENDAR MONTH.
--    Anyone who came back. Two hits a few seconds apart is one page view
--    with a reload; hits on two different days is somebody returning.
--    v2 rows only. A v1 hash cannot be trusted to mean "the same person came
--    back", which is the entire question this query asks.
SELECT visitor_hash,
       COUNT(*)                          AS hits,
       COUNT(DISTINCT substr(ts, 1, 10)) AS days,
       MIN(ts)                           AS first_seen,
       MAX(ts)                           AS last_seen,
       MAX(as_org)                       AS as_org,
       MAX(country)                      AS country
FROM visits
WHERE classification = 'human'
  AND ua LIKE '%Mozilla%'
  AND path NOT LIKE '%.%'
  AND visitor_hash IS NOT NULL
  AND hash_scope IS NOT NULL
  AND substr(ts, 1, 7) = strftime('%Y-%m', 'now')
GROUP BY visitor_hash
HAVING COUNT(*) > 1
ORDER BY days DESC, hits DESC;


-- 3. REFERRERS.
--    Where candidate visits came from, with two exclusions:
--      self-referrals, which are just the second page view of one session,
--      and the standard referrer spam domains, which are fabricated headers
--      sent by bots hoping a site owner will click through to them.
--    An empty result is the expected shape for this page: people arrive by
--    typing the name or from a link that sends no referer at all.
SELECT COALESCE(referer, '(none)')  AS referer,
       COUNT(*)                     AS hits,
       -- Visitors are counted over v2 rows only; hits cover the whole log.
       COUNT(DISTINCT CASE WHEN hash_scope IS NOT NULL THEN visitor_hash END)
                                    AS visitors_v2,
       MAX(ts)                      AS last_seen
FROM visits
WHERE classification = 'human'
  AND ua LIKE '%Mozilla%'
  AND path NOT LIKE '%.%'
  AND (referer IS NULL OR (
        referer NOT LIKE '%ryanhennebry.xyz%'
    AND lower(referer) NOT LIKE '%semalt%'
    AND lower(referer) NOT LIKE '%buttons-for-website%'
    AND lower(referer) NOT LIKE '%buttons-for-your-website%'
    AND lower(referer) NOT LIKE '%darodar%'
    AND lower(referer) NOT LIKE '%ilovevitaly%'
    AND lower(referer) NOT LIKE '%hulfingtonpost%'
    AND lower(referer) NOT LIKE '%best-seo-offer%'
    AND lower(referer) NOT LIKE '%best-seo-solution%'
    AND lower(referer) NOT LIKE '%4webmasters%'
    AND lower(referer) NOT LIKE '%free-share-buttons%'
    AND lower(referer) NOT LIKE '%free-social-buttons%'
    AND lower(referer) NOT LIKE '%success-seo%'
    AND lower(referer) NOT LIKE '%trafficmonetizer%'
    AND lower(referer) NOT LIKE '%rankings-analytics%'
    AND lower(referer) NOT LIKE '%videos-for-your-business%'
    AND lower(referer) NOT LIKE '%econom.co%'
    AND lower(referer) NOT LIKE '%event-tracking%'
    AND lower(referer) NOT LIKE '%floating-share-buttons%'
    AND lower(referer) NOT LIKE '%site-auditor%'
    AND lower(referer) NOT LIKE '%web-revenue%'
  ))
GROUP BY referer
ORDER BY hits DESC;


-- 4. EVENT WINDOW. The primary use of this log.
--    You have just sent the link to somebody. Did they open it?
--    Edit the two timestamps below and nothing else. They are UTC and
--    compare as plain text, so any prefix of an ISO 8601 stamp works:
--    '2026-09-01' is the whole day, '2026-09-01T14' is that one hour.
--    Every column you would want in order to recognise the person is here.
--    A window with one row from a named company is the answer you sent the
--    link hoping for; a window with nothing in it is also an answer.
SELECT ts,
       COALESCE(as_org, '(unknown)') AS as_org,
       COALESCE(country, '??')       AS country,
       COALESCE(city, '')            AS city,
       COALESCE(timezone, '')        AS timezone,
       COALESCE(referer, '(none)')   AS referer,
       path,
       visitor_hash
FROM visits
WHERE ts >= '2026-09-01T00:00:00'   -- window opens (edit)
  AND ts <  '2026-09-02T00:00:00'   -- window closes (edit)
  AND classification = 'human'
  AND ua LIKE '%Mozilla%'
  AND path NOT LIKE '%.%'
ORDER BY ts ASC;


-- 4b. EVENT WINDOW, WIDENED.
--     Same window, but showing every classification, with the strict test as
--     its own column. Run this when query 4 comes back empty and you want to
--     see whether the request landed somewhere else: a corporate proxy or a
--     link-preview fetcher will show up here as datacenter or bot_ua.
SELECT ts,
       classification,
       CASE WHEN ua LIKE '%Mozilla%' AND path NOT LIKE '%.%'
            THEN 'yes' ELSE 'no' END  AS strict,
       COALESCE(as_org, '(unknown)')  AS as_org,
       COALESCE(country, '??')        AS country,
       path,
       substr(COALESCE(ua, ''), 1, 60) AS ua_head
FROM visits
WHERE ts >= '2026-09-01T00:00:00'   -- window opens (edit)
  AND ts <  '2026-09-02T00:00:00'   -- window closes (edit)
ORDER BY ts ASC;


-- 5. DAILY COUNTS BY CLASSIFICATION.
--    The shape of the traffic. 'strict' is the only column that could be a
--    person; everything else is the weather.
SELECT substr(ts, 1, 10) AS day,
       SUM(classification = 'human'
           AND ua LIKE '%Mozilla%'
           AND path NOT LIKE '%.%')       AS strict,
       SUM(classification = 'human')      AS human_raw,
       SUM(classification = 'datacenter') AS datacenter,
       SUM(classification = 'scanner')    AS scanner,
       SUM(classification = 'bot_ua')     AS bot_ua,
       SUM(classification = 'asset')      AS asset,
       COUNT(*)                           AS total
FROM visits
GROUP BY day
ORDER BY day DESC;


-- 5b. CLASSIFICATION TOTALS over the whole log.
--     hits span both hash generations; visitors_v2 counts only rows whose
--     hash is stable, so it is a floor, not a total, for anything before the
--     change.
SELECT classification,
       COUNT(*)                     AS hits,
       COUNT(DISTINCT CASE WHEN hash_scope IS NOT NULL THEN visitor_hash END)
                                    AS visitors_v2,
       MIN(ts)                      AS first_seen,
       MAX(ts)                      AS last_seen
FROM visits
GROUP BY classification
ORDER BY hits DESC;


-- 6. THE RAW FIREHOSE. UNFILTERED. NOTHING IS EXCLUDED HERE.
--    Every column of the last hundred rows exactly as stored, including
--    assets, scanners, bots and datacenter traffic. This is the query to
--    run when a rule looks wrong, because it is the only one that can show
--    you what the classifier is deciding about.
--    DELIBERATELY UNFILTERED, INCLUDING BY HASH GENERATION: the rows it
--    returns may mix v1 and v2 hashes, which is why hash_scope is selected
--    alongside visitor_hash. Do not compare two hashes here without checking
--    that both rows carry the same hash_scope. Nothing is counted, so nothing
--    is double counted.
SELECT ts, path, status, classification, asn, as_org, country, city, colo,
       referer, ua, accept_language, http_protocol, tls_version,
       client_tcp_rtt, visitor_hash, hash_scope
FROM visits
ORDER BY id DESC
LIMIT 100;


-- 7. WHAT THE CLASSIFIER DID, BY NETWORK.
--    An audit of the rules themselves: every AS organisation seen, what it
--    was called, and how browser-like its requests were. A row with a high
--    'browserish' count sitting in 'human' that you do not recognise is the
--    next rule to write; a consumer ISP sitting in 'datacenter' is a bug.
SELECT COALESCE(as_org, '(unknown)') AS as_org,
       asn,
       classification,
       COUNT(*)                      AS hits,
       -- v2 rows only; see the note at the top of this file.
       COUNT(DISTINCT CASE WHEN hash_scope IS NOT NULL THEN visitor_hash END)
                                     AS visitors_v2,
       SUM(ua LIKE '%Mozilla%')      AS browserish,
       MAX(ts)                       AS last_seen
FROM visits
GROUP BY as_org, asn, classification
ORDER BY hits DESC
LIMIT 120;
