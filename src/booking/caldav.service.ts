import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildVcalendar, CalEvent } from './caldav-event.util';
import { discoverCalendarUrl } from './caldav-discovery';
import { busyQueryXml, parseBusy, Interval } from './caldav-busy';

/**
 * One-way push of confirmed bookings into the therapist's Apple Calendar via CalDAV.
 *
 * Config (env):
 *   APPLE_ID            — Apple ID e-mail            (required)
 *   APPLE_APP_PASSWORD  — app-specific password      (required)
 *   APPLE_CALDAV_URL    — optional: full calendar collection URL. If omitted,
 *                         it's auto-discovered from the Apple ID on first use.
 *   APPLE_CALENDAR_NAME — optional: which calendar to use (display name).
 *                         Defaults to the first calendar that supports events.
 *
 * If credentials are absent, every method is a silent no-op so the rest of the
 * booking flow keeps working without iCloud in dev.
 */
@Injectable()
export class CalDavService {
  private readonly logger = new Logger(CalDavService.name);
  private readonly configuredBase: string;
  private readonly calendarName: string;
  private readonly auth: string;
  private resolvedBase: string | null = null;
  private discovery: Promise<string | null> | null = null;
  private busyCache: { key: string; val: Interval[]; exp: number } | null = null;

  constructor(config: ConfigService) {
    this.configuredBase = (config.get<string>('APPLE_CALDAV_URL') ?? '').replace(/\/?$/, '/').replace(/^\/$/, '');
    this.calendarName = config.get<string>('APPLE_CALENDAR_NAME') ?? '';
    const id = config.get<string>('APPLE_ID') ?? '';
    const pass = config.get<string>('APPLE_APP_PASSWORD') ?? '';
    this.auth = id && pass ? 'Basic ' + Buffer.from(`${id}:${pass}`).toString('base64') : '';
  }

  get enabled(): boolean {
    return Boolean(this.auth);
  }

  /** Resolve the target calendar URL: explicit env first, else discover once and cache. */
  private async getBase(): Promise<string | null> {
    if (this.configuredBase) return this.configuredBase;
    if (this.resolvedBase) return this.resolvedBase;
    if (!this.discovery) {
      this.discovery = discoverCalendarUrl(this.auth, this.calendarName)
        .then((url) => {
          if (url) { this.resolvedBase = url; this.logger.log(`CalDAV calendar discovered: ${url}`); }
          else this.logger.warn('CalDAV auto-discovery found no calendar — set APPLE_CALDAV_URL manually');
          return url;
        })
        .catch((e) => { this.logger.error(`CalDAV discovery failed: ${(e as Error).message}`); return null; });
    }
    return this.discovery;
  }

  /** Create or update the calendar event for a booking. Returns the iCloud UID, or null. */
  async pushEvent(ev: CalEvent): Promise<string | null> {
    if (!this.enabled) return null;
    const base = await this.getBase();
    if (!base) return null;
    const url = `${base}${ev.uid}.ics`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: this.auth,
          'Content-Type': 'text/calendar; charset=utf-8',
        },
        body: buildVcalendar([ev]),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`CalDAV PUT ${res.status} to ${url}: ${body.slice(0, 300)}`);
        return null;
      }
      this.logger.log(`CalDAV event pushed: ${ev.uid}`);
      return ev.uid;
    } catch (e) {
      this.logger.error(`CalDAV PUT failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Busy intervals from the therapist's calendar in [from, to], so the slot
   * engine can hide times that are already occupied by real calendar events.
   * Cached 60s. Fail-open: returns [] on any problem (slots still show).
   */
  async getBusyTimes(from: Date, to: Date): Promise<Interval[]> {
    if (!this.enabled) return [];
    const key = `${from.getTime()}_${to.getTime()}`;
    if (this.busyCache && this.busyCache.key === key && Date.now() < this.busyCache.exp) {
      return this.busyCache.val;
    }
    const base = await this.getBase();
    if (!base) return [];
    try {
      const res = await fetch(base, {
        method: 'REPORT',
        headers: { Authorization: this.auth, 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
        body: busyQueryXml(from, to),
        signal: AbortSignal.timeout(7_000),
      });
      if (res.status !== 207 && !res.ok) {
        this.logger.warn(`CalDAV busy REPORT ${res.status}`);
        return [];
      }
      const val = parseBusy(await res.text());
      this.busyCache = { key, val, exp: Date.now() + 60_000 };
      return val;
    } catch (e) {
      this.logger.warn(`CalDAV busy read failed: ${(e as Error).message}`);
      return [];
    }
  }

  /** Delete the calendar event for a cancelled booking. */
  async removeEvent(uid: string): Promise<void> {
    if (!this.enabled || !uid) return;
    const base = await this.getBase();
    if (!base) return;
    const url = `${base}${uid}.ics`;
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: this.auth },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && res.status !== 404) {
        this.logger.warn(`CalDAV DELETE ${res.status} for ${uid}`);
      } else {
        this.logger.log(`CalDAV event removed: ${uid}`);
      }
    } catch (e) {
      this.logger.error(`CalDAV DELETE failed: ${(e as Error).message}`);
    }
  }
}
