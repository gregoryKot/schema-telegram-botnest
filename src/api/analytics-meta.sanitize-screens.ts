import {
  CUSTOMIZABLE_SCREEN_SET,
  CUSTOMIZE_ENTRY_SET,
  SCREEN_BLOCK_ID_SET,
  QUICK_ACTION_MOVE_DIR_SET,
} from './dto/analytics.dto';

// Санитизация meta для screen_*-событий «Настроить экран» (Профиль/
// Паттерны): screen_customize_open, screen_block_toggle, screen_block_move.
// Вынесено из analytics-meta.sanitize.ts отдельным модулем — тот файл упёрся
// в потолок 300 строк (правило №10). Контракт тот же, что у sanitizeMeta:
// «всё или ничего» по событию. Вызывается только из sanitizeMeta с уже
// проверенным именем и непустой meta.
export function sanitizeScreenMeta(
  name: 'screen_customize_open' | 'screen_block_toggle' | 'screen_block_move',
  meta: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (name === 'screen_customize_open') {
    const screen = meta.screen;
    const via = meta.via;
    if (
      typeof screen === 'string' &&
      CUSTOMIZABLE_SCREEN_SET.has(screen) &&
      typeof via === 'string' &&
      CUSTOMIZE_ENTRY_SET.has(via)
    ) {
      return { screen, via };
    }
    return undefined;
  }
  if (name === 'screen_block_toggle') {
    const screen = meta.screen;
    const block = meta.block;
    const hidden = meta.hidden;
    if (
      typeof screen === 'string' &&
      CUSTOMIZABLE_SCREEN_SET.has(screen) &&
      typeof block === 'string' &&
      SCREEN_BLOCK_ID_SET.has(block) &&
      typeof hidden === 'boolean'
    ) {
      return { screen, block, hidden };
    }
    return undefined;
  }
  // screen_block_move
  const screen = meta.screen;
  const block = meta.block;
  const dir = meta.dir;
  if (
    typeof screen === 'string' &&
    CUSTOMIZABLE_SCREEN_SET.has(screen) &&
    typeof block === 'string' &&
    SCREEN_BLOCK_ID_SET.has(block) &&
    typeof dir === 'string' &&
    QUICK_ACTION_MOVE_DIR_SET.has(dir)
  ) {
    return { screen, block, dir };
  }
  return undefined;
}
