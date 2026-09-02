-- Retroactive reclassification of the ryanhennebry.xyz visit log.
--
-- This file re-derives the classification column for rows that were written
-- by an older, narrower classify(). It is the payoff of having stored the raw
-- fields: as_org, asn, ua and path are all still there, so no visit has to be
-- thrown away or guessed at.
--
-- Run it remotely, in one go:
--   npx --yes wrangler@4.125.0 d1 execute ryanhennebry-visits --remote \
--     --file=reclassify.sql
--
-- It is idempotent. Statement 1 resets every row to 'human' and the rest
-- re-apply the rules, so running it twice gives the same table as running it
-- once. It never deletes a row.
--
-- The statements run in REVERSE precedence order, lowest first, so that the
-- highest precedence rule is the last writer:
--   human (default) -> datacenter -> bot_ua -> scanner -> asset
-- which is the same precedence classify() applies in src/index.js:
--   asset > scanner > bot_ua > datacenter > human
--
-- Word boundaries. The JavaScript rules use \b. SQLite has no regex, so each
-- as_org is normalised first: punctuation becomes a space and the whole
-- string is space padded and lowercased, so ' colo ' matches the word "Colo"
-- but not "Colombia". That normalisation is the CTE named n below.

-- 1. Reset. Everything is human until a rule says otherwise.
UPDATE visits SET classification = 'human';

-- 2. datacenter: hosting, cloud and VPS networks.
--    Two independent tests, matching classify():
--      (a) the explicit ASN set, which wins outright. Networks whose
--          as_org hides what they are ("Private Customer" = Hivelocity,
--          "6 COLLYER QUAY" = Tencent) are only catchable this way.
--      (b) as_org name heuristics, but only when the name is not ISP-ish.
--          The consumer ISP test is a NOT, so "CABLE ONE", "BTBROADBAND"
--          and "Bredband2 Customer" stay human even though a loose
--          hosting keyword might otherwise fire on them.
WITH n AS (
  SELECT id,
         lower(' ' || replace(replace(replace(replace(
           COALESCE(as_org, ''), ',', ' '), '.', ' '), '-', ' '), '_', ' ') || ' ') AS o
  FROM visits
)
UPDATE visits SET classification = 'datacenter'
WHERE asn IN (
    16509, 14618,          -- Amazon AWS
    15169, 396982,         -- Google, Google Cloud
    8075,                  -- Microsoft Azure
    14061,                 -- DigitalOcean
    24940,                 -- Hetzner
    16276,                 -- OVH
    63949,                 -- Linode
    12876,                 -- Scaleway
    13335,                 -- Cloudflare
    9009,                  -- M247
    7203, 32613,           -- Leaseweb US, Leaseweb Canada
    40676,                 -- Psychz Networks
    45090, 132203,         -- Tencent Cloud
    45102,                 -- Alibaba Cloud / Aliyun
    60068, 212238,         -- Datacamp / CDN77
    31898,                 -- Oracle Cloud
    11320,                 -- Massed Compute
    48090,                 -- TECHOFF SRV LIMITED
    62164,                 -- DEDIK SERVICES LIMITED
    210558,                -- 1337 Services GmbH (FlokiNET)
    211590,                -- FBW NETWORKS SAS
    197170,                -- TechTies Inc.
    34343,                 -- Eweka Internet Services
    25369,                 -- Hydra Communications
    201814,                -- MEVSPACE
    203020,                -- HostPapa / HostRoyale
    51747,                 -- Internetbolaget
    209946,                -- Partner Hosting
    209605,                -- "Cloud hosting"
    14956,                 -- RouterHosting
    203516,                -- AltunHOST
    215925,                -- VPSVAULT.HOST
    29802,                 -- Hivelocity
    30058,                 -- FDCservers
    29066,                 -- Rackmarkt
    39351,                 -- 31173 Services
    62874,                 -- Web2Objects
    154177,                -- LIGHT NODE LIMITED
    202412,                -- OMEGATECH
    204876,                -- UZMANSOFT
    200373,                -- 3xK Tech
    51167,                 -- Internet Utilities NA
    54103,                 -- MOD Mission Critical
    205759,                -- Ghosty Networks / Cyber-Security-SG
    219502                 -- FOP Danik Vyacheslav Evgenievich
  )
  OR id IN (
    SELECT id FROM n
    WHERE (
        -- hosting, cloud, VPS and colocation words
        o LIKE '% host%' OR o LIKE '%host %' OR o LIKE '%hosting %'
        OR o LIKE '% cloud%'
        OR o LIKE '% server%'
        OR o LIKE '% vps%'
        OR o LIKE '% colo %' OR o LIKE '% colocation %'
        OR o LIKE '%datacenter%' OR o LIKE '%data center%'
        OR o LIKE '%datacentre%' OR o LIKE '%data centre%'
        OR o LIKE '% srv %'
        OR o LIKE '% dedik%'
        OR o LIKE '% compute %' OR o LIKE '% computing %'
        OR o LIKE '%bulletproof%'
        -- named operators
        OR o LIKE '% datacamp %'
        OR o LIKE '% m247 %'
        OR o LIKE '% ovh %'
        OR o LIKE '% hetzner %'
        OR o LIKE '% digitalocean %'
        OR o LIKE '% linode %'
        OR o LIKE '% vultr %'
        OR o LIKE '% contabo %'
        OR o LIKE '% leaseweb %'
        OR o LIKE '% choopa %'
        OR o LIKE '% quadranet %'
        OR o LIKE '% psychz %'
        OR o LIKE '% scaleway %'
        OR o LIKE '% rackspace %'
        OR o LIKE '% amazon %'
        OR o LIKE '% aws %'
        OR o LIKE '% azure %'
        OR o LIKE '% aliyun %'
        OR o LIKE '% alibaba %'
        OR o LIKE '% tencent %'
        OR o LIKE '% huawei %'
        OR o LIKE '% flokinet %'
      )
      AND NOT (
        -- consumer and access ISP names win over the heuristics above
        o LIKE '%broadband%'
        OR o LIKE '% dsl %' OR o LIKE '% adsl %'
        OR o LIKE '% cable %'
        OR o LIKE '%teleco%' OR o LIKE '%teleko%' OR o LIKE '%telefon%'
        OR o LIKE '% mobile %'
        OR o LIKE '% wireless %'
        OR o LIKE '% provedor %'
        OR o LIKE '%banda larga%'
        OR o LIKE '%virgin media%'
        OR o LIKE '%sky uk%' OR o LIKE '%sky broadband%'
        OR o LIKE '% comcast %'
        OR o LIKE '% vodafone %'
        OR o LIKE '% claro %'
        OR o LIKE '% starlink %'
        OR o LIKE '% spacex %'
        OR o LIKE '%consumer%'
        OR o LIKE '% customer %' OR o LIKE '% customers %'
        OR o LIKE '%residential%'
        OR o LIKE '%universit%'
        OR o LIKE '% fibre %'
      )
  );

