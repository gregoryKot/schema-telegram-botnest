import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildVcalendar, CalEvent } from './caldav-event.util';

/**
 * One-way push of confirmed bookings into the therapist's Apple Calendar via CalDAV.
 *
 * Config (env):
 *   APPLE_CALDAV_URL   — full URL of the target calendar collection, e.g.
 *                        https://pXX-caldav.icloud.com/123456/calendars/work/
 *   APPLE_ID           — Apple ID e-mail
 *   APPLE_APP_PASSWORD — app-specific password (appleid.apple.com → Sign-In & Security)
 *
 * If unconfigured, every method is a silent no-op so the rest of the booking
 * flow keeps working without iCloud credentials in dev.
 */
@Injectable()
export class CalDavService {
  private readonly logger = new Logger(CalDavService.name);
  private readonly base: string;
  private readonly auth: string;

  constructor(config: ConfigService) {
    this.base = (config.get<string>('APPLE_CALDAV_URL') ?? '').replace(/\/?$/, '/');
    const id = config.get<string>('APPLE_ID') ?? '';
    const pass = config.get<string>('APPLE_APP_PASSWORD') ?? '';
    this.auth = id && pass ? 'Basic ' + Buffer.from(`${id}:${pass}`).toString('base64') : '';
  }

  get enabled(): boolean {
    return Boolean(this.base && this.auth);
  }

  /** Create or update the calendar event for a booking. Returns the iCloud UID, or null. */
  async pushEvent(ev: CalEvent): Promise<string | null> {
    if (!this.enabled) return null;
    const url = `${this.base}${ev.uid}.ics`;
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
    const url = `${this.base}${uid}.ics`;
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
