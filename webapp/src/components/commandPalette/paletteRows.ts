// Строки общего поиска (палитра ⌘K, CommandPalette.tsx): чистая сборка из клиентов, разделов, листов
// «Справочника» и действий. Каждая строка — в группе с подписью. Пустой запрос — обзор: первые клиенты,
// разделы, действия. Запрос — вес строки (shared/src/search/rankRows.ts): внутри группы по убыванию
// веса, группы — по лучшему весу, при равенстве — в порядке GROUP_ORDER. Листы справочника ищет
// движок самого справочника (rankReference) и только в кабинете терапевта.
import type { Tr } from '../../../../shared/src/needs/types';
import { buildPlusActions, type QuickActionId } from '../../../../shared/src/quickActions/quickActions';
import { isActiveToday } from '../../../../shared/src/therapy/clientSheetHelpers';
import { clientAvatarInitials, clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { ROW_SCORE, rowScore } from '../../../../shared/src/search/rankRows';
import type { TherapyClientSummary, UserId } from '../../api';
import { clientHue } from '../../lib/tone';
import type { Reference } from '../../sections/guide/guideReferenceModel';
import type { ReferenceBody } from '../../sections/guide/guideReferenceBody';
import { rankReference } from '../../sections/guide/guideReferenceSearch';
import type { GuideSheetTarget } from '../../sections/guide/guideSheetRoute';
import { clientStatus } from '../therapist/rosterOrder';
import { SECTION_LOOK, THERAPIST_NAV } from '../appShell/navLook';
import type { Section } from '../appShell/navigation';
import type { CmdRow } from '../CommandPaletteList';
import { quickActionSign } from '../quickActionSign';

export const GROUP = { clients: 'Клиенты', sections: 'Разделы', guide: 'Справочник', actions: 'Действия' } as const;
const GROUP_ORDER: string[] = [GROUP.clients, GROUP.sections, GROUP.guide, GROUP.actions];
/** Сколько клиентов видно без запроса и сколько листов справочника — по запросу. */
export const CLIENTS_SHOWN = 5;
export const GUIDE_SHOWN = 6;

const NAV_ITEMS: { id: Section; label: string; sub: string; hint: string }[] = [
  { id: 'today', label: 'Сегодня', sub: 'Главная', hint: '⌘ 1' },
  { id: 'diary', label: 'Записи', sub: 'Дневники', hint: '⌘ 2' },
  { id: 'more', label: 'Ещё', sub: 'Всё остальное', hint: '⌘ 3' },
  { id: 'schemas', label: 'Паттерны', sub: '20 схем', hint: '' },
  { id: 'profile', label: 'Профиль', sub: 'Аккаунт', hint: '' },
  { id: 'practice', label: 'Практики', sub: 'Дыхание, упражнения, планы', hint: '' },
];

export interface PaletteGuide { ref: Reference; body: ReferenceBody }

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
  run: {
    section: (id: Section) => void;
    path: (to: string) => void;
    client: (id: UserId) => void;
    toggleMode: () => void;
    quick: (id: QuickActionId) => void;
    guideSheet: (target: GuideSheetTarget) => void;
  };
}

function clientRows({ clients, run }: PaletteInput): CmdRow[] {
  return clients.map((c) => ({
    kind: 'client', group: GROUP.clients, label: clientDisplayName(c),
    sub: isActiveToday(c) ? 'Активность сегодня' : clientStatus(c).label,
    hint: 'Открыть карточку',
    mark: { initials: clientAvatarInitials(c), hue: clientHue(c.telegramId) },
    search: clientDisplayName(c),
    action: () => run.client(c.telegramId),
  }));
}

function sectionRows({ therapistMode, run }: PaletteInput): CmdRow[] {
  if (therapistMode) {
    return Object.values(THERAPIST_NAV).map((n) => ({
      kind: 'section', group: GROUP.sections, label: n.label, mark: { sign: n.sign }, search: n.label,
      action: () => run.path(n.to),
    }));
  }
  return NAV_ITEMS.map((n) => ({
    kind: 'section', group: GROUP.sections, label: n.label, sub: n.sub, hint: n.hint,
    mark: { sign: SECTION_LOOK[n.id].sign }, search: `${n.label} ${n.sub}`,
    action: () => run.section(n.id),
  }));
}

