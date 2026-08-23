// Общие ключи localStorage — единственная копия (правило №3 CLAUDE.md, волна 2).
// YSQ_RESULT_KEY/YSQ_PROGRESS_KEY — из hooks/ysqStorageKeys.ts, НЕ из
// hooks/useYsqTest.ts (правка производительности схема-мини-аппа 2026-08-22):
// тот — барабан-реэкспорт вопросов/схем/скоринга, и импорт через него тянул
// бы весь контент теста в любой чанк, откуда синхронно нужен этот ключ.
export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../hooks/ysqStorageKeys';

export const MY_SCHEMA_IDS_KEY = 'my_schema_ids';
export const MY_MODE_IDS_KEY = 'my_mode_ids';
export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';
// Последняя открытая вкладка экрана «Паттерны» мини-аппа (Схемы/Режимы/
// Потребности) — секция размонтируется при переключении нижней навигации и
// без этого ключа каждый возврат сбрасывал вкладку на «Схемы» (см.
// schema-miniapp/src/sections/schemas/patternsTabStorage.ts).
export const PATTERNS_LAST_TAB_KEY = 'patterns_last_tab';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}
