// Общие ключи localStorage — единственная копия (правило №3 CLAUDE.md, волна 2).
// YSQ_RESULT_KEY/YSQ_PROGRESS_KEY — из hooks/ysqStorageKeys.ts, НЕ из
// hooks/useYsqTest.ts (правка производительности удалённого мини-аппа 2026-08-22):
// тот — барабан-реэкспорт вопросов/схем/скоринга, и импорт через него тянул
// бы весь контент теста в любой чанк, откуда синхронно нужен этот ключ.
export { YSQ_RESULT_KEY, YSQ_PROGRESS_KEY } from '../hooks/ysqStorageKeys';
export const MY_SCHEMA_IDS_KEY = 'my_schema_ids';
export const MY_MODE_IDS_KEY = 'my_mode_ids';
// Единственный писатель локальных копий «моих» схем и режимов — зеркало
// User.mySchemaIds / myModeIds (api.getProfile / api.updateSettings); экраны
// и старт приложения зовут эти функции, а не localStorage напрямую. Живут
// здесь, а не в модуле экрана «Паттерны»: их зовёт и главный чанк
// (useBootstrapLoad), и ленивые экраны, а этот файл оба уже импортируют —
// новый общий модуль между ними заставлял сборщик дробить index на 14
// лишних чанков (+13 КБ бандла, PR #939).
export function cacheMySchemaIds(ids: string[]): void {
  localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(ids));
}
export function cacheMyModeIds(ids: string[]): void {
  localStorage.setItem(MY_MODE_IDS_KEY, JSON.stringify(ids));
}
const isStringList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
type MyLists = {
  mySchemaIds?: unknown;
  myModeIds?: unknown;
  unreadableLists?: unknown;
};
/** Списки профиля, которым можно верить, — источник правды целиком, пустой
 * список тоже: убрал всё на другом устройстве — здесь старый список не
 * переживает загрузку (класс «кэш пережил источник правды», #939). Не верим
 * двум случаям: поля нет (ответ не той формы) и список в `unreadableLists` —
 * он на сервере не расшифровался и пришёл `[]`, это «не прочиталось», а не
 * «пусто»; запись поверх сервер отбивает 409, так что локальный выбор —
 * единственная живая копия. */
export function trustedProfileLists(p: MyLists): {
  mySchemaIds?: string[];
  myModeIds?: string[];
} {
  const bad = Array.isArray(p.unreadableLists) ? p.unreadableLists : [];
  const pick = (k: 'mySchemaIds' | 'myModeIds') => {
    const v = p[k];
    return isStringList(v) && !bad.includes(k) ? v : undefined;
  };
  return { mySchemaIds: pick('mySchemaIds'), myModeIds: pick('myModeIds') };
}
/** Список id из сырой строки localStorage; мусор и не-строки — мимо. */
export function readLocalIds(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}
/** Локальная копия «моих» схем или режимов (хранилище недоступно — пусто). */
export function cachedMyIds(
  key: typeof MY_SCHEMA_IDS_KEY | typeof MY_MODE_IDS_KEY,
): string[] {
  try {
    return readLocalIds(localStorage.getItem(key));
  } catch {
    return [];
  }
}
export function cacheMyPatternsFromProfile(p: MyLists): void {
  const { mySchemaIds, myModeIds } = trustedProfileLists(p);
  if (mySchemaIds) cacheMySchemaIds(mySchemaIds);
  if (myModeIds) cacheMyModeIds(myModeIds);
}
export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';
// Последняя открытая вкладка экрана «Паттерны» (Схемы/Режимы/
// Потребности) — секция размонтируется при переключении нижней навигации и
// без этого ключа каждый возврат сбрасывал вкладку на «Схемы».
export const PATTERNS_LAST_TAB_KEY = 'patterns_last_tab';
// Ручной выбор часового пояса в BookingPicker сайта («не ваш часовой
// пояс?») — переживает возврат на страницу записи.
export const BOOKING_TIME_ZONE_KEY = 'booking_time_zone';
// Флаг стартового режима сайта: '1' — кабинет, '0' — клиент. Единственный писатель — webapp/src/components/appShell/therapistModeCache.ts; читает AccountPage.
export const THERAPIST_MODE_KEY = 'therapist_mode';
export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}
