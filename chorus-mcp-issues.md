# ask-chorus MCP — Bug Report / Issue Log

**Date observed:** 2026-07-07 (~07:46–07:47 UTC)
**Reporter:** Patrick Lowe (via Claude Code session)
**Server:** `ask-chorus` MCP (Reddit + TikTok crowdsourced research tools)
**Summary:** Every search/research call returned **empty result sets** — including broad, high-volume control queries — despite the built-in health probe (`tiktok_doctor`) reporting most backends as healthy. The server is effectively non-functional for its core purpose right now. Root cause appears to be **anti-bot blocking on the data-source side (Reddit 403) plus a silent-failure design** that makes TikTok look healthy while returning nothing.

---

## 1. Impact / Severity

- **Severity: High.** The two primary capabilities (Reddit research, TikTok research) both return zero usable data.
- **User-facing symptom:** Tools "succeed" (HTTP 200, valid JSON envelope) but always contain `post_count: 0` / `video_count: 0` and empty `videos`/`posts` arrays. There is **no error surfaced to the caller** — the failure is silent.
- **Why this is worse than a hard error:** A silent empty result is indistinguishable from "no matching content exists." A caller/agent can't tell the difference between "the query genuinely has no results" and "the backend is broken/blocked." This wastes retries and erodes trust in the tool.

---

## 2. Reproduction Steps

All calls below were made in a single session. Every one returned empty.

### 2a. Reddit — research endpoint
```
reddit_research(query="things to do Riverside CA")        -> post_count: 0, posts: []
reddit_research(query="Riverside birthday date night")    -> post_count: 0, posts: []
reddit_research(query="best restaurants Riverside CA")     -> post_count: 0, posts: []
```

### 2b. Reddit — raw search endpoint
```
reddit_search(query="Riverside CA things to do")           -> {"result": []}
reddit_search(query="Los Angeles restaurants")             -> {"result": []}   # broad control query, still empty
```

### 2c. TikTok — research + raw search
```
tiktok_research(query="things to do Riverside CA")          -> video_count: 0, videos: []
tiktok_research(query="Riverside California date ideas")     -> video_count: 0, videos: []
tiktok_search(query="Riverside California hidden gems")      -> {"result": []}
tiktok_search(query="Los Angeles food")                     -> {"result": []}   # broad control query, still empty
tiktok_search(query="Riverside CA things to do", limit=20)  -> {"result": []}
```

**Key diagnostic point:** Broad, guaranteed-high-volume control queries ("Los Angeles restaurants", "Los Angeles food") *also* returned empty. This rules out "bad/narrow query" as the cause and points to a backend/blocking failure.

---

## 3. Health Probe Output (`tiktok_doctor`)

Run immediately after the failing searches. Annotated:

| Group | Backend | ok | Detail |
|---|---|---|---|
| search | tiktokapi | ✅ true | |
| search | playwright | ✅ true | |
| search | **cdp** | ❌ false | `CDP port 9222 not reachable` |
| metadata | ytdlp | ✅ true | |
| transcript | captions | ✅ true | |
| transcript | mlx | ✅ true | |
| transcript | faster | ✅ true | |
| comments | **signed** | ❌ false | `no msToken available (env CHORUS_MS_TOKEN or .ms_token)` |
| comments | requests | ✅ true | |
| comments | tiktokapi | ✅ true | |
| reddit_search | **reddit_json** | ❌ false | `HTTPStatusError("Client error '403 Blocked' for url 'https://www.reddit.com/r/all/hot.json?limit=1'")` |
| reddit_search | reddit_playwright | ✅ true | |
| reddit_comments | **reddit_json** | ❌ false | same `403 Blocked` on `reddit.com/r/all/hot.json` |
| reddit_comments | reddit_playwright | ✅ true | |

---

## 4. Root-Cause Analysis (by subsystem)

