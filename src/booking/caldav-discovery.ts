// iCloud CalDAV auto-discovery: given just Apple ID + app-specific password,
// find the URL of a writable calendar collection. Saves the user from hunting
// down the cryptic https://pXX-caldav.icloud.com/<id>/calendars/<name>/ URL.
//
// Flow (RFC 6764 / 4791):
//   1. PROPFIND bootstrap → current-user-principal
//   2. PROPFIND principal → calendar-home-set (absolute, on the pXX host)
//   3. PROPFIND home (Depth 1) → pick a calendar that supports VEVENT
//
// Best-effort and namespace-agnostic. Returns null if anything fails; the
// caller then falls back to the manual APPLE_CALDAV_URL.

const BOOTSTRAP = 'https://caldav.icloud.com';

async function propfind(url: string, auth: string, body: string, depth = '0'): Promise<string> {
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: depth,
    },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status !== 207 && !res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PROPFIND ${res.status} ${url} — ${body.slice(0, 200)}`);
  }
  return res.text();
}

/** href found *inside* a named property element (not the outer response href). */
function innerHref(xml: string, prop: string): string | null {
  const block = xml.match(new RegExp(`<[^>]*${prop}[^>]*>([\\s\\S]*?)</[^>]*${prop}\\s*>`, 'i'));
  if (!block) return null;
  const href = block[1].match(/<[^>]*href[^>]*>\s*([^<]+?)\s*</i);
  return href ? href[1].trim() : null;
}

function abs(origin: string, pathOrUrl: string): string {
  return /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : origin + pathOrUrl;
}

export interface CalendarRef { url: string; name: string; }

/** Enumerate every VEVENT-capable calendar collection for the account. */
export async function listCalendars(auth: string): Promise<CalendarRef[]> {
  // 1. principal
  const principalXml = await propfind(
    `${BOOTSTRAP}/`, auth,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
  );
  const principalPath = innerHref(principalXml, 'current-user-principal');
  if (!principalPath) return [];
  const principalUrl = abs(BOOTSTRAP, principalPath);

  // 2. calendar-home-set
  const homeXml = await propfind(
    principalUrl, auth,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
  );
  const homeHref = innerHref(homeXml, 'calendar-home-set');
  if (!homeHref) return [];
  const homeUrl = abs(new URL(principalUrl).origin, homeHref).replace(/\/?$/, '/');
  const homeOrigin = new URL(homeUrl).origin;

  // 3. list every calendar that supports VEVENT
  const listXml = await propfind(
    homeUrl, auth,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>`,
    '1',
  );

  const responses = listXml.split(/<[^>]*response[\s>]/i).slice(1);
  const out: CalendarRef[] = [];
  for (const r of responses) {
    const href = (r.match(/<[^>]*href[^>]*>\s*([^<]+?)\s*</i)?.[1] ?? '').trim();
    if (!href || !/VEVENT/i.test(r)) continue;
    if (/inbox|outbox|notification/i.test(href)) continue;
    const url = abs(homeOrigin, href).replace(/\/?$/, '/');
    const name = (r.match(/<[^>]*displayname[^>]*>\s*([^<]*?)\s*</i)?.[1] ?? '').trim();
    out.push({ url, name });
  }
  return out;
}

/** Pick the single calendar to write booking events into. */
export async function discoverCalendarUrl(
  auth: string,
  preferredName = '',
): Promise<string | null> {
  const cals = await listCalendars(auth);
  if (!cals.length) return null;
  if (preferredName) {
    const match = cals.find((c) => c.name.toLowerCase() === preferredName.toLowerCase());
    if (match) return match.url;
  }
  return cals[0].url; // first VEVENT calendar = default
}