-- 3. bot_ua: self-identifying automation in the user agent.
--    Same token list as the BOT_UA regex. LIKE is case insensitive for
--    ASCII in SQLite, so no lower() is needed. The regex terms gptbot,
--    claudebot, perplexitybot, bytespider and ccbot are already covered by
--    '%bot%' and '%spider%'.
UPDATE visits SET classification = 'bot_ua'
WHERE ua IS NOT NULL
  AND (
    ua LIKE '%bot%'
    OR ua LIKE '%crawl%'
    OR ua LIKE '%spider%'
    OR ua LIKE '%slurp%'
    OR ua LIKE '%curl%'
    OR ua LIKE '%wget%'
    OR ua LIKE '%python-requests%'
    OR ua LIKE '%headless%'
    OR ua LIKE '%preview%'
    OR ua LIKE '%fetch%'
    OR ua LIKE '%monitor%'
    OR ua LIKE '%uptime%'
    OR ua LIKE '%lighthouse%'
  );

-- 4. scanner: internet-wide scanners and threat intelligence crawlers.
--    Matched on as_org, because several of them present a plain browser
--    user agent. Plain substring matches, no word boundary needed.
UPDATE visits SET classification = 'scanner'
WHERE as_org IS NOT NULL
  AND (
    lower(as_org) LIKE '%censys%'
    OR lower(as_org) LIKE '%driftnet%'
    OR lower(as_org) LIKE '%shodan%'
    OR lower(as_org) LIKE '%binaryedge%'
    OR lower(as_org) LIKE '%palo alto networks%'
    OR lower(as_org) LIKE '%internet-measurement%'
    OR lower(as_org) LIKE '%internet measurement%'
    OR lower(as_org) LIKE '%onyphe%'
    OR lower(as_org) LIKE '%leakix%'
    OR lower(as_org) LIKE '%stretchoid%'
    OR lower(as_org) LIKE '%alpha strike%'
    OR lower(as_org) LIKE '%netsystems research%'
    OR lower(as_org) LIKE '%recyber%'
  );

-- 5. asset: any request for a file rather than the document. Highest
--    precedence, so a stylesheet fetched by a real person is still an asset.
UPDATE visits SET classification = 'asset'
WHERE path LIKE '%.css'
   OR path LIKE '%.js'
   OR path LIKE '%.mjs'
   OR path LIKE '%.map'
   OR path LIKE '%.json'
   OR path LIKE '%.webmanifest'
   OR path LIKE '%.woff'
   OR path LIKE '%.woff2'
   OR path LIKE '%.ttf'
   OR path LIKE '%.otf'
   OR path LIKE '%.eot'
   OR path LIKE '%.ico'
   OR path LIKE '%.png'
   OR path LIKE '%.jpg'
   OR path LIKE '%.jpeg'
   OR path LIKE '%.gif'
   OR path LIKE '%.svg'
   OR path LIKE '%.webp'
   OR path LIKE '%.avif'
   OR path LIKE '%.txt'
   OR path LIKE '%.xml'
   OR path LIKE '%.pdf';

-- 6. The result, for the record.
SELECT classification,
       COUNT(*)                     AS hits,
       COUNT(DISTINCT visitor_hash) AS visitors
FROM visits
GROUP BY classification
ORDER BY hits DESC;
