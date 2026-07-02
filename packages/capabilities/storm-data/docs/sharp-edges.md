# storm-data · sharp edges

## 1. NOAA storm event database has 90-day lag

NOAA SEI publishes events 60-90 days after occurrence. For recent storms, fall through to HailTrace (paid, near-real-time) or NWS LSR (free, public, may be incomplete). Cache key must include `provider` so a NOAA-miss + HailTrace-hit can both be stored.

## 2. HailTrace API charges per query, not per result

A query for "Dallas TX last 30 days" costs the same as "Dallas TX 2010-2026". Always narrow date range first. Track per-API call cost in CostLedger.

## 3. Lat/lng precision matters for hail-swath matching

4-decimal places (~11m precision) is the sweet spot. 3 decimals (~111m) miss swath edges; 6 decimals (~0.1m) is meaningless precision and bloats cache keys.

## 4. RoofLink scrape uses session cookies, not API

Per user memory `rooflink-import` skill: RoofLink has no public API. Scrape via authenticated session cookies, refresh weekly. Cookie expiry = silent zero-result queries; alert via notify.

## 5. Storm events overlap providers without canonical IDs

A March 2026 Dallas hail event will appear in NOAA, HailTrace, and NWS LSR with different IDs and slightly different coordinates/sizes. Dedupe by (lat-bucket, lng-bucket, date, eventType) before emitting `storm.event.matched`.

