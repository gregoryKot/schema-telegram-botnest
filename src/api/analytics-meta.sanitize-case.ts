/**
 * Санитизация meta событий разбора случая («Что это было»).
 *
 * Отдельный модуль по образцу analytics-meta.sanitize-screens.ts: основной
 * санитайзер упёрся в размерный храповик, и каждая новая фича обязана
 * приезжать своим файлом, а не раздувать общий (правило №10).
 *
 * Принцип тот же, что во всём санитайзере: всё-или-ничего и только известные
 * поля из allow-list. Свободного текста здесь нет по построению — сцена, имя
 * режима и «своё…» остаются на клиенте и в зашифрованных полях карточки
 * (правило №7): в аналитику уходит только modeId и перечислимые метки.
 */
import type { AnalyticsEventName } from '../analytics/analytics.constants';
import {
  CASE_VERDICT_SET,
  CASE_SCENE_SOURCE_SET,
  MODE_RENAME_SOURCE_SET,
} from '../analytics/case-steps.constants';

/** modeId — тот же формат, что проверяет notes.controller (`[a-z_]{1,64}`). */
const MODE_ID_RE = /^[a-z_]{1,64}$/;

export function sanitizeCaseMeta(
  name: AnalyticsEventName,
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'case_scene') {
    const source = meta.source;
    if (typeof source === 'string' && CASE_SCENE_SOURCE_SET.has(source)) {
      return { source };
    }
    return undefined;
  }
  if (name === 'case_criterion') {
    const verdict = meta.verdict;
    if (typeof verdict === 'string' && CASE_VERDICT_SET.has(verdict)) {
      return { verdict };
    }
    return undefined;
  }
  if (name === 'case_recognized') {
    const modeId = meta.modeId;
    const agreed = meta.agreed;
    if (
      typeof modeId === 'string' &&
      MODE_ID_RE.test(modeId) &&
      typeof agreed === 'boolean'
    ) {
      return { modeId, agreed };
    }
    return undefined;
  }
  if (name === 'mode_renamed') {
    const source = meta.source;
    if (typeof source === 'string' && MODE_RENAME_SOURCE_SET.has(source)) {
      return { source };
    }
    return undefined;
  }
  if (name === 'case_finished') {
    const modeId = meta.modeId;
    if (typeof modeId === 'string' && MODE_ID_RE.test(modeId)) {
      return { modeId };
    }
    return undefined;
  }
  // case_started — без меты, поля отбрасываются.
  return undefined;
}
