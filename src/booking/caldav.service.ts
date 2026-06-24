import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildVcalendar, CalEvent } from './caldav-event.util';
import { discoverCalendarUrl } from './caldav-discovery';

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
      });
      if (!res.ok) {
        this.logger.warn(`CalDAV PUT ${res.status} for ${ev.uid}`);
        return null;
      }
      this.logger.log(`CalDAV event pushed: ${ev.uid}`);
      return ev.uid;
    } catch (e) {
      this.logger.error(`CalDAV PUT failed: ${(e as Error).message}`);
      return null;
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
