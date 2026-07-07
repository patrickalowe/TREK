# TREK → yipyip Rename — Progress

Full rebrand of the codebase from **TREK** to **yipyip**, including user-facing text
*and* technical identifiers (env vars, cookies, DB tables, npm scope, URI scheme, Helm
chart, class names, file names).

> History: the rename was first executed as TREK → Interlog, then revised in place to
> **yipyip** before anything was committed. Since "interlog" appeared nowhere in the
> original codebase, the in-place revision is exactly equivalent to reverting and
> redoing the rename with the new target.

Brand casing (per owner's decision): **`yipyip` is always lowercase**, even in prose and
titles. Code identifiers stay conventional: PascalCase `Yipyip*` for classes/types,
`YIPYIP_*` for env vars.

---

## Case-aware replacement rules

Boundary-aware transforms so ordinary foreign words containing the substring "trek" were
**not** corrupted (e.g. Dutch `Vertrektijd`, `verstrekt`, `trekt`, `intrekken`;
Indonesian `diantrekan`):

| Original | Becomes | Example |
|---|---|---|
| `TREK_` + UPPER (env vars / constants) | `YIPYIP_` | `TREK_PLUGINS_DIR` → `YIPYIP_PLUGINS_DIR` |
| standalone `TREK` (brand, prose) | `yipyip` | `Sign in to TREK` → `Sign in to yipyip` |
| `Trek` inside code identifiers | `Yipyip` | `TrekExceptionFilter` → `YipyipExceptionFilter`, `requiresTrek` → `requiresYipyip` |
| `trek` not flanked by lowercase letters | `yipyip` | `trek_session`, `@trek/shared`, `trek://` |
| brand compounds (2nd pass) | — | `trekoa_`→`yipyipoa_`, `trekcs_`→`yipyipcs_`, `trekrf_`→`yipyiprf_`, `trekplug`→`yipyipplug`, `liketrek.com`→`likeyipyip.com` |

Deliberately **left unchanged**: genuine Dutch/Indonesian words containing "trek", and a
coincidental `...nvtREkU1...` substring inside a base64 integrity hash in
`package-lock.json`.

---

## Completed

### 1. Bulk source rename ✅
- **835+ tracked text files** updated (binaries and lockfiles excluded).
- Env vars (`YIPYIP_PLUGINS_DIR`, `YIPYIP_DB_FILE`, …), cookies (`yipyip_session`,
  `yipyip_oidc_state`), localStorage keys (`yipyip_dashboard_tz`, …), CSS classes
  (`.yipyip-journey-popup`), URI scheme (`yipyip://trips/…`), i18n strings across all
  languages, docs/wiki, Docker/Fly/Helm config.
- OAuth token prefixes: `yipyipoa_` / `yipyipcs_` / `yipyiprf_`.
- Plugin bundle/format tokens: `.yipyipplugin` bundles, `yipyipplug-` temp dirs.

### 2. DB table/column rename via guarded migration ✅
The photo tables and a plugin column are created in **historical migrations that already
ran on users' databases**. Rewriting historical DDL would break partially-migrated DBs, so:
- Historical DDL still creates `trek_photos` / `trek_photo_cache_meta` /
  `plugins.min_trek_version` (intentional — do not "fix" these).
- A **new idempotent, guarded migration appended at the end** renames them:
  - `trek_photos` → `yipyip_photos`
  - `trek_photo_cache_meta` → `yipyip_photo_cache_meta`
  - `plugins.min_trek_version` → `min_yipyip_version`
  - indexes recreated as `idx_yipyip_photos_*` / `idx_yipyip_photo_cache_meta_*`
- All **runtime query code** (services, types, test factories) references `yipyip_photos`.
- The video-support migration's error guard was broadened to also swallow `no such table`
  so the test suite's rewind-and-replay pattern stays valid after the rename.

### 3. File / directory renames (git mv) ✅
- `charts/trek/` → `charts/yipyip/`
- `server/src/nest/common/trek-exception.filter.ts` → `yipyip-exception.filter.ts`
- `server/src/services/memories/trekPhotoCache.ts` → `yipyipPhotoCache.ts`
- `server/tests/unit/services/trekPhotoMedia.test.ts` → `yipyipPhotoMedia.test.ts`
- `plugin-sdk/src/cli/trek-plugin.ts` → `yipyip-plugin.ts`
- `plugin-sdk/examples/**/trek-plugin.json` → `yipyip-plugin.json`
- Assets: `docs/logo-yipyip-*.gif`, `docs/yipyip-icon.png`,
  `docs/yipyip-Generated-by-MCP.pdf`, `client/public/icons/yipyip-loading-*.gif`.
- No tracked file has "trek" (or "interlog") in its name.

### 4. npm scope rename + reinstall ✅
- `@trek/root|client|server|shared` → `@yipyip/*`; `trek-plugin-sdk` → `yipyip-plugin-sdk`.
- `npm install` run for root workspaces and `plugin-sdk`: `node_modules/@yipyip`
  symlinks in place, stale scope dirs removed, both lockfiles regenerated (verified
  clean of old names).

### 5. Build + test verification ✅
- **Build:** `npm run build` (shared → server → client) **passes** cleanly.
- **Shared tests:** 32 files / **136 passed**.
- **Server tests:** **4699 passed / 4699** — one pre-existing, rename-unrelated failure
  (`TRIP-SVC-015`) was diagnosed and fixed afterwards; see section 7.
- **Client tests:** **180 files / 3084 passed** (38 skipped) — all green.

### 6. Client i18n parity fix ✅
The 19 failing client tests were `tests/unit/i18n/parity.test.ts` — **pre-existing**
(verified against HEAD), not caused by the rename. The last two features (iCloud
shared-album Photos tab, "Recommended by" field on places) added 13 keys to the `en`
locale only. Fixed by adding translations for all 13 keys
(`trip.tabs.photos`, `places.formRecommendedBy*`, `places.recommendedByVia`,
`photos.emptyTitle/emptyBody/linkAlbum/linkSaved/noLinkReadonly/count/refresh/unlink/loadError`)
to all 19 supported non-en locales in `shared/src/i18n/*/{trip,places,photos}.ts`,
matching each locale's existing register (informal du/je/tú/tu; formal vous/вы/ви/vy +
Greek). Placeholders (`{source}`, `{count}`) preserved.

