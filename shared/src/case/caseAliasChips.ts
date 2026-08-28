/**
 * Заготовки имени части на шаге name — из подписи чипа порыва, который
 * человек выбрал на шаге impulse (например «Свернуть разговор» → «Стена»,
 * пример из shared/src/mode/modeDisplayName.ts). Только подсказка: человек
 * может выбрать своё слово или пропустить шаг целиком — имя даёт он, не мы.
 *
 * 'impulse_own' сознательно без пары: «своё» уже текст человека, вторая
 * заготовка поверх него не нужна.
 *
 * Один источник для webapp/schema-miniapp (правило №3 CLAUDE.md) — константа
 * не завязана ни на один платформенный модуль.
 */
export const CASE_ALIAS_CHIPS: Record<string, string> = {
  impulse_close: 'Стена',
  impulse_phone: 'Побег',
  impulse_silence: 'Тихоня',
  impulse_perfect: 'Гонщик',
  impulse_sharp: 'Вспышка',
  impulse_postpone: 'Тормоз',
  impulse_agree: 'Угодник',
};
