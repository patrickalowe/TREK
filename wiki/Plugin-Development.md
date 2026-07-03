# Plugin Development

Build a plugin with the `trek-plugin-sdk` package. A plugin is a directory with a
manifest, a built server entry, and (for page/widget plugins) a client bundle.

## Scaffold

```bash
npx create-trek-plugin my-plugin --type integration|page|widget
cd my-plugin
```

This emits:

```
my-plugin/
  trek-plugin.json      # manifest
  server/index.js       # your plugin code (built, plain JS)
  client/index.html     # page/widget iframe (page/widget only)
  README.md             # fill this in — the registry requires it
```

## The three plugin types

- **integration** — extends an existing feature (photo provider, calendar source,
  notification target). No UI of its own.
- **page** — adds a nav entry that opens a full-page sandboxed iframe.
- **widget** — adds a card to the dashboard.

## Writing the server

Your `server/index.js` exports a `definePlugin(...)` object. Everything reaches
TREK through the `ctx` argument — there is no other way out of the sandbox.

```js
const { definePlugin } = require('trek-plugin-sdk')

module.exports = definePlugin({
  // Runs once when the plugin is activated.
  async onLoad(ctx) {
    await ctx.db.migrate('001_init', 'CREATE TABLE cache (k TEXT PRIMARY KEY, v TEXT)')
    ctx.log.info('loaded')
  },

  // HTTP routes, mounted at /api/plugins/<id><path>.
  routes: [
    { method: 'GET', path: '/status', auth: true, async handler(req, ctx) {
      const rows = await ctx.db.query('SELECT COUNT(*) AS n FROM cache')
      return { status: 200, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ n: rows[0].n, user: req.user?.username }) }
    }},
  ],

  // Scheduled jobs — TREK owns the cron and calls your handler.
  jobs: [
    { id: 'refresh', schedule: '*/15 * * * *', async handler(ctx) { /* … */ } },
  ],
})
```

### The `ctx` object

| Area | Methods | Requires |
|---|---|---|
| `ctx.db` | `query` / `exec` / `migrate` against your **own** SQLite file | `db:own` |
| `ctx.trips` | `getById` / `getPlaces` / `getReservations` (membership-checked) | `db:read:trips` |
| `ctx.users` | `getById` (public profile only — never secrets) | `db:read:users` |
| `ctx.ws` | `broadcastToTrip` / `broadcastToUser` (events namespaced `plugin:<id>:…`) | `ws:broadcast:*` |
| `ctx.config` | your instance settings (secrets delivered decrypted) | — |
| `ctx.log` | `info` / `warn` / `error` → your error log | — |

Calling a capability your manifest didn't declare throws `PERMISSION_DENIED`.

### Route auth

Routes are authenticated by default (`req.user` is the logged-in user). Set
`auth: false` for OAuth callbacks or webhooks that can't carry a session.

## Writing the client (page / widget)

The iframe is sandboxed at an **opaque origin** — it can't read cookies or the
parent page. It talks to TREK only via `postMessage`:

```js
window.parent.postMessage({ type: 'trek:ready' }, '*')

window.addEventListener('message', (e) => {
  const m = e.data
  if (m.type === 'trek:context') { /* m.theme, m.locale, m.tripId, m.userId */ }
  if (m.type === 'trek:response' && m.requestId === '1') { /* … */ }
})

// Call one of your own server routes (TREK proxies it with the user's session):
window.parent.postMessage({ type: 'trek:invoke', requestId: '1', sub: '/status', method: 'GET' }, '*')
```

Bridge messages you can send: `trek:ready`, `trek:context:request`,
`trek:navigate {to}`, `trek:notify {level,message}`, `trek:resize {height}`,
`trek:invoke {requestId,sub,method,body}`.

## Settings

Declare settings in the manifest; TREK renders the form (you write no settings
UI). `scope: "instance"` settings are set once by the admin; `scope: "user"`
settings are per-user. `secret: true` fields are stored encrypted and delivered
to your plugin decrypted through `ctx.config` (instance) — never to the iframe.

## Testing without a running TREK

`createMockHost` gives you a `ctx` that enforces the **same** permission model:

```js
import { createMockHost } from 'trek-plugin-sdk/testing'

const { ctx, broadcasts } = createMockHost({
  grants: ['db:read:trips'],
  trips: { 1: { members: [42], data: { id: 1, name: 'Japan' } } },
})
await plugin.onLoad(ctx)                              // run your load logic
await expect(ctx.trips.getById(1, 99)).rejects…       // proves your access checks
```

## Rules

- **No native modules** (`.node`, `binding.gyp`, prebuilds) — they're rejected.
- **Vendor your dependencies** — TREK never runs `npm install` on a plugin.
- **Ship built JS** in `server/index.js` and pre-built static files in `client/`.
- Declare every outbound host in `egress[]` when you use `http:outbound`.

## Validate before publishing

```bash
npx trek-plugin validate .
```

Runs the same checks the registry CI runs. See [[Publishing a Plugin|Plugin-Publishing]].
