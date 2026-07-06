/**
 * iCloud public shared album client.
 *
 * Apple exposes public shared albums ("iCloud.com/sharedalbum/#<token>") through
 * an undocumented but stable JSON API on the sharedstreams hosts. Two POSTs:
 *   1. .../webstream      -> photo list + per-size derivatives (checksums)
 *   2. .../webasseturls   -> short-lived signed URLs for those checksums
 * The initial host is derived from the token; if it's wrong Apple replies 330
 * with the correct host in `X-Apple-MMe-Host`, which we follow.
 *
 * NOTE: shared albums carry NO location/GPS — Apple strips EXIF on share. The
 * only per-photo temporal signal is `dateCreated`, which the Photos tab uses to
 * associate a shot with a trip day.
 */

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export interface AlbumPhoto {
  guid: string;
  caption: string;
  dateCreated: string | null;
  width: number;
  height: number;
  /** Signed, time-limited full-size image URL on Apple's CDN. */
  url: string;
  /** Signed thumbnail URL (smaller derivative) when available. */
  thumbUrl: string;
  contributor: string;
}

export interface Album {
  name: string;
  photos: AlbumPhoto[];
}

/** Extract the album token from any iCloud shared-album URL form. */
export function parseAlbumToken(input: string): string | null {
  if (!input) return null;
  const s = input.trim();
  // Bare token pasted directly.
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s;
  // https://www.icloud.com/sharedalbum/#B2e5...  (token in the fragment)
  const hash = s.match(/#([A-Za-z0-9]{10,})/);
  if (hash) return hash[1];
  // https://share.icloud.com/photos/0ABC...  (token in the path)
  const path = s.match(/icloud\.com\/(?:photos|sharedalbum)\/#?([A-Za-z0-9]{10,})/);
  if (path) return path[1];
  return null;
}

function initialHost(token: string): string {
  const prefix = token[0] === 'A' ? token.substring(1, 2) : token.substring(1, 3);
  let n = 0;
  for (const c of prefix) n = n * 62 + Math.max(0, B62.indexOf(c));
  return `p${n}-sharedstreams.icloud.com`;
}

async function streamPost(token: string, host: string, path: string, body: unknown, depth = 0): Promise<any> {
  if (depth > 3) throw new Error('iCloud redirect loop');
  // Only ever talk to Apple's sharedstreams hosts.
  if (!/^p\d+-sharedstreams\.icloud\.com$/.test(host)) throw new Error('Unexpected iCloud host');
  const res = await fetch(`https://${host}/${token}/sharedstreams/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Origin: 'https://www.icloud.com' },
    body: JSON.stringify(body),
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 330) {
    const j = await res.json();
    const next = j['X-Apple-MMe-Host'] || j['x-apple-mme-host'];
    if (!next) throw new Error('iCloud 330 without host');
    return streamPost(token, next, path, body, depth + 1);
  }
  if (res.status === 404) throw new Error('Album not found — check the link is a public shared album');
  if (!res.ok) throw new Error(`iCloud responded ${res.status}`);
  return res.json();
}

/** Build a CDN URL from a webasseturls item + locations map. */
function buildUrl(items: any, locations: any, checksum: string | undefined): string {
  if (!checksum) return '';
  const it = items?.[checksum];
  if (!it) return '';
  const loc = locations?.[it.url_location];
  const host = loc?.hosts?.[0];
  if (!host) return '';
  return `${loc.scheme || 'https'}://${host}${it.url_path}`;
}

/** Pick derivative checksums: largest for full, smallest for thumb. */
function pickDerivatives(derivatives: Record<string, { checksum: string }>): { full?: string; thumb?: string } {
  const sizes = Object.keys(derivatives).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => a - b);
  if (!sizes.length) return {};
  return {
    thumb: derivatives[String(sizes[0])]?.checksum,
    full: derivatives[String(sizes[sizes.length - 1])]?.checksum,
  };
}

/** Fetch and normalize a public iCloud shared album. */
export async function fetchAlbum(urlOrToken: string): Promise<Album> {
  const token = parseAlbumToken(urlOrToken);
  if (!token) throw new Error('Could not read an iCloud shared-album token from that link');

  const stream = await streamPost(token, initialHost(token), 'webstream', { streamCtag: null });
  const rawPhotos: any[] = Array.isArray(stream.photos) ? stream.photos : [];
  if (!rawPhotos.length) return { name: stream.streamName || 'Shared Album', photos: [] };

  const assets = await streamPost(token, initialHost(token), 'webasseturls', {
    photoGuids: rawPhotos.map(p => p.photoGuid),
  });
  const { items, locations } = assets;

  const photos: AlbumPhoto[] = rawPhotos.map(p => {
    const { full, thumb } = pickDerivatives(p.derivatives || {});
    const fullUrl = buildUrl(items, locations, full);
    return {
      guid: p.photoGuid,
      caption: p.caption || '',
      dateCreated: p.dateCreated || null,
      width: Number(p.width) || 0,
      height: Number(p.height) || 0,
      url: fullUrl,
      thumbUrl: buildUrl(items, locations, thumb) || fullUrl,
      contributor: p.contributorFullName || '',
    };
  }).filter(p => p.url);

  // Newest first.
  photos.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
  return { name: stream.streamName || 'Shared Album', photos };
}
