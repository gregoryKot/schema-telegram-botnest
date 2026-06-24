import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SessionType } from '@prisma/client';

export interface MeetingTarget {
  id: number;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  clientName: string;
  clientContact: string;
}

/**
 * Gives every client a PERSONAL video-call link reused across all their sessions.
 *
 * The client is identified by a SHA-256 hash of their normalised contact, so a
 * returning client who enters the same contact gets the same link. The link is
 * created once and stored in ClientMeeting.
 *
 * Provider (first match wins):
 *   1. Zoom S2S OAuth — a per-client recurring meeting (type 3, no fixed time).
 *      Needs ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET.
 *   2. MEETING_STATIC_URL — one shared permanent room (degenerate fallback).
 *   3. Jitsi — a per-client deterministic meet.jit.si room (no config, works RU).
 */
@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);
  private readonly staticUrl: string;
  private readonly zoomAccountId: string;
  private readonly zoomClientId: string;
  private readonly zoomClientSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.staticUrl = (config.get<string>('MEETING_STATIC_URL') ?? '').trim();
    this.zoomAccountId = config.get<string>('ZOOM_ACCOUNT_ID') ?? '';
    this.zoomClientId = config.get<string>('ZOOM_CLIENT_ID') ?? '';
    this.zoomClientSecret = config.get<string>('ZOOM_CLIENT_SECRET') ?? '';
  }

  private get zoomEnabled(): boolean {
    return Boolean(this.zoomAccountId && this.zoomClientId && this.zoomClientSecret);
  }

  /** True if this contact already has a personal meeting (i.e. a returning client). */
  async hasMeetingForContact(contact: string): Promise<boolean> {
    const found = await this.prisma.clientMeeting.findUnique({ where: { clientKey: clientKey(contact) } });
    return found !== null;
  }

  /** Returns this client's personal meeting URL, creating it on first session. */
  async createMeeting(b: MeetingTarget): Promise<string> {
    if (this.staticUrl) return this.staticUrl;

    const key = clientKey(b.clientContact);
    const existing = await this.prisma.clientMeeting.findUnique({ where: { clientKey: key } });
    if (existing) {
      this.logger.log(`Reusing personal meeting for client ${key.slice(0, 8)}…`);
      return existing.meetingUrl;
    }

    const zoom = this.zoomEnabled ? await this.createZoom(b).catch((e) => {
      this.logger.error(`Zoom create failed, falling back to Jitsi: ${(e as Error).message}`);
      return null;
    }) : null;

    const meetingUrl = zoom?.url ?? jitsiRoom(key);
    await this.prisma.clientMeeting.create({
      data: { clientKey: key, meetingUrl, zoomMeetingId: zoom?.id ?? null },
    });
    this.logger.log(`Created personal meeting for client ${key.slice(0, 8)}… (${zoom ? 'zoom' : 'jitsi'})`);
    return meetingUrl;
  }

  /** Create a per-client recurring Zoom meeting (no fixed time → one stable link). */
  private async createZoom(b: MeetingTarget): Promise<{ url: string; id: string } | null> {
    const token = await this.zoomToken();
    if (!token) return null;
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: `Сессии — ${b.clientName}`,
        type: 3, // recurring meeting with no fixed time → permanent join_url
        timezone: 'Europe/Moscow',
        settings: { join_before_host: true, waiting_room: true },
      }),
    });
    if (!res.ok) {
      this.logger.warn(`Zoom API ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { join_url?: string; id?: number };
    if (!data.join_url) return null;
    return { url: data.join_url, id: String(data.id ?? '') };
  }

  private async zoomToken(): Promise<string | null> {
    const basic = Buffer.from(`${this.zoomClientId}:${this.zoomClientSecret}`).toString('base64');
    const res = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.zoomAccountId}`,
      { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Normalise a contact (telegram/phone) so the same person maps to one key. */
function clientKey(contact: string): string {
  const norm = contact.trim().toLowerCase().replace(/^@/, '').replace(/[\s()+-]/g, '');
  return createHash('sha256').update(norm).digest('hex');
}

function jitsiRoom(key: string): string {
  return `https://meet.jit.si/schemehappens-${key.slice(0, 12)}`;
}
