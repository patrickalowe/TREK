# Plugins

Plugins let anyone extend a self-hosted TREK instance with new features — a
dashboard widget, a full page, a photo/calendar integration — **without touching
TREK's source code**. They are developed by third parties, distributed from a
public registry, and installed at the instance owner's discretion.

> [!IMPORTANT]
> **Plugins run arbitrary code, isolated but real.** Every plugin runs in its own
> sandboxed child process with only the permissions you approve. TREK does not
> maintain, audit, or take responsibility for community plugins. Grant a plugin
> only the access you'd trust it to have with your data, and prefer plugins
> marked **Reviewed**.

## Enabling plugins

The plugin runtime is **off by default**. To turn it on, set the environment
variable on your instance and restart:

```yaml
environment:
  - TREK_PLUGINS_ENABLED=true
```

When it's off, the **Admin → Plugins** tab shows a "disabled by server
configuration" banner and nothing runs.

## The isolation model — what a plugin can and can't do

Each active plugin runs as a **separate OS process** with a deliberately empty
environment:

- It has **no** access to `JWT_SECRET`, the database connection, or any TREK
  secret — those are simply not in its process.
- It **cannot** open `trek.db`. Its own data lives in a separate SQLite file it
  reaches only through TREK.
- It talks to TREK exclusively over an internal RPC channel, and TREK only
  answers the capabilities the plugin's manifest **declares and you approve**.
  An ungranted call is refused, not merely ignored.
- If a plugin crashes, hangs, or runs out of memory, only *its* process dies —
  TREK keeps running and restarts or disables it.

This means the permission list you approve at activation is a **real boundary**,
not a label. See [[Plugin Permissions|Plugin-Permissions]] for exactly what each
permission grants.

## Installing a plugin

Two ways, both from **Admin → Plugins**:

1. **From the registry.** Click *Browse plugins*, pick one, and *Install*. TREK
   downloads the pinned version from GitHub, verifies its SHA-256 against the
   registry, safely unpacks it, and registers it — **inactive**. Nothing runs
   yet.
2. **From disk.** Drop a plugin directory into the `/plugins` volume and click
   *Rescan* (or restart). TREK discovers it and registers it inactive.

## Activating a plugin

Activation is a separate, deliberate step. You review the plugin's requested
permissions and outbound hosts on a consent screen, then click **Activate** —
which grants those permissions and spawns the isolated process. A page plugin
then appears in the top navigation; a widget appears on the dashboard.

## Managing plugins

- **Disable** stops the process immediately; the plugin keeps its data.
- **Uninstall** removes the code and lets you keep or delete the plugin's data.
- **View errors** shows the plugin's own error log (crashes, failed requests).

## Building your own

See [[Plugin Development|Plugin-Development]] and the `trek-plugin-sdk` package.

## Kill switch

Set `TREK_PLUGINS_ENABLED=false` to disable the entire subsystem instantly —
installed plugins stay on disk, deactivated and harmless.
