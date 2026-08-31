/**
 * События потока «Разбор случая» — новой точки входа приложения.
 *
 * Вынесены отдельным файлом, а не дописаны в analytics.constants.ts: тот
 * упёрся в размерный храповик (правило №10), и каждая новая фича не имеет
 * права раздувать его дальше. Тот же приём, что у screen-blocks.constants.ts
 * и quick-actions.constants.ts — реестр живёт рядом со своей фичей, общий
 * список только спредит его.
 *
 * Парные константы фронта — shared/src/share/analytics.ts; ветка санитайзера —
 * src/api/analytics-meta.sanitize-case.ts. В мету не попадает ни одной строки
 * свободного текста: сцена, имя режима и «своё…» остаются на клиенте и в
 * зашифрованных полях (правило №7).
 */

/** Имена событий разбора — спредятся в ANALYTICS_EVENTS. */
export const CASE_EVENTS = [
  // Открыт поток разбора.
  'case_started',
  // Сцена написана: своими словами или от готовой рамки.
  'case_scene',
  // Микроопрос критерия пройден, получен вердикт.
  'case_criterion',
  // Экран узнавания показан; agreed = false, когда человек нажал
  // «У меня было иначе» — это индикатор эффекта Барнума, а не ошибка.
  'case_recognized',
  // Человек назвал часть своим словом (или пропустил шаг).
  'mode_renamed',
  // Разбор доведён до конца.
  'case_finished',
] as const;

export type CaseEventName = (typeof CASE_EVENTS)[number];

/** Вердикт критерия Jacob — совпадает с CaseVerdict в shared/src/case. */
export const CASE_VERDICTS = ['mode', 'ordinary', 'borderline'] as const;

/** Откуда взялась сцена: свой текст или дописанная рамка. */
export const CASE_SCENE_SOURCES = ['own', 'frame'] as const;

/** Откуда взялось имя режима: чип-заготовка, своё слово или пропуск. */
export const MODE_RENAME_SOURCES = ['chip', 'own', 'skipped'] as const;

export const CASE_VERDICT_SET: ReadonlySet<string> = new Set(CASE_VERDICTS);
export const CASE_SCENE_SOURCE_SET: ReadonlySet<string> = new Set(
  CASE_SCENE_SOURCES,
);
export const MODE_RENAME_SOURCE_SET: ReadonlySet<string> = new Set(
  MODE_RENAME_SOURCES,
);