---

## ⚠️ Things that require action outside the code

- **GitHub URLs** `github.com/mauriceboe/TREK` were rewritten to `.../yipyip`. These only
  work if the repository is actually renamed on GitHub.
- **Brand domain** `liketrek.com` (support email, demo link) → `likeyipyip.com` — only
  valid if you own/point that domain.
- **Plugin SDK public interface** changed (`yipyip-plugin.json` manifest, `yipyip-plugin`
  CLI, `.yipyipplugin` bundles) — a breaking change for any existing third-party plugins.
- **Existing installs**: the rename migration runs on next boot; OAuth tokens, session
  cookies, and env-var names all change, so users must re-authenticate and update their
  deployment env/config (`TREK_*` → `YIPYIP_*`).

### 7. Pre-existing TRIP-SVC-015 fix ✅
`TRIP-SVC-015` (server `tripService.test.ts`) was a timezone bug in the **test factory**,
not in product code: `createTrip` in `tests/helpers/factories.ts` parsed `'YYYY-MM-DD'`
bounds as UTC midnight but stepped its day loop with local-time `setDate()`. When the
range crosses a DST fall-back in the host timezone (the test's Nov 1–3 2025 range crosses
the US fall-back in `America/Los_Angeles`), the extra hour overshoots the UTC end
boundary and the last day is silently dropped — failing locally but never on UTC CI.
Fixed by stepping with `setUTCDate()`, mirroring production `generateDays` (already
DST-immune via pure `Date.UTC` arithmetic). Verified under `America/Los_Angeles`, `UTC`,
and `Australia/Sydney`.

## Status: complete ✅

All work is committed on `main` (not pushed):

- `ded5b3bc` `feat!: rebrand TREK to yipyip` — the full rename + i18n parity fix
- `20a00335` `fix: make test factory day generation DST-safe` — the TRIP-SVC-015 fix

Final test state: **shared 136/136 · server 4699/4699 · client 3084 passed (38 skipped)**,
build green. Remaining follow-ups are the external items listed above (GitHub repo rename,
domain, third-party plugin migration).