### Issue #1 — Reddit JSON API returns 403 Blocked  *(confirmed, primary Reddit failure)*
- **Evidence:** `reddit_json` probe fails with `403 Blocked` on `https://www.reddit.com/r/all/hot.json?limit=1`.
- **Cause:** Reddit actively blocks unauthenticated/scraper access to its `.json` endpoints. A plain HTTP client with a default/absent User-Agent gets 403'd. This is a known Reddit policy change, not a transient blip.
- **Why the fallback didn't save it:** The probe says `reddit_playwright` is `ok: true`, yet `reddit_search`/`reddit_research` still returned `[]`. So either (a) the code does **not** actually fall back from `reddit_json` to `reddit_playwright` on 403, or (b) the Playwright path "connects" (probe passes) but fails to scrape/parse results (returns empty). Either way there's a **fallback gap**.
- **Fix directions:**
  - Use the **official Reddit OAuth API** (`https://oauth.reddit.com`) with a registered app (client_id/secret) and a descriptive `User-Agent` (Reddit requires the format `platform:appid:version (by /u/username)`). This is the durable fix — the `.json` scraping approach is fundamentally fragile.
  - If staying with scraping: set a **realistic `User-Agent`** header, respect rate limits, and add backoff. But expect continued breakage.
  - **Actually wire the Playwright fallback** into the search path (not just the health probe) and verify it returns parsed posts, not an empty list.

