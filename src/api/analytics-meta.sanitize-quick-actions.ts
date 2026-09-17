import {
  QUICK_ACTION_ID_SET,
  QUICK_ACTION_SURFACE_SET,
  QUICK_ACTION_MOVE_DIR_SET,
} from './dto/analytics.dto';

// Санитизация meta для событий быстрых действий: plus_action,
// quick_action_toggle, quick_action_move. Вынесено из
// analytics-meta.sanitize.ts отдельным модулем по тому же поводу, что и
// sanitize-screens.ts — тот файл сверх потолка 300 строк и обязан таять, а не
// расти вместе с числом событий (правило №10). Контракт тот же, что у
// sanitizeMeta: «всё или ничего» по событию. Вызывается только из sanitizeMeta
// с уже проверенным именем и непустой meta.
export function sanitizeQuickActionMeta(
  name: 'plus_action' | 'quick_action_toggle' | 'quick_action_move',
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'plus_action') {
    const action = meta.action;
    if (typeof action === 'string' && QUICK_ACTION_ID_SET.has(action)) {
      return { action };
    }
    return undefined;
  }
  if (name === 'quick_action_toggle') {
    const action = meta.action;
    const hidden = meta.hidden;
    const surface = meta.surface;
    if (
      typeof action === 'string' &&
      QUICK_ACTION_ID_SET.has(action) &&
      typeof hidden === 'boolean' &&
      typeof surface === 'string' &&
      QUICK_ACTION_SURFACE_SET.has(surface)
    ) {
      return { action, hidden, surface };
    }
    return undefined;
  }
  // Последний известный случай — quick_action_move. Отдельной ветки `if` у
  // него нет намеренно: имя проверено типом на входе, и лишний `if` оставил бы
  // после себя недостижимый `return undefined`, который нечем накрыть тестом.
  const action = meta.action;
  const surface = meta.surface;
  const dir = meta.dir;
  if (
    typeof action === 'string' &&
    QUICK_ACTION_ID_SET.has(action) &&
    typeof surface === 'string' &&
    QUICK_ACTION_SURFACE_SET.has(surface) &&
    typeof dir === 'string' &&
    QUICK_ACTION_MOVE_DIR_SET.has(dir)
  ) {
    return { action, surface, dir };
  }
  return undefined;
}
