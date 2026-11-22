// Вкладки карточки клиента в общем поиске: «Иван план» открывает «План работы» Ивана. Строки есть
// только по запросу: имя и слово вкладки вместе — или единственный найденный клиент (все его вкладки).
import { ROW_SCORE, rowScore } from '../../../../shared/src/search/rankRows';
import { textTokens } from '../../../../shared/src/search/searchQuery';
import { clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { clientRef } from '../../../../shared/src/utils/clientRef';
import type { TherapyClientSummary } from '../../api';
import { CLIENT_TAB_LABELS } from '../therapist/clientTabLabels';
import { clientCardPath } from '../therapist/clientTabRoute';
import { clientMark } from './clientRows'; import { clientPathRow } from './clientPathRow';
import type { CmdRow } from './cmdRow';
import type { PaletteInput } from './paletteRows';

export const CLIENT_TAB_GROUP = 'Карточка клиента';
/** Сколько строк видно по запросу: все вкладки одного клиента и «Путь терапии». */
export const CLIENT_TABS_SHOWN = 8;

// «Обзор» — сама карточка: её открывает строка клиента.
const TABS = CLIENT_TAB_LABELS.filter(([tab]) => tab !== 'overview');

function tabRowsOf(c: TherapyClientSummary, run: PaletteInput['run']): CmdRow[] {
  const name = clientDisplayName(c);
  return [...TABS.map(([tab, label]): CmdRow => ({
    key: `client-tab:${c.telegramId}:${tab}`, kind: 'client_tab', group: CLIENT_TAB_GROUP, label: `${name} · ${label}`,
    sub: 'Открыть вкладку', mark: clientMark(c), search: `${name} ${label}`,
    action: () => run.path(clientCardPath(clientRef(c), tab)),
  })), clientPathRow(c, run)];
}

/** Все вкладки всех клиентов — среди них «Недавнее» находит строку по ключу. При «Показе экрана» — пусто. */
export function allClientTabRows({ clients, screenShare, run }: PaletteInput): CmdRow[] {
  return screenShare ? [] : clients.flatMap((c) => tabRowsOf(c, run));
}

/** Хотя бы одно слово запроса — начало слова имени: «план» без имени вкладки всех клиентов не выдаёт. */
function namesClient(name: string, query: string): boolean {
  const words = textTokens(name);
  return textTokens(query).some((q) => words.some((w) => w.stem.startsWith(q.stem)));
}

export function clientTabRows(input: PaletteInput): { row: CmdRow; score: number }[] {
  const { clients, screenShare, query, run } = input;
  if (screenShare) return [];
  const byName = clients.map((c) => ({ c, score: rowScore(clientDisplayName(c), '', query) }));
  const named = byName.filter((n) => n.score > ROW_SCORE.none);
  const found = byName.flatMap(({ c, score }) => {
    // Запрос подошёл одному имени: вкладки показываются, только когда клиент такой один — с его весом.
    if (score > ROW_SCORE.none) return named.length === 1 ? tabRowsOf(c, run).map((row) => ({ row, score })) : [];
    if (!namesClient(clientDisplayName(c), query)) return [];
    return tabRowsOf(c, run)
      .map((row) => ({ row, score: rowScore(row.label, '', query) }))
      .filter((r) => r.score > ROW_SCORE.none);
  });
  return found.sort((a, b) => b.score - a.score).slice(0, CLIENT_TABS_SHOWN);
}