### Issue #2 — TikTok search returns empty despite "healthy" backends  *(confirmed, primary TikTok failure)*
- **Evidence:** `tiktokapi` and `playwright` search backends both probe `ok: true`, but every `tiktok_search`/`tiktok_research` returned `[]`.
- **Likely causes (needs source inspection to confirm):**
  - The health probe tests **connectivity/import only**, not an actual end-to-end search. A backend can be "reachable" while search returns nothing (e.g., TikTok changed its response schema and the parser now yields zero items).
  - Missing session/auth token (see Issue #3 — `msToken` absent) causing the search API to return an empty or challenge payload that the parser silently treats as "no results."
  - Anti-bot / region / rate-limit response being parsed as an empty result set instead of raising.
- **Fix directions:**
  - Make the health probe **run a real canned query** (e.g., search a common term, assert ≥1 result) instead of a shallow reachability check. A probe that reports green while the feature is fully broken is the single most misleading part of this incident.
  - Add response-shape validation: if the upstream payload is missing the expected result container, **raise/log** instead of returning `[]`.

### Issue #3 — Missing `msToken` (CHORUS_MS_TOKEN / .ms_token)  *(confirmed config gap)*
- **Evidence:** comments `signed` backend fails: `no msToken available (env CHORUS_MS_TOKEN or .ms_token)`.
- **Cause:** TikTok's signed endpoints (needed for comments, and often for reliable search) require an `msToken` (and typically signature params). It's unset in this environment.
- **Impact:** Degrades comment fetching to the unsigned `requests`/`tiktokapi` paths, and may be contributing to empty search results.
- **Fix directions:**
  - Document how to obtain and set `CHORUS_MS_TOKEN` (or a `.ms_token` file) in the README/setup.
  - Fail loudly at startup with a clear message if signed features are requested but no token is configured.

### Issue #4 — CDP port 9222 not reachable  *(confirmed, likely low priority)*
- **Evidence:** search `cdp` backend fails: `CDP port 9222 not reachable`.
- **Cause:** The Chrome DevTools Protocol backend expects a Chrome instance listening on `localhost:9222` (`--remote-debugging-port=9222`); none is running.
- **Impact:** Only matters if CDP is a required/priority search backend. Since `tiktokapi`/`playwright` probe green, this may be an optional path — but if the intended primary path is CDP, this is significant.
- **Fix directions:** Either document the requirement to launch Chrome with `--remote-debugging-port=9222`, or auto-launch it, or drop CDP from the default backend list if deprecated.

---

## 5. Cross-Cutting Design Issues (the important ones to fix)

These are the systemic problems that turned recoverable upstream breakage into a silent, undiagnosable outage:

1. **Silent empty results instead of errors.**
   The core anti-pattern. When every backend for a capability fails/blocks, the tool should return a **structured error** (or set an `error`/`degraded` field in the JSON envelope), not `{"result": []}` / `post_count: 0`. Right now a broken server is indistinguishable from a legitimately empty query.

2. **Health probe does not reflect real capability.**
   `tiktok_doctor` reported the TikTok search path green while search was 100% non-functional. Probes must exercise the **actual end-to-end operation** (search a known term, assert results parse) — shallow reachability checks give false confidence.

3. **Fallback chains aren't actually exercised.**
   `reddit_playwright` probes green but the search path still returned empty on Reddit — suggests the primary→fallback wiring in the request path differs from (or is missing relative to) what the probe checks. Fallbacks should be covered by integration tests that force the primary to fail.

4. **No surfaced diagnostics on the failing call.**
   The failing `reddit_research`/`tiktok_research` responses contained empty `aggregate.caveats` arrays. That `caveats` channel is the perfect place to emit "reddit_json returned 403; fell back to playwright which returned 0 parsed posts" so callers understand *why* it's empty.

5. **Fragility of scraping unofficial endpoints.**
   Both Reddit `.json` and unofficial TikTok endpoints are actively defended against bots and change without notice. Wherever an official API exists (Reddit OAuth API in particular), prefer it.

---

## 6. Recommended Fix Priority

| Priority | Item | Rationale |
|---|---|---|
| P0 | Make failures **loud** (structured errors + populate `caveats`) instead of empty results | Fixes the "undiagnosable" problem regardless of upstream |
| P0 | Migrate Reddit to **official OAuth API** with proper `User-Agent` | Addresses the confirmed 403 at the source |
| P1 | Make `tiktok_doctor` (and per-capability probes) run **real end-to-end** checks | Stops false-green reporting |
| P1 | Fix / verify **Reddit Playwright fallback** actually parses & returns posts | Confirmed fallback gap |
| P1 | Investigate why **TikTok search parses to 0 items** (schema drift? auth?) | Confirmed primary TikTok failure |
| P2 | Document + validate **`CHORUS_MS_TOKEN`** setup; fail loudly if missing | Config gap affecting comments/search |
| P2 | Document/auto-launch **CDP Chrome on :9222**, or remove if deprecated | Optional backend, low impact |
| P3 | Add **integration tests** that force-fail primaries and assert fallbacks + error surfacing | Prevents regression |

---

## 7. Raw Evidence Appendix

### 7a. Example empty research envelope (Reddit)
```json
{
  "query": "best restaurants Riverside CA",
  "generated_at": "2026-07-07T07:46:45.240794+00:00",
  "post_count": 0,
  "posts": [],
  "aggregate": { "consensus_hint": [], "caveats": [] }
}
```

### 7b. Example empty research envelope (TikTok)
```json
{
  "query": "Riverside California date ideas",
  "generated_at": "2026-07-07T07:47:33.513514+00:00",
  "video_count": 0,
  "videos": [],
  "aggregate": { "consensus_hint": [], "caveats": [] }
}
```

### 7c. Full `tiktok_doctor` output
```json
{
  "search": [
    { "name": "tiktokapi", "ok": true, "detail": "" },
    { "name": "playwright", "ok": true, "detail": "" },
    { "name": "cdp", "ok": false, "detail": "CDP port 9222 not reachable" }
  ],
  "metadata": [
    { "name": "ytdlp", "ok": true, "detail": "" }
  ],
  "transcript": [
    { "name": "captions", "ok": true, "detail": "" },
    { "name": "mlx", "ok": true, "detail": "" },
    { "name": "faster", "ok": true, "detail": "" }
  ],
  "comments": [
    { "name": "signed", "ok": false, "detail": "no msToken available (env CHORUS_MS_TOKEN or .ms_token)" },
    { "name": "requests", "ok": true, "detail": "" },
    { "name": "tiktokapi", "ok": true, "detail": "" }
  ],
  "reddit_search": [
    { "name": "reddit_json", "ok": false, "detail": "HTTPStatusError(\"Client error '403 Blocked' for url 'https://www.reddit.com/r/all/hot.json?limit=1'\")" },
    { "name": "reddit_playwright", "ok": true, "detail": "" }
  ],
  "reddit_comments": [
    { "name": "reddit_json", "ok": false, "detail": "HTTPStatusError(\"Client error '403 Blocked' for url 'https://www.reddit.com/r/all/hot.json?limit=1'\")" },
    { "name": "reddit_playwright", "ok": true, "detail": "" }
  ]
}
```

---

## 8. Notes / Caveats on This Report

- Findings are based purely on **black-box observation** of tool responses + the `tiktok_doctor` probe from one session. I did **not** have access to the ask-chorus source code, so the root-cause statements for Issues #2 (TikTok empty) and the Reddit fallback gap are **inferred hypotheses**, clearly the most likely explanations given the evidence, but they need confirmation against the actual code.
- The Reddit 403 and the missing-msToken / CDP-port findings are **directly reported by the server's own probe** and can be treated as confirmed.
- Some failures *may* be transient (rate-limit windows). But the fact that broad control queries returned empty, and that the probe shows a hard 403 policy block, indicates at least the Reddit path is a **structural** failure, not a blip.
