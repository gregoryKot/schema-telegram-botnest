import { tryDecrypt } from '../utils/crypto';
import type {
  ZoomDeleteResult,
  ZoomListed,
  ZoomListResult,
  ZoomMeetingRow,
  ZoomRoomResult,
} from './zoom-room';

// Комнаты Zoom без строки ClientMeeting: проход ключей (client-key-rekey.service.ts)
// удаляет строку, а комната с именем клиента в теме остаётся в Zoom.

// Комната бота — повторяющаяся без времени (type 3); прежняя тема несла имя клиента.
const BOT_ROOM_TYPE = 3;
const LEGACY_TOPIC = /^Сессии —/;

export interface RoomRefs {
  /** zoomMeetingId строк ClientMeeting. */
  known: Set<string>;
  /** Числа из ссылок живых броней (anonymizedAt = null): id комнаты среди них. */
  booked: Set<string>;
  /** Живые брони, чью ссылку не открыл ни один ключ: сверка неполна. */
  unreadable: number;
}

export interface OrphanPorts {
  listZoomMeetings(): Promise<ZoomListed>;
  /** Читается после списка: комната, созданная во время прохода, уже в базе. */
  roomRefs(): Promise<RoomRefs>;
  deleteZoomRoom(id: string): Promise<ZoomDeleteResult>;
  renameZoomRoom(id: string): Promise<ZoomRoomResult>;
  pause(): Promise<void>;
}

export interface OrphanReport {
  list: ZoomListResult;
  detail?: string;
  orphans: number;
  deleted: number;
  renamed: number;
  /** Сироты, на которые ссылается живая бронь: остаются, только без имени. */
  kept: number;
  unreadable: number;
  /** Встречи вне базы, не похожие на комнаты бота, — не трогаются. */
  other: number;
  failed: number;
  /** Zoom не дал права удалить (403): id комнат — удалить вручную. */
  manual: string[];
  limited: boolean;
}

/** id комнат из ссылок броней; шифротекст, не открытый ключами, — в счёт нечитаемых. */
export function linkRefs(
  links: (string | null)[],
): Pick<RoomRefs, 'booked' | 'unreadable'> {
  const booked = new Set<string>();
  let unreadable = 0;
  for (const link of links) {
    if (!link) continue;
    const r = tryDecrypt(link);
    if (!r.ok && r.looksCipher) {
      unreadable++;
      continue;
    }
    // Все числа ссылки, а не разбор формата: лишнее число лишь оставит комнату.
    for (const n of (r.ok ? r.text : link).match(/\d+/g) ?? []) booked.add(n);
  }
  return { booked, unreadable };
}

function isBotRoom(m: ZoomMeetingRow, topic: string): boolean {
  if (m.type !== BOT_ROOM_TYPE) return false;
  return m.topic === topic || LEGACY_TOPIC.test(m.topic);
}

interface Pass {
  topic: string;
  live: boolean;
  ports: OrphanPorts;
  refs: RoomRefs;
  rep: OrphanReport;
}

/** Комнату без живой брони — удалить, иначе — снять имя. true — упёрлись в лимит. */
async function scrubOrphan(m: ZoomMeetingRow, p: Pass): Promise<boolean> {
  const { rep, ports, live } = p;
  const held = p.refs.booked.has(m.id);
  if (held) rep.kept++;
  const deletable = !held && !p.refs.unreadable;
  // После первого 403 удаление не пробуем: права не появится до конца прохода.
  if (deletable && rep.manual.length) rep.manual.push(m.id);
  else if (deletable) {
    if (!live) {
      rep.deleted++;
      return false;
    }
    const r = await ports.deleteZoomRoom(m.id);
    await ports.pause();
    if (r === 'ok' || r === 'missing') {
      rep.deleted++;
      return false;
    }
    if (r === 'limited') return true;
    if (r === 'forbidden') rep.manual.push(m.id);
    else rep.failed++;
  }
  if (m.topic === p.topic) return false;
  if (!live) {
    rep.renamed++;
    return false;
  }
  const r = await ports.renameZoomRoom(m.id);
  await ports.pause();
  if (r === 'ok') rep.renamed++;
  else if (r === 'failed') rep.failed++;
  return r === 'limited';
}

export async function scrubOrphans(input: {
  topic: string;
  live: boolean;
  ports: OrphanPorts;
}): Promise<OrphanReport> {
  const rep: OrphanReport = {
    list: 'ok',
    orphans: 0,
    deleted: 0,
    renamed: 0,
    kept: 0,
    unreadable: 0,
    other: 0,
    failed: 0,
    manual: [],
    limited: false,
  };
  const listed = await input.ports.listZoomMeetings();
  if (listed.result !== 'ok') {
    const limited = listed.result === 'limited';
    return { ...rep, list: listed.result, detail: listed.detail, limited };
  }
  const refs = await input.ports.roomRefs();
  rep.unreadable = refs.unreadable;
  const byId = new Map(listed.meetings.map((m) => [m.id, m]));
  const outside = [...byId.values()].filter((m) => !refs.known.has(m.id));
  const orphans = outside.filter((m) => isBotRoom(m, input.topic));
  rep.orphans = orphans.length;
  rep.other = outside.length - orphans.length;
  const pass: Pass = { ...input, refs, rep };
  for (const [i, m] of orphans.entries()) {
    if (!(await scrubOrphan(m, pass))) continue;
    // Лимит Zoom: остальные комнаты добьёт повторный запуск.
    rep.limited = true;
    rep.failed += orphans.length - i;
    break;
  }
  return rep;
}
