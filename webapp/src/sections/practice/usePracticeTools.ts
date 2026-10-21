// «Инструменты» мини-аппа на странице «Практика»: общее состояние (скрытые
// пункты и порядок, shared/useToolsState) и то, что из него следует для
// разделов — карточки библиотеки, строки «Каталогов». Скрытие действует на
// карточки, «Мне плохо», «Мои цели» и каталоги; порядок — на карточки.
import { useToolsState } from '../../../../shared/src/quickActions/useToolsState';
import { notifyPrefsChanged } from '../../utils/uiPrefsSync';
import { EXERCISES } from './exerciseLibrary';
import { CARD_TOOL_IDS, arrangeExercises } from './toolsLayout';
import { catalogRowSub, type CatalogCounts } from './catalogCounts';
import type { CatalogRow } from './CatalogsBlock';

interface Args {
  goalsCount: number;
  catalog: CatalogCounts;
  childhoodDone: boolean;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
}

export function usePracticeTools({ goalsCount, catalog, childhoodDone, onOpenPractices, onOpenPlans }: Args) {
  const tools = useToolsState(
    { tasksCount: goalsCount, practiceCount: catalog.practices, planCount: catalog.plans, childhoodDone },
    notifyPrefsChanged,
    CARD_TOOL_IDS,
  );
  const cards = arrangeExercises(EXERCISES, tools.groups[0].map(r => r.id), tools.hidden);
  const catalogRows: CatalogRow[] = [
    { id: 'practices', label: 'Практики', sub: catalogRowSub('practices', catalog.practices, 'Рекомендованные упражнения по потребностям'), onClick: onOpenPractices },
    { id: 'plans',     label: 'Планы',    sub: catalogRowSub('plans', catalog.plans, 'Планы поддержки и кризисов'),                       onClick: onOpenPlans },
  ].filter(r => tools.isShown(r.id));
  return { tools, cards, catalogRows };
}
