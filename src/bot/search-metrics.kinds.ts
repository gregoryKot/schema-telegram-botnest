import type { SearchResultKind } from '../analytics/cabinet-events.constants';

// Подписи видов результата общего поиска для /stats: простым языком, в родительном падеже
// («открыли клиентов — N»). Новый вид без подписи не соберётся; порядок строк — из SEARCH_RESULT_KINDS.
export const SEARCH_KIND_LABELS: Record<SearchResultKind, string> = {
  client: 'клиентов',
  client_tab: 'вкладок клиента',
  section: 'разделов',
  guide: 'листов справочника',
  task: 'заданий из справочника', // дальше выбирают, кому дать
  action: 'действий',
  pattern: 'схем и режимов', // у клиента, из «Паттернов»
  exercise: 'упражнений',
  plan: 'планов',
  own_task: 'своих заданий',
};
