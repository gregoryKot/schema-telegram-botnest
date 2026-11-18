// Действия строк общего поиска и второй шаг «Кому дать задание?»: строка со `stay` палитру не
// закрывает, а переводит её к выбору клиента; выбранный клиент — переход в его «Задания» с
// состоянием маршрута, по которому карточка открывает лист (therapist/cabinetRouteActions.ts).
import { useCallback, useMemo, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import type { TherapyClientSummary, UserId } from '../../api';
import type { QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import { trackSearchResultOpen } from '../../../../shared/src/share/searchAnalytics';
import { clientRef } from '../../../../shared/src/utils/clientRef';
import { GUIDE_PATH, guideSheetState } from '../../sections/guide/guideSheetRoute';
import type { Section } from '../appShell/navigation';
import { readScreenShare } from '../appShell/screenShareMode';
import { toggleScreenShare } from '../appShell/toggleScreenShare';
import { ADD_CLIENT_STATE, assignTaskState } from '../therapist/cabinetRouteActions';
import { clientCardPath } from '../therapist/clientTabRoute';
import type { CmdRow } from './cmdRow';
import { pushRecent } from './paletteRecent';
import type { PaletteGuide, PaletteInput } from './paletteRows';
import { RECENT_GROUP } from './recentRows';

interface Params {
  onNavigate: (s: Section) => void;
  onOpenClient?: (id: UserId) => void;
  onToggleMode?: () => void;
  onQuickAction?: (id: QuickActionId) => void;
  clients: TherapyClientSummary[];
  guide: PaletteGuide | null;
  /** Шаг сменился: запрос очищается, фокус остаётся в поле. */
  setQuery: (q: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function usePaletteActions({ onNavigate, onOpenClient, onToggleMode, onQuickAction, clients, guide, setQuery, inputRef }: Params) {
  const navigate = useNavigate();
  const [assign, setAssign] = useState<PaletteInput['assign']>(null);
  const enter = useCallback((next: PaletteInput['assign']) => {
    setAssign(next);
    setQuery('');
    inputRef.current?.focus();
  }, [setQuery, inputRef]);
  const tasks = guide?.tasks;
  const run = useMemo((): PaletteInput['run'] => ({
    section: onNavigate,
    path: (to) => { navigate(to); },
    client: (id) => onOpenClient?.(id),
    toggleMode: () => onToggleMode?.(),
    quick: (id) => onQuickAction?.(id),
    guideSheet: (target) => { navigate(GUIDE_PATH, { state: guideSheetState(target) }); },
    pickAssignee: (catalogId) => enter({ catalogId }),
    assign: (clientId, catalogId) => {
      const client = clients.find((c) => c.telegramId === clientId);
      const task = tasks?.find((t) => t.id === catalogId) ?? null;
      if (client) navigate(clientCardPath(clientRef(client), 'tasks'), { state: assignTaskState(task) });
    },
    addClient: () => { navigate('/cabinet', { state: ADD_CLIENT_STATE }); },
    toggleScreenShare: () => toggleScreenShare(readScreenShare()),
  }), [navigate, onNavigate, onOpenClient, onToggleMode, onQuickAction, clients, tasks, enter]);
  /** Назад к первому шагу (Backspace в пустом поле). */
  const leaveAssign = useCallback(() => enter(null), [enter]);
  return { assign, run, leaveAssign };
}

/**
 * Запуск строки: событие с видом строки (не с запросом) и ключ в «Недавнее»; действие — после снятия
 * записи палитры (`close`), у строки со `stay` — сразу, палитра остаётся открытой.
 */
export function runPaletteRow(row: CmdRow | undefined, typed: boolean, close: (then: () => void) => void): void {
  if (!row) return;
  if (!row.transient) {
    trackSearchResultOpen(api, row.kind, typed, row.group === RECENT_GROUP);
    pushRecent(row.key);
  }
  if (row.stay) row.action();
  else close(row.action);
}
