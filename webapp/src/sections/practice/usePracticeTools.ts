// «Инструменты» мини-аппа на странице «Практика»: общее состояние (скрытые
// пункты и порядок, shared/useToolsState) и то, что из него следует для
// разделов — карточки библиотеки, строки «Каталогов». Скрытие действует на
// карточки, «Мне плохо», «Мои цели» и каталоги; порядок — на карточки.
// «Карта режимов» — строкой «Каталогов» (пункта в «Инструментах» у неё нет, не скрывается).
import { useToolsState } from '../../../../shared/src/quickActions/useToolsState';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';
import { EXERCISES } from './exerciseLibraryModel';
import { CARD_TOOL_IDS, arrangeExercises } from './toolsLayout';
import { catalogRowSub, type CatalogCounts } from './catalogCounts';
import type { CatalogRow } from './CatalogsBlock';

interface Args {
  goalsCount: number; catalog: CatalogCounts; childhoodDone: boolean;
  onOpenPractices: () => void; onOpenPlans: () => void;
  modesRow: Pick<CatalogRow, 'sub' | 'onClick'>; // подпись с формой обращения и переход — у раздела
}

export function usePracticeTools({ goalsCount, catalog, childhoodDone, onOpenPractices, onOpenPlans, modesRow }: Args) {
  const tools = useToolsState(
    { tasksCount: goalsCount, practiceCount: catalog.practices, planCount: catalog.plans, childhoodDone },
    notifyPrefsChanged,
    CARD_TOOL_IDS,
  );
  const cards = arrangeExercises(EXERCISES, tools.groups[0].map(r => r.id), tools.hidden);
  const catalogRows = ([
    { id: 'practices', look: 'nourish', label: 'Что питает', sub: catalogRowSub('practices', catalog.practices, 'Маленькие действия для пяти потребностей'), onClick: onOpenPractices },
    { id: 'plans',     look: 'plan',    label: 'Планы',    sub: catalogRowSub('plans', catalog.plans, 'Планы поддержки и кризисов'),                       onClick: onOpenPlans },
    { id: 'modes_map', look: 'modes',   label: 'Карта режимов', ...modesRow },
  ] satisfies CatalogRow[]).filter(r => tools.isShown(r.id));
  return { tools, cards, catalogRows };
}
