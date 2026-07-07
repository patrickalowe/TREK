# Map Settings

The Map tab (Settings → Map) controls which map engine and tile source yipyip uses in the Trip Planner and Journey maps. Changes take effect after clicking **Save map settings**.

> **Note:** The Atlas view always uses Leaflet regardless of this setting.

<!-- TODO: screenshot: map settings panel with provider selection -->

![Map Settings](assets/UsrSettingsMap.png)

## Map provider

Choose the rendering engine:

| Provider | Description |
|----------|-------------|
| **Leaflet** | Classic 2D renderer. Works with any raster tile URL. |
| **MapLibre GL** | Free vector tiles from [OpenFreeMap](https://openfreemap.org) with 3D building support. No token or account needed. |
| **Mapbox GL** *(Experimental)* | Vector tiles with 3D buildings and terrain support. Requires a Mapbox access token. |

## MapLibre GL — free 3D

MapLibre GL renders OpenFreeMap vector styles (Liberty, Bright, Positron) at no cost and with no API key. The **3D Buildings & Terrain** toggle applies here too: the camera tilts to 45° and real building extrusions are drawn from the OpenMapTiles building layer. Terrain elevation is not available on this provider (it is Mapbox-satellite only — see below).

## Leaflet — tile source

When Leaflet is selected, pick a preset or enter a custom tile URL.

**Built-in presets:**

| Name | URL |
|------|-----|
| OpenStreetMap | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| OpenStreetMap DE | `https://tile.openstreetmap.de/{z}/{x}/{y}.png` |
| CartoDB Light | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` |
| CartoDB Dark | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` |
| Stadia Smooth | `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png` |

You can also type any XYZ tile URL directly into the text field.

> **Admin:** The admin can set a default map tile URL for all new users via the **User Defaults** tab in the Admin Panel. See [Admin-Panel-Overview](Admin-Panel-Overview).

## Mapbox GL — access token and style

Enter your **public token** (`pk.*`) from [mapbox.com → Access tokens](https://console.mapbox.com/account/access-tokens/).

Required scopes are:
- STYLES:TILES
- STYLES:READ
- FONTS:READ
- DATASETS:READ
- VISION:READ

If Mapbox GL is selected but no token is saved, the map area shows an empty state with a prompt to configure the token under Settings → Map → Mapbox GL.

**Built-in style presets:**

| Style | Tags |
|-------|------|
| Mapbox Standard | 3D, Apple-like |
| Standard Satellite | 3D, Satellite |
| Streets | 3D, Classic |
| Outdoors | 3D, Terrain |
| Light | 3D, Minimal |
| Dark | 3D, Dark |
| Satellite | 3D, Satellite |
| Satellite Streets | 3D, Satellite |
| Navigation Day | 3D, Apple-like |
| Navigation Night | 3D, Dark |

You can also enter a custom `mapbox://styles/USER/ID` URL directly.

### 3D Buildings & Terrain

Enables pitch and building extrusions on all styles. Terrain elevation (DEM-based height) is additionally applied on satellite styles (`Satellite` and `Satellite Streets`). On non-satellite styles only building extrusions are added; terrain is intentionally omitted on those styles because the elevation data would cause route lines to visually drift away from the HTML place markers.

### High Quality Mode *(Experimental)*

Enables antialiasing and globe projection for sharper edges. May impact performance on lower-end devices.

## Default map center

Set the default latitude, longitude, and zoom level for the map. You can also click on the map preview to move the center pin.

## See also

- [Map-Features](Map-Features)
- [Admin-Panel-Overview](Admin-Panel-Overview)
- [User-Settings](User-Settings)
