# Plugin Permissions

A plugin declares the permissions it needs in `trek-plugin.json`. At activation
the admin sees the list and approves it — and because plugins run in an isolated
process, **an unapproved capability is physically unreachable**, not just
disallowed.

## Reference

| Permission | Grants | Notes |
|---|---|---|
| `db:own` | Read/write the plugin's **own** SQLite file via `ctx.db` | A separate file per plugin — never `trek.db`. `ATTACH`/`PRAGMA` are refused. |
| `db:read:trips` | Read-only trip data via `ctx.trips` (`getById`, `getPlaces`, `getReservations`) | Every call is **membership-checked** against the acting user — a plugin can't read a trip that user can't see. |
| `db:read:users` | Read-only public profile via `ctx.users.getById` | Returns id, username, display name, avatar only — **never** password hashes, tokens, or secrets. |
| `ws:broadcast:trip` | Push a real-time event to a trip room via `ctx.ws.broadcastToTrip` | Event types are force-namespaced `plugin:<id>:<event>` — a plugin can't forge a core event. |
| `ws:broadcast:user` | Push a real-time event to a user's connections | Same namespacing. |
| `hook:photo-provider` | Register as a photo provider in Memories | Implement the `PhotoProvider` interface. |
| `hook:calendar-source` | Register as a calendar source | Implement the `CalendarSource` interface. |
| `http:outbound` / `http:outbound:<host>` | Make outbound network requests | **Requires** a non-empty `egress[]` list of hosts. The plugin's client CSP and the runtime egress guard are limited to those hosts. |

## Declaring them

```jsonc
{
  "permissions": ["db:own", "db:read:trips", "http:outbound:api.example.com"],
  "egress": ["api.example.com"]     // required whenever http:outbound is declared
}
```

Rules the manifest validator enforces:

- Only the permissions above are accepted; an unknown string fails validation.
- `http:outbound` (with or without a host) requires a non-empty `egress[]`.
- `egress[]` may not contain a bare `*`.

## What is NOT covered

Isolation bounds *what* a plugin can touch, not its intent within a grant. A
plugin you allow to read trip data **and** reach `api.example.com` could send
that trip data there. That is the point of the consent screen — grant only what
you'd trust the plugin to do with your data. Prefer **Reviewed** plugins and
authors you trust.
