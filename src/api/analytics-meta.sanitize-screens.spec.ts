// Юнит-тест sanitizeScreenMeta — санитизация meta для screen_*-событий
// «Настроить экран» (Профиль/Паттерны), вынесенных из analytics-meta.sanitize.ts
// отдельным модулем (правило №10). Связка с sanitizeMeta (что контроллер
// реально доходит досюда) — смоук-тест в analytics-meta.sanitize.spec.ts.
import { sanitizeScreenMeta } from './analytics-meta.sanitize-screens';

describe('sanitizeScreenMeta', () => {
  it('screen_customize_open: screen + via из allow-list проходят', () => {
    expect(
      sanitizeScreenMeta('screen_customize_open', {
        screen: 'profile',
        via: 'gear',
      }),
    ).toEqual({ screen: 'profile', via: 'gear' });
    expect(
      sanitizeScreenMeta('screen_customize_open', {
        screen: 'patterns',
        via: 'longpress',
      }),
    ).toEqual({ screen: 'patterns', via: 'longpress' });
  });

  it('screen_customize_open: неизвестный screen → отброшено целиком', () => {
    expect(
      sanitizeScreenMeta('screen_customize_open', {
        screen: 'evil',
        via: 'gear',
      }),
    ).toBeUndefined();
  });

  it('screen_customize_open: неизвестный/отсутствующий via → отброшено', () => {
    expect(
      sanitizeScreenMeta('screen_customize_open', {
        screen: 'profile',
        via: 'evil',
      }),
    ).toBeUndefined();
    expect(
      sanitizeScreenMeta('screen_customize_open', { screen: 'profile' }),
    ).toBeUndefined();
  });

  it('screen_customize_open: лишние поля срезаются (защита от PII)', () => {
    expect(
      sanitizeScreenMeta('screen_customize_open', {
        screen: 'profile',
        via: 'gear',
        note: 'секретный текст пользователя',
      }),
    ).toEqual({ screen: 'profile', via: 'gear' });
  });

  it('screen_block_toggle: screen + block + hidden из allow-list проходят', () => {
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'profile',
        block: 'streak',
        hidden: true,
      }),
    ).toEqual({ screen: 'profile', block: 'streak', hidden: true });
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'patterns',
        block: 'heatmap',
        hidden: false,
      }),
    ).toEqual({ screen: 'patterns', block: 'heatmap', hidden: false });
  });

  it('screen_block_toggle: неизвестный screen → отброшено целиком', () => {
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'evil',
        block: 'streak',
        hidden: true,
      }),
    ).toBeUndefined();
  });

  it('screen_block_toggle: неизвестный block → отброшено целиком', () => {
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'profile',
        block: 'evil',
        hidden: true,
      }),
    ).toBeUndefined();
  });

  it('screen_block_toggle: hidden не boolean → отброшено', () => {
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'profile',
        block: 'streak',
        hidden: 'yes',
      }),
    ).toBeUndefined();
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'profile',
        block: 'streak',
      }),
    ).toBeUndefined();
  });

  it('screen_block_toggle: лишние поля срезаются (защита от PII)', () => {
    expect(
      sanitizeScreenMeta('screen_block_toggle', {
        screen: 'profile',
        block: 'insights',
        hidden: true,
        note: 'секретный текст пользователя',
      }),
    ).toEqual({ screen: 'profile', block: 'insights', hidden: true });
  });

  it('screen_block_move: screen + block + dir (up/down) из allow-list проходят', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'profile',
        block: 'streak',
        dir: 'up',
      }),
    ).toEqual({ screen: 'profile', block: 'streak', dir: 'up' });
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'patterns',
        block: 'heatmap',
        dir: 'down',
      }),
    ).toEqual({ screen: 'patterns', block: 'heatmap', dir: 'down' });
  });

  it('screen_block_move: неизвестный screen → отброшено целиком', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'evil',
        block: 'streak',
        dir: 'up',
      }),
    ).toBeUndefined();
  });

  it('screen_block_move: неизвестный block → отброшено целиком', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'profile',
        block: 'evil',
        dir: 'up',
      }),
    ).toBeUndefined();
  });

  it('screen_block_move: невалидный/отсутствующий dir → отброшено', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'profile',
        block: 'streak',
        dir: 'sideways',
      }),
    ).toBeUndefined();
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'profile',
        block: 'streak',
      }),
    ).toBeUndefined();
  });

  it('screen_block_move: screen="today" + новый блок «Сегодня» проходит (только move реально шлётся с today)', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'today',
        block: 'focus',
        dir: 'up',
      }),
    ).toEqual({ screen: 'today', block: 'focus', dir: 'up' });
  });

  it('screen_block_move: screen="today" + неизвестный block → отброшено целиком', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'today',
        block: 'мусор',
        dir: 'up',
      }),
    ).toBeUndefined();
  });

  it('screen_block_move: лишние поля срезаются (защита от PII)', () => {
    expect(
      sanitizeScreenMeta('screen_block_move', {
        screen: 'profile',
        block: 'insights',
        dir: 'down',
        note: 'секретный текст пользователя',
      }),
    ).toEqual({ screen: 'profile', block: 'insights', dir: 'down' });
  });
});
