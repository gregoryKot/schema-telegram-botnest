import { todayStr } from './format';

// Константы «сегодня/вчера» на момент загрузки бандла — единственная копия
// (правило №3; жили дублем в schema-miniapp/utils/todayConstants.ts и
// webapp/appShell/useBootstrapLoad.ts).
export const TODAY_DATE = todayStr();
export const TODAY_KEY = 'celebrated_' + TODAY_DATE;
export const YESTERDAY_DATE = (() => {
  const [y, m, d] = TODAY_DATE.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
})();
