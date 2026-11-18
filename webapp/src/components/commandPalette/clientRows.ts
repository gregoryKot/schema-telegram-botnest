// Клиенты в общем поиске: строки списка, обрезка без запроса и второй шаг «Кому дать задание?».
import type { Tr } from '../../../../shared/src/needs/types';
import { isActiveToday } from '../../../../shared/src/therapy/clientSheetHelpers';
import { clientAvatarInitials, clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { ROW_SCORE, rowScore } from '../../../../shared/src/search/rankRows';
import type { TherapyClientSummary } from '../../api';
import { clientHue } from '../../lib/tone';
import { clientStatus } from '../therapist/rosterOrder';
import type { CmdMark, CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteRows';

export const CLIENTS_GROUP = 'Клиенты';
export const ASSIGN_GROUP = 'Кому дать задание';
/** Сколько клиентов видно без запроса. */
export const CLIENTS_SHOWN = 5;

/** Кружок с инициалами — как в меню кабинета. */
export function clientMark(c: TherapyClientSummary): CmdMark {
  return { initials: clientAvatarInitials(c), hue: clientHue(c.telegramId) };
}

export function clientRows({ clients, run }: PaletteInput): CmdRow[] {
  return clients.map((c) => ({
    key: `client:${c.telegramId}`, kind: 'client', group: CLIENTS_GROUP, label: clientDisplayName(c),
    sub: isActiveToday(c) ? 'Активность сегодня' : clientStatus(c).label,
    hint: 'Открыть карточку',
    mark: clientMark(c),
    search: clientDisplayName(c),
    action: () => run.client(c.telegramId),
  }));
}

/** Первые клиенты и приглушённая строка «Ещё N» под последним из них. */
export function clientsPreview(rows: CmdRow[], tr: Tr): CmdRow[] {
  const rest = rows.length - CLIENTS_SHOWN;
  if (rest <= 0) return rows;
  const shown = rows.slice(0, CLIENTS_SHOWN);
  shown[CLIENTS_SHOWN - 1] = { ...shown[CLIENTS_SHOWN - 1], after: tr(`Ещё ${rest} — начни вводить имя`, `Ещё ${rest} — начните вводить имя`) };
  return shown;
}

/** Второй шаг: все клиенты без обрезки, по запросу — подходящие по имени, лучшие первыми. */
export function assigneeRows(input: PaletteInput, catalogId: string | null): CmdRow[] {
  const { clients, run, query, screenShare } = input;
  if (screenShare) return [];
  const rows = clients.map((c): CmdRow => ({
    key: `assign:${c.telegramId}`, kind: 'client', group: ASSIGN_GROUP, label: clientDisplayName(c),
    sub: 'Открыть лист нового задания', mark: clientMark(c), search: clientDisplayName(c), transient: true,
    action: () => run.assign(c.telegramId, catalogId),
  }));
  if (query.trim() === '') return rows;
  return rows
    .map((row) => ({ row, score: rowScore(row.label, '', query) }))
    .filter((r) => r.score > ROW_SCORE.none)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.row);
}
