import { getQuickAction, type QuickActionId } from '../../utils/quickActions';
import { plural } from '../today/helpers';

// Данные 10 строк блока «Инструменты» (ToolsList.tsx) — единственный источник
// и для рендера списка, и для листа настройки видимости
// (QuickActionCustomizeSheet, правило «одна механика — один компонент»).
// Тексты (label/sub статичных строк) берутся из общего реестра
// utils/quickActions.ts — здесь только порядок строк и динамические
// счётчики (цели/практики/планы, «Займёт 2 минуты» колеса детства), которых
// в реестре нет. Без эмодзи (фидбек владельца): в листах настройки выбирают
// по смыслу.

export interface ToolRowDef {
  id: QuickActionId;
  label: string;
  sub?: string;
}

export interface ToolRowsProps {
  tasksCount: number;
  practiceCount?: number | null;
  planCount?: number | null;
  childhoodDone: boolean;
}

// Порядок строк — как исторически зашит в ToolsList, сохранён 1:1.
const TOOL_ROW_ORDER: QuickActionId[] = [
  'phrase_check',
  'tasks',
  'practices',
  'plans',
  'belief_check',
  'safe_place',
  'letter_to_self',
  'flashcard',
  'childhood_wheel',
  'warm_words',
];

function rowSub(
  id: QuickActionId,
  staticSub: string,
  props: ToolRowsProps,
): string | undefined {
  switch (id) {
    case 'tasks':
      return props.tasksCount === 0
        ? 'Нет активных'
        : `${props.tasksCount} ${plural(props.tasksCount, 'цель', 'цели', 'целей')}`;
    case 'practices':
      return props.practiceCount == null
        ? undefined
        : props.practiceCount === 0
          ? 'Нет практик'
          : `${props.practiceCount} ${plural(props.practiceCount, 'практика', 'практики', 'практик')}`;
    case 'plans':
      return props.planCount == null
        ? undefined
        : props.planCount === 0
          ? 'История пуста'
          : `${props.planCount} ${plural(props.planCount, 'план', 'плана', 'планов')}`;
    case 'childhood_wheel':
      return props.childhoodDone ? 'Паттерны из прошлого' : 'Займёт 2 минуты';
    default:
      return staticSub;
  }
}

export function buildToolRows(props: ToolRowsProps): ToolRowDef[] {
  return TOOL_ROW_ORDER.map((id) => {
    const a = getQuickAction(id);
    const staticSub = typeof a.sub === 'string' ? a.sub : '';
    return { id, label: a.label, sub: rowSub(id, staticSub, props) };
  });
}