/** Переключатель режима — в «Действиях»; быстрые действия клиента — группами реестра, при запросе — там же. */
function actionRows({ therapist, therapistMode, tr, run, query }: PaletteInput): CmdRow[] {
  const toggle = therapistMode ? 'Переключиться в режим клиента' : 'Переключиться в кабинет терапевта';
  const toggleSub = therapistMode ? 'Клиентский вид' : 'Кабинет';
  const searching = query.trim() !== '';
  return [
    ...(therapist ? [{
      kind: 'action' as const, group: GROUP.actions, label: toggle, sub: toggleSub, mark: { sign: 'cluster' as const },
      search: `${toggle} ${toggleSub}`, action: run.toggleMode,
    }] : []),
    ...(therapistMode ? [] : buildPlusActions(tr).flatMap((g) => g.actions.map((a): CmdRow => ({
      kind: 'action', group: searching ? GROUP.actions : g.title, label: a.label, sub: a.sub, mark: { sign: quickActionSign(a.id) },
      search: `${a.label} ${g.title} ${a.sub}`, action: () => run.quick(a.id),
    })))),
  ];
}

/** Лучшие листы справочника по запросу: подзаголовок — кусок совпавшего текста или «Раздел · Группа». */
function guideRows({ guide, query, run }: PaletteInput): { row: CmdRow; score: number }[] {
  if (!guide) return [];
  return rankReference(guide.ref, query, guide.body).slice(0, GUIDE_SHOWN).map(({ item, snippet, section, title }) => ({
    row: {
      kind: 'guide', group: GROUP.guide, label: item.name,
      sub: snippet ?? (title === section ? section : `${section} · ${title}`),
      mark: { sign: item.sign ?? THERAPIST_NAV.guide.sign }, search: item.name,
      action: () => run.guideSheet({ kind: item.kind, id: item.id }),
    },
    // Название не совпало (нашлось в тексте листа) — наименьший вес, порядок справочника сохраняется.
    score: Math.max(rowScore(item.name, '', query), ROW_SCORE.text),
  }));
}

/** Первые клиенты и приглушённая строка «Ещё N» под последним из них. */
function clientsPreview(rows: CmdRow[], tr: Tr): CmdRow[] {
  const rest = rows.length - CLIENTS_SHOWN;
  if (rest <= 0) return rows;
  const shown = rows.slice(0, CLIENTS_SHOWN);
  shown[CLIENTS_SHOWN - 1] = { ...shown[CLIENTS_SHOWN - 1], after: tr(`Ещё ${rest} — начни вводить имя`, `Ещё ${rest} — начните вводить имя`) };
  return shown;
}

export function buildPaletteRows(input: PaletteInput): CmdRow[] {
  const { query, therapist, therapistMode, screenShare, tr } = input;
  const clients = therapist && !screenShare ? clientRows(input) : [];
  if (query.trim() === '') return [...clientsPreview(clients, tr), ...sectionRows(input), ...actionRows(input)];
  const scored = [...clients, ...sectionRows(input), ...actionRows(input)]
    .map((row) => ({ row, score: rowScore(row.label, row.search, query) }))
    .filter((r) => r.score > ROW_SCORE.none);
  if (therapist && therapistMode) scored.push(...guideRows(input));
  const best = new Map<string, number>();
  for (const { row, score } of scored) best.set(row.group, Math.max(best.get(row.group) ?? 0, score));
  const order = (group: string) => GROUP_ORDER.indexOf(group);
  return scored
    .sort((a, b) => ((best.get(b.row.group) ?? 0) - (best.get(a.row.group) ?? 0)) || (order(a.row.group) - order(b.row.group)) || (b.score - a.score))
    .map((r) => r.row);
}

/** Примеры запросов из настоящих названий листов: первая схема, первый режим, первая техника. */
export function paletteExamples(guide: PaletteGuide | null): string[] {
  if (!guide) return [];
  return [guide.ref.schemas, guide.ref.modes, guide.ref.techniques].flatMap((groups) => groups[0]?.items[0]?.name ?? []);
}

/** Строка «что ищется»: под полем при пустом запросе и в «Ничего не нашлось». */
export function paletteHelp({ therapist, therapistMode, screenShare }: Pick<PaletteInput, 'therapist' | 'therapistMode' | 'screenShare'>): string {
  const parts = [
    therapist && !screenShare && 'клиенты',
    therapist && therapistMode && 'листы справочника',
    'разделы и действия',
  ].filter(Boolean).join(', ');
  return parts[0].toUpperCase() + parts.slice(1);
}
