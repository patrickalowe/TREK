# Trip Countdown

> A dashboard widget that counts down the days to your next trip.

![Trip Countdown widget on the dashboard](./docs/screenshot.png)

## What it does

Trip Countdown adds a small dashboard widget showing how many days remain until
your upcoming trip starts. When a trip is under way it shows "in progress"
instead. It's the reference plugin for the TREK plugin system — a minimal but
complete widget that reads trip data through the sandbox and renders it in an
isolated iframe.

## Screenshots

![The widget counting down to a trip](./docs/screenshot.png)

## Permissions

| Permission | Why this plugin needs it |
|---|---|
| `db:read:trips` | To read the current trip's start date so it can compute the countdown. The read is membership-checked by TREK, so the widget only ever sees a trip you already have access to. |

It requests **no** network access and stores **no** data of its own.

## Setup

None. Enable plugins on your instance (`TREK_PLUGINS_ENABLED=true`), install and
activate Trip Countdown, and the widget appears on your dashboard.

## Building

The widget ships plain JS/HTML — no build step. `server/index.js` is the plugin
entry; `client/index.html` is the widget iframe.

## License

MIT — see the TREK repository.
