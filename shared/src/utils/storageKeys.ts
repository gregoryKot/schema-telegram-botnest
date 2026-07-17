// Общие ключи localStorage — единственная копия (правило №3 CLAUDE.md, волна 2).
// YSQ_RESULT_KEY/YSQ_PROGRESS_KEY уже канонически определены в
// hooks/useYsqTest.ts (тоже общий файл) — реэкспортируем их отсюда, чтобы
// не заводить второе определение той же строки.
export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../hooks/useYsqTest';

export const MY_SCHEMA_IDS_KEY = 'my_schema_ids';
export const MY_MODE_IDS_KEY = 'my_mode_ids';
export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}
