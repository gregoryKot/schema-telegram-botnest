import { BookingStatus, SessionType } from '@prisma/client';
import { OwnerCalEvent, ownerEventFor } from './caldav-owner-event';
import type { CalDeleteResult } from './caldav.service';

// Перевыпуск событий iCloud со старым UID `booking-<id>@schemehappens.ru`:
// номер брони виден в UID и адресе события в зарубежной базе (запрос РКН
// №08-1063539). Событие живой брони создаётся заново под `bookingEventUid`,
// uid в брони переписывается CAS-ом, старое удаляется. Старый UID выводится
// из номера, поэтому DELETE по нему находит и событие, чей uid в брони не
// записан (под умер между PUT и записью): листинг календаря не нужен.

export const REISSUE_COMMAND = 'reissue_icloud';

/** UID события брони до #1202: номер брони открытым текстом. */
export function legacyEventUid(id: number): string {
  return `booking-${id}@schemehappens.ru`;
}

/** Статусы, при которых событие брони остаётся в календаре. */
export const EVENT_KEPT: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];

export interface ReissueBooking {
  id: number;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  status: BookingStatus;
  calDavUid: string | null;
}

export interface ReissuePorts {
  putEvent(ev: OwnerCalEvent): Promise<string | null>;
  removeEvent(uid: string): Promise<CalDeleteResult | undefined>;
  /** CAS старого uid на новый у неотменённой брони; false — бронь изменилась за время прохода. */
  saveUid(id: number, from: string, to: string): Promise<boolean>;
  pause(): Promise<void>;
}

export interface ReissueReport {
  live: boolean;
  /** Событие живой брони — под новым UID, старое снято. */
  reissued: number;
  /** Старые адреса без замены: отменённая бронь или событие с незаписанным uid. */
  checked: number;
  removed: number;
  missing: number;
  failed: number;
}

/** Записан старый UID и событие остаётся — перевыпуск; иначе — только DELETE старого адреса. */
export function reissueActionFor(b: ReissueBooking): 'reissue' | 'sweep' {
  const legacy = b.calDavUid === legacyEventUid(b.id);
  return legacy && EVENT_KEPT.includes(b.status) ? 'reissue' : 'sweep';
}

async function reissue(
  b: ReissueBooking,
  ports: ReissuePorts,
  r: ReissueReport,
): Promise<void> {
  const ev = ownerEventFor(b);
  // Сначала новое: сбой PUT не оставит владельца без события живой брони.
  if (!(await ports.putEvent(ev))) {
    r.failed++;
    return;
  }
  const legacy = legacyEventUid(b.id);
  if (!(await ports.saveUid(b.id, legacy, ev.uid))) {
    // Бронь отменили за время PUT: новое снимаем, старое снимает отмена.
    await ports.removeEvent(ev.uid);
    r.failed++;
    return;
  }
  // Сбой DELETE: uid уже новый, повтор снимет старое как адрес без замены.
  const old = await ports.removeEvent(legacy);
  if (old === 'deleted' || old === 'missing') r.reissued++;
  else r.failed++;
}

async function sweep(
  b: ReissueBooking,
  ports: ReissuePorts,
  r: ReissueReport,
): Promise<void> {
  r.checked++;
  const old = await ports.removeEvent(legacyEventUid(b.id));
  if (old === 'deleted') r.removed++;
  else if (old === 'missing') r.missing++;
  else r.failed++;
}

export async function runLegacyUidReissue(input: {
  bookings: ReissueBooking[];
  live: boolean;
  ports: ReissuePorts;
}): Promise<ReissueReport> {
  const { live, ports } = input;
  const r: ReissueReport = {
    live,
    reissued: 0,
    checked: 0,
    removed: 0,
    missing: 0,
    failed: 0,
  };
  for (const b of input.bookings) {
    const action = reissueActionFor(b);
    if (!live) {
      if (action === 'reissue') r.reissued++;
      else r.checked++;
      continue;
    }
    if (action === 'reissue') await reissue(b, ports, r);
    else await sweep(b, ports, r);
    await ports.pause();
  }
  return r;
}

/** Отчёт владельцу в Telegram — одни счётчики. Без обращения к читателю: формы ты/вы не нужны. */
export function formatReissueReport(r: ReissueReport | null): string {
  const go = `/${REISSUE_COMMAND} go`;
  if (!r) return '🔁 Перевыпуск событий iCloud: iCloud не настроен — пропущен';
  if (!r.live)
    return [
      '🔎 Сухой прогон перевыпуска событий iCloud (ничего не менялось)',
      '',
      `iCloud: будет перевыпущено ${r.reissued}, ` +
        `будет проверено старых адресов ${r.checked}`,
      '',
      `Боевой прогон: ${go}`,
    ].join('\n');
  const lines = [
    '🔁 Перевыпуск событий iCloud — готово',
    '',
    `iCloud: перевыпущено ${r.reissued}, снято старых без замены ${r.removed}, ` +
      `по старому адресу пусто ${r.missing}, ошибок ${r.failed}`,
  ];
  if (r.failed) lines.push('', `Повтор безопасен: ${go} добьёт ошибки.`);
  return lines.join('\n');
}
