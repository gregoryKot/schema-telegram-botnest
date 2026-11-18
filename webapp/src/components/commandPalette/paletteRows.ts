// Строки общего поиска (палитра ⌘K, CommandPalette.tsx): чистая сборка из клиентов, разделов, листов
// «Справочника» и действий. Каждая строка — в группе с подписью. Пустой запрос — обзор: первые клиенты,
// разделы, действия. Запрос — вес строки (shared/src/search/rankRows.ts): внутри группы по убыванию
// веса, группы — по лучшему весу, при равенстве — в порядке GROUP_ORDER. Только в кабинете терапевта:
// листы справочника (guideRows.ts), вкладки карточки клиента (clientTabRows.ts), задания из справочника
// (taskRows.ts) и действия кабинета (cabinetActionRows.ts); шаг «Кому дать задание?» — одни клиенты
// (clientRows.ts). Без запроса первой группой — «Недавнее» (recentRows.ts).
import type { Tr } from '../../../../shared/src/needs/types';
import type { CatalogTask } from '../../../../shared/src/tasks/catalog/taskCatalog';
import { buildPlusActions, type QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import { hasLatin, toRussianLayout } from '../../../../shared/src/search/keyboardLayout';
import { ROW_SCORE, rowScore } from '../../../../shared/src/search/rankRows';
import type { TherapyClientSummary, UserId } from '../../api';
import type { Reference } from '../../sections/guide/guideReferenceModel';
import type { ReferenceBody } from '../../sections/guide/guideReferenceBody';
import type { GuideSheetTarget } from '../../sections/guide/guideSheetRoute';
import { SECTION_LOOK, THERAPIST_NAV } from '../appShell/navLook';
import type { Section } from '../appShell/navigation';
import { quickActionSign } from '../quickActionSign';
import { cabinetActionRows } from './cabinetActionRows';
import { ASSIGN_GROUP, CLIENTS_GROUP, assigneeRows, clientRows, clientsPreview } from './clientRows';
import { CLIENT_TAB_GROUP, allClientTabRows, clientTabRows } from './clientTabRows';
import type { CmdRow } from './cmdRow';
import { GUIDE_GROUP, allGuideRows, guideRows } from './guideRows';
import { RECENT_GROUP, recentRows } from './recentRows';
import { TASK_GROUP, allTaskRows, taskRows } from './taskRows';

export const GROUP = {
  recent: RECENT_GROUP, clients: CLIENTS_GROUP, clientTabs: CLIENT_TAB_GROUP, sections: 'Разделы', guide: GUIDE_GROUP,
  tasks: TASK_GROUP, actions: 'Действия', assign: ASSIGN_GROUP,
} as const;
const GROUP_ORDER: string[] = [GROUP.clients, GROUP.clientTabs, GROUP.sections, GROUP.guide, GROUP.tasks, GROUP.actions];

const NAV_ITEMS: { id: Section; label: string; sub: string; hint: string }[] = [
  { id: 'today', label: 'Сегодня', sub: 'Главная', hint: '⌘ 1' },
  { id: 'diary', label: 'Записи', sub: 'Дневники', hint: '⌘ 2' },
  { id: 'more', label: 'Ещё', sub: 'Всё остальное', hint: '⌘ 3' },
  { id: 'schemas', label: 'Паттерны', sub: '20 схем', hint: '' },
  { id: 'profile', label: 'Профиль', sub: 'Аккаунт', hint: '' },
  { id: 'practice', label: 'Практики', sub: 'Дыхание, упражнения, планы', hint: '' },
];

/** `tasks` — каталог заданий «Из справочника» (taskCatalog.ts). */
export interface PaletteGuide { ref: Reference; body: ReferenceBody; tasks: CatalogTask[] }

export interface PaletteInput {
  query: string;
  tr: Tr;
  /** Роль THERAPIST: видит клиентов и переключатель режима. */
  therapist: boolean;
  /** Открыт кабинет терапевта: его разделы и листы справочника вместо разделов клиента. */
  therapistMode: boolean;
  /** «Показ экрана»: клиентов нет ни списком, ни по поиску. */
  screenShare: boolean;
  clients: TherapyClientSummary[];
  /** Тексты справочника; грузятся или не загрузились — null, группы «Справочник» нет. */
  guide: PaletteGuide | null;
  /** Ключи недавно открытых строк, свежие первыми (paletteRecent.ts). */
  recent: string[];
  /** Второй шаг «Кому дать задание?»: в списке только клиенты; catalogId — выбранное задание справочника. */
  assign: { catalogId: string | null } | null;
  run: {
    section: (id: Section) => void;
    path: (to: string) => void;
    pickAssignee: (catalogId: string | null) => void;
    assign: (clientId: UserId, catalogId: string | null) => void;
    addClient: () => void;
    toggleScreenShare: () => void;
    client: (id: UserId) => void;
    toggleMode: () => void;
    quick: (id: QuickActionId) => void;
    guideSheet: (target: GuideSheetTarget) => void;
  };
}

function sectionRows({ therapistMode, run }: PaletteInput): CmdRow[] {
  if (therapistMode) {
    return Object.values(THERAPIST_NAV).map((n) => ({
      key: `section:${n.to}`, kind: 'section', group: GROUP.sections, label: n.label, mark: { sign: n.sign },
      search: n === THERAPIST_NAV.tasks ? `${n.label} доска задания клиентов` : n.label,
      action: () => run.path(n.to),
    }));
  }
  return NAV_ITEMS.map((n) => ({
    key: `section:${n.id}`, kind: 'section', group: GROUP.sections, label: n.label, sub: n.sub, hint: n.hint,
    mark: { sign: SECTION_LOOK[n.id].sign }, search: `${n.label} ${n.sub}`,
    action: () => run.section(n.id),
  }));
}

/** Переключатель режима — в «Действиях»; быстрые действия клиента — группами реестра, при запросе — там же. */
function actionRows(input: PaletteInput): CmdRow[] {
  const { therapist, therapistMode, tr, run, query } = input;
  const toggle = therapistMode ? 'Переключиться в режим клиента' : 'Переключиться в кабинет терапевта';
  const toggleSub = therapistMode ? 'Клиентский вид' : 'Кабинет';
  const searching = query.trim() !== '';
  return [
    ...(therapist ? [{
      key: 'action:toggle-mode', kind: 'action' as const, group: GROUP.actions, label: toggle, sub: toggleSub, mark: { sign: 'cluster' as const },
      search: `${toggle} ${toggleSub}`, action: run.toggleMode,
    }] : []),
    ...(therapist && therapistMode ? cabinetActionRows(input, GROUP.actions) : []),
    ...(therapistMode ? [] : buildPlusActions(tr).flatMap((g) => g.actions.map((a): CmdRow => ({
      key: `action:${a.id}`, kind: 'action', group: searching ? GROUP.actions : g.title, label: a.label, sub: a.sub, mark: { sign: quickActionSign(a.id) },
      search: `${a.label} ${g.title} ${a.sub}`, action: () => run.quick(a.id),
    })))),
  ];
}

export function buildPaletteRows(input: PaletteInput): CmdRow[] {
  const { query, therapist, therapistMode, screenShare, tr } = input;
  const clients = therapist && !screenShare ? clientRows(input) : [];
  const cabinet = therapist && therapistMode;
  if (cabinet && input.assign) return assigneeRows(input, input.assign.catalogId);
  const rows = [...clients, ...sectionRows(input), ...actionRows(input)];
  if (query.trim() === '') {
    const recent = recentRows(input.recent, cabinet ? [...rows, ...allGuideRows(input), ...allClientTabRows(input), ...allTaskRows(input)] : rows);
    return [...recent, ...clientsPreview(clients, tr), ...rows.slice(clients.length)];
  }
  const scored = rows
    .map((row) => ({ row, score: rowScore(row.label, row.search, query) }))
    .filter((r) => r.score > ROW_SCORE.none);
  if (cabinet) scored.push(...guideRows(input), ...clientTabRows(input), ...taskRows(input));
  const best = new Map<string, number>();
  for (const { row, score } of scored) best.set(row.group, Math.max(best.get(row.group) ?? 0, score));
  const order = (group: string) => GROUP_ORDER.indexOf(group);
  return scored
    .sort((a, b) => ((best.get(b.row.group) ?? 0) - (best.get(a.row.group) ?? 0)) || (order(a.row.group) - order(b.row.group)) || (b.score - a.score))
    .map((r) => r.row);
}

/** Строки по запросу; ничего не нашлось и запрос набран латиницей — по нему же в русской раскладке. */
export function searchPalette(input: PaletteInput): { rows: CmdRow[]; query: string; layoutFixed: boolean } {
  const { query } = input;
  const rows = buildPaletteRows(input);
  const fixed = toRussianLayout(query);
  if (rows.length > 0 || query.trim() === '' || !hasLatin(query) || fixed === query) return { rows, query, layoutFixed: false };
  const fixedRows = buildPaletteRows({ ...input, query: fixed });
  return fixedRows.length > 0 ? { rows: fixedRows, query: fixed, layoutFixed: true } : { rows, query, layoutFixed: false };
}
