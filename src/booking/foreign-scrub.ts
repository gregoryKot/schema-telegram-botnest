import { BookingStatus, SessionType } from '@prisma/client';
import { OwnerCalEvent, ownerEventFor } from './caldav-owner-event';
import type { CalDeleteResult } from './caldav.service';
import type { ZoomRoomResult } from './zoom-room';

// Разовая чистка зарубежных баз (запрос РКН №08-1063539, ч. 5 ст. 18 152-ФЗ):
// события iCloud и комнаты Zoom, созданные до обезличивания, несут имя,
// контакт и текст обращения. Событие перезаписывается обезличенным по тому же
// UID, ненужное удаляется, комната Zoom переименовывается. Каждый шаг
// идемпотентен: повторный запуск безопасен и добивает пропущенное.

export interface ScrubBooking {
  id: number;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  status: BookingStatus;
  calDavUid: string;
}

export interface ScrubPorts {
  putEvent(ev: OwnerCalEvent): Promise<string | null>;
  removeEvent(uid: string): Promise<CalDeleteResult | undefined>;
  readZoomTopic(
    id: string,
  ): Promise<{ result: ZoomRoomResult; topic?: string }>;
  renameZoomRoom(id: string): Promise<ZoomRoomResult>;
  pause(): Promise<void>;
}

export interface ScrubReport {
  live: boolean;
  cal: { rewritten: number; deleted: number; missing: number; failed: number };
  zoom: {
    renamed: number;
    clean: number;
    missing: number;
    failed: number;
    limited: boolean;
  };
}

/**
 * Отменённая бронь (событие уже снимали) и бронь старше срока хранения —
 * удалить: PUT воскресил бы снятое событие. Остальное — перезаписать.
 */
export function calActionFor(b: ScrubBooking, cutoff: Date): 'put' | 'delete' {
  if (b.status === BookingStatus.CANCELLED) return 'delete';
  return b.startsAt < cutoff ? 'delete' : 'put';
}

async function scrubCalendar(
  bookings: ScrubBooking[],
  cutoff: Date,
  live: boolean,
  ports: ScrubPorts,
  cal: ScrubReport['cal'],
): Promise<void> {
  for (const b of bookings) {
    const action = calActionFor(b, cutoff);
    if (!live) {
      if (action === 'put') cal.rewritten++;
      else cal.deleted++;
      continue;
    }
    if (action === 'put') {
      // UID — записанный в брони: по нему лежит старое событие.
      const ok = await ports.putEvent({
        ...ownerEventFor(b),
        uid: b.calDavUid,
      });
      if (ok) cal.rewritten++;
      else cal.failed++;
    } else {
      const r = await ports.removeEvent(b.calDavUid);
      if (r === 'deleted') cal.deleted++;
      else if (r === 'missing') cal.missing++;
      else cal.failed++;
    }
    await ports.pause();
  }
}

async function scrubZoom(
  ids: string[],
  topic: string,
  live: boolean,
  ports: ScrubPorts,
  zoom: ScrubReport['zoom'],
): Promise<void> {
  for (const id of ids) {
    const read = await ports.readZoomTopic(id);
    await ports.pause();
    let r: ZoomRoomResult = read.result;
    if (r === 'ok' && read.topic === topic) {
      zoom.clean++;
      continue;
    }
    if (r === 'ok') {
      if (!live) {
        zoom.renamed++;
        continue;
      }
      r = await ports.renameZoomRoom(id);
      await ports.pause();
    }
    if (r === 'ok') zoom.renamed++;
    else if (r === 'missing') zoom.missing++;
    else if (r === 'failed') zoom.failed++;
    else {
      // Лимит: остальные комнаты добьёт повторный запуск (через сутки).
      zoom.limited = true;
      zoom.failed += ids.length - ids.indexOf(id);
      return;
    }
  }
}

export async function runForeignScrub(input: {
  bookings: ScrubBooking[];
  zoomIds: string[];
  zoomTopic: string;
  cutoff: Date;
  live: boolean;
  ports: ScrubPorts;
}): Promise<ScrubReport> {
  const report: ScrubReport = {
    live: input.live,
    cal: { rewritten: 0, deleted: 0, missing: 0, failed: 0 },
    zoom: { renamed: 0, clean: 0, missing: 0, failed: 0, limited: false },
  };
  const { live, ports, cutoff } = input;
  await scrubCalendar(input.bookings, cutoff, live, ports, report.cal);
  const ids = [...new Set(input.zoomIds)];
  await scrubZoom(ids, input.zoomTopic, live, ports, report.zoom);
  return report;
}

/** Отчёт владельцу в Telegram. Без обращения к читателю: формы ты/вы не нужны. */
export function formatScrubReport(
  r: ScrubReport,
  off: { cal: boolean; zoom: boolean },
): string {
  const { cal, zoom } = r;
  const head = r.live
    ? '🧹 Чистка iCloud и Zoom — готово'
    : '🔎 Сухой прогон чистки iCloud и Zoom (ничего не менялось)';
  const verb = r.live ? '' : 'будет ';
  const lines = [
    head,
    '',
    off.cal
      ? 'iCloud: не настроен — пропущен'
      : `iCloud: ${verb}перезаписано ${cal.rewritten}, ${verb}удалено ${cal.deleted}, ` +
        `уже не было ${cal.missing}, ошибок ${cal.failed}`,
    off.zoom
      ? 'Zoom: не настроен — пропущен'
      : `Zoom: ${verb}переименовано ${zoom.renamed}, уже без имени ${zoom.clean}, ` +
        `комнаты нет ${zoom.missing}, ошибок ${zoom.failed}`,
  ];
  if (zoom.limited)
    lines.push(
      'Zoom упёрся в лимит запросов — повтор той же командой через сутки.',
    );
  if (!r.live) lines.push('', 'Боевой прогон: /scrub_foreign go');
  else if (cal.failed || zoom.failed)
    lines.push('', 'Повтор безопасен: /scrub_foreign go добьёт ошибки.');
  return lines.join('\n');
}
