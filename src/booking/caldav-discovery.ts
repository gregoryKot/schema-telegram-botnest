// iCloud CalDAV auto-discovery (RFC 6764/4791): principal → calendar-home-set
// → calendars at Depth 1 that support VEVENT. Best-effort; [] on any gap —
// caller falls back to the manual APPLE_CALDAV_URL.
import { Logger } from '@nestjs/common';
import { classifyResponse } from './caldav-resourcetype';
const logger = new Logger('CalDavDiscovery');
const BOOTSTRAP = 'https://caldav.icloud.com';

async function propfind(
  url: string,
  auth: string,
  body: string,
  depth = '0',
): Promise<string> {
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

/** Contents between <prop>...</prop> in xml, any namespace prefix. */
const block = (xml: string, prop: string): string =>
  xml.match(
    new RegExp(`<[^>]*${prop}[^>]*>([\\s\\S]*?)</[^>]*${prop}\\s*>`, 'i'),
  )?.[1] ?? '';

/** href *inside* a named property element (not the outer response href). */
const innerHref = (xml: string, prop: string): string | null =>
  block(xml, prop)
    .match(/<[^>]*href[^>]*>\s*([^<]+?)\s*</i)?.[1]
    ?.trim() ?? null;

const abs = (origin: string, pathOrUrl: string): string =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : origin + pathOrUrl;

export interface CalendarRef {
  url: string;
  name: string;
}

/** Enumerate every VEVENT-capable calendar collection for the account. */
export async function listCalendars(auth: string): Promise<CalendarRef[]> {
  // 1. principal
  const principalXml = await propfind(
    `${BOOTSTRAP}/`,
    auth,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`,
  );
  const principalPath = innerHref(principalXml, 'current-user-principal');
  if (!principalPath) return [];
  const principalUrl = abs(BOOTSTRAP, principalPath);

  // 2. calendar-home-set
  const homeXml = await propfind(
    principalUrl,
    auth,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>`,
  );
  const homeHref = innerHref(homeXml, 'calendar-home-set');
  if (!homeHref) return [];
  const homeUrl = abs(new URL(principalUrl).origin, homeHref).replace(
    /\/?$/,
    '/',
  );
  const homeOrigin = new URL(homeUrl).origin;

  // 3. list every calendar that supports VEVENT
  const listXml = await propfind(
    homeUrl,
    auth,
    `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>`,
    '1',
  );

  const responses = listXml.split(/<[^>]*response[\s>]/i).slice(1);
  const out: CalendarRef[] = [];
  // Счётчики для диагностики (инцидент 2026-09-16: пустой список молчал —
  // не было видно, сколько ответов пришло и на каком шаге фильтра всё ушло).
  let notCalendar = 0;
  let noVevent = 0;
  let skipped = 0;
  for (const r of responses) {
    const c = classifyResponse(r, homeUrl, homeOrigin);
    if (c.calendar) out.push(c.calendar);
    else if (c.skip === 'not-calendar') notCalendar++;
    else if (c.skip === 'no-vevent') noVevent++;
    else skipped++;
  }
  logger.log(
    `discovery: ${responses.length} response(s), ${skipped} root/system, ` +
      `${notCalendar} without <calendar/>, ${noVevent} without VEVENT, ` +
      `${out.length} accepted`,
  );
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
    const match = cals.find(
      (c) => c.name.toLowerCase() === preferredName.toLowerCase(),
    );
    if (match) return match.url;
  }
  return cals[0].url; // first VEVENT calendar = default
}
