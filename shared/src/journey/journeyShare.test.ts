// @vitest-environment jsdom
// Сборка шаринга «Моего пути»: чистые части — радар дня трекера и выбор
// правильной карточки/текста по типу записи. `draw` в основном НЕ вызываем
// (canvas в jsdom не рисует) — проверяем собранные данные (title/shareText/
// filename/eventKind), которые видит пользователь до нажатия «Поделиться».
// Исключение — блок «draw делегирует» ниже: сами card-функции замоканы
// (реальную отрисовку/canvas не трогаем), поэтому там `draw()` можно
// безопасно вызвать и проверить, что каждая ветка зовёт СВОЮ карточку с
// правильными данными, а не чужую.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  journeyRadarRows,
  journeyRadarIndex,
  buildJourneySharePayload,
  useJourneyShare,
  type JourneyShareState,
} from './journeyShare';
import { JOURNEY_NEED_NAMES } from './journeyMeta';
import { EMPTY_JOURNEY_COUNTS } from './journeyCounts.fixture';
import { journeyStatRows } from './journeyStats';
import { drawJourneyTotalsCard } from '../share/cards/journeyTotalsCard';
import { drawJourneyCard } from '../share/cards/journeyCard';
import { drawJourneyItemCard } from '../share/cards/journeyItemCard';
import { drawJourneyResultCard } from '../share/cards/journeyResultCard';
import { drawNeedsRadarCard } from '../share/cards/needsRadarCard';
import { drawYsqProfileCard } from '../share/cards/ysqProfileCard';

vi.mock('../share/cards/journeyTotalsCard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../share/cards/journeyTotalsCard')>();
  return { ...actual, drawJourneyTotalsCard: vi.fn() };
});
vi.mock('../share/cards/journeyCard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../share/cards/journeyCard')>();
  return { ...actual, drawJourneyCard: vi.fn() };
});
vi.mock('../share/cards/journeyItemCard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../share/cards/journeyItemCard')>();
  return { ...actual, drawJourneyItemCard: vi.fn() };
});
vi.mock('../share/cards/journeyResultCard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../share/cards/journeyResultCard')>();
  return { ...actual, drawJourneyResultCard: vi.fn() };
});
vi.mock('../share/cards/needsRadarCard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../share/cards/needsRadarCard')>();
  return { ...actual, drawNeedsRadarCard: vi.fn() };
});
vi.mock('../share/cards/ysqProfileCard', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../share/cards/ysqProfileCard')>();
  return { ...actual, drawYsqProfileCard: vi.fn() };
});

describe('journeyRadarRows', () => {
  it('пропущенная потребность → value null и «—», а не 0 (нет выдуманных данных)', () => {
    const rows = journeyRadarRows({ attachment: 7 });
    const attachment = rows.find(
      (r) => r.label === JOURNEY_NEED_NAMES.attachment,
    );
    const autonomy = rows.find((r) => r.label === JOURNEY_NEED_NAMES.autonomy);
    expect(attachment).toMatchObject({ value: 7, valueText: '7' });
    expect(autonomy).toMatchObject({ value: null, valueText: '—' });
  });

  it('без ratings вообще — все пять строк пустые, но присутствуют', () => {
    const rows = journeyRadarRows(undefined);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.value === null)).toBe(true);
  });
});

describe('journeyRadarIndex', () => {
  it('среднее по отмеченным потребностям, округлённое до десятых', () => {
    expect(journeyRadarIndex({ attachment: 8, autonomy: 5 })).toBe('6.5');
  });

  it('без единой оценки — «—», не NaN и не 0', () => {
    expect(journeyRadarIndex(undefined)).toBe('—');
    expect(journeyRadarIndex({})).toBe('—');
  });
});

describe('buildJourneySharePayload — summary', () => {
  const stats = journeyStatRows({ ...EMPTY_JOURNEY_COUNTS, trackerDays: 5 });

  it('за всё время: заголовок «Итоги пути», текст со счётом total', () => {
    const payload = buildJourneySharePayload(
      { kind: 'summary' },
      [],
      5,
      stats,
      () => null,
      'https://t.me/bot',
      'all',
    );
    expect(payload.title).toBe('Итоги пути');
    expect(payload.filename).toBe('journey-totals.png');
    expect(payload.eventKind).toBe('journey');
    expect(payload.shareText).toContain('5 запис');
  });

  it('за период: заголовок периода, счёт по видимым items, не по total', () => {
    const items = [
      { type: 'tracker_day', at: '2026-07-20' },
      { type: 'tracker_day', at: '2026-07-19' },
    ];
    const payload = buildJourneySharePayload(
      { kind: 'summary' },
      items,
      100, // «за всё время» намного больше — не должно попасть в текст
      stats,
      () => null,
      'https://t.me/bot',
      'week',
    );
    expect(payload.title).toBe('Моя неделя');
    expect(payload.filename).toBe('journey-totals-week.png');
    expect(payload.shareText).toContain('2 запис');
    expect(payload.shareText).not.toContain('100');
  });
});

describe('buildJourneySharePayload — feed', () => {
  it('за всё время: файл journey.png, заголовок «Мой путь»', () => {
    const payload = buildJourneySharePayload(
      { kind: 'feed' },
      [{ type: 'note', at: '2026-07-20' }],
      1,
      [],
      () => null,
      'https://t.me/bot',
      'all',
    );
    expect(payload.filename).toBe('journey.png');
    expect(payload.title).toBe('Мой путь');
  });

  it('за месяц: файл с суффиксом периода', () => {
    const payload = buildJourneySharePayload(
      { kind: 'feed' },
      [{ type: 'note', at: '2026-07-20' }],
      1,
      [],
      () => null,
      'https://t.me/bot',
      'month',
    );
    expect(payload.filename).toBe('journey-month.png');
  });
});

describe('buildJourneySharePayload — item', () => {
  const link = 'https://t.me/bot';

  it('tracker_day с ratings → карточка радара, eventKind journey_item', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'tracker_day', at: '2026-07-20' },
      result: { parts: [], ratings: { attachment: 7 } },
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => null,
      link,
    );
    expect(payload.title).toBe('Результат');
    expect(payload.filename).toBe('journey-result.png');
    expect(payload.eventKind).toBe('journey_item');
  });

  it('ysq с профилем схем → карточка профиля, текст содержит ссылку', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'ysq', at: '2026-07-20' },
      result: {
        parts: [],
        ysq: {
          scores: { Покорность: { pct5plus: 60, avg: 4.5 } },
          activeCount: 1,
        },
      },
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => null,
      link,
    );
    expect(payload.filename).toBe('journey-schema-test.png');
    expect(payload.shareText).toContain(link);
  });

  it('есть текстовые части результата → карточка-результат с текстом шага', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'letter', at: '2026-07-20' },
      result: { parts: [{ text: 'Письмо себе' }] },
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => null,
      link,
    );
    expect(payload.title).toBe('Результат');
    expect(payload.filename).toBe('journey-result.png');
  });

  it('нет результата (не расшифровано/не найдено) → карточка шага с подзаголовком', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'note', at: '2026-07-20' },
      result: null,
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => 'подсказка',
      link,
    );
    expect(payload.title).toBe('Шаг пути');
    expect(payload.filename).toBe('journey-step.png');
  });
});

describe('buildJourneySharePayload — payload.draw делегирует в правильную карточку', () => {
  const link = 'https://t.me/bot';
  const fakeCanvas = document.createElement('canvas');

  it('summary: рисует drawJourneyTotalsCard, а не drawJourneyCard', () => {
    const stats = journeyStatRows({ ...EMPTY_JOURNEY_COUNTS, trackerDays: 5 });
    const payload = buildJourneySharePayload(
      { kind: 'summary' },
      [],
      5,
      stats,
      () => null,
      link,
      'all',
    );
    payload.draw(fakeCanvas);
    expect(drawJourneyTotalsCard).toHaveBeenCalledWith(fakeCanvas, stats, 5, {
      title: undefined,
      subtitle: undefined,
    });
    expect(drawJourneyCard).not.toHaveBeenCalled();
  });

  it('summary за период: заголовок/подзаголовок периода уходят в карточку', () => {
    const items = [{ type: 'gratitude', at: '2026-07-20' }];
    const payload = buildJourneySharePayload(
      { kind: 'summary' },
      items,
      100,
      [],
      () => null,
      link,
      'week',
    );
    payload.draw(fakeCanvas);
    expect(drawJourneyTotalsCard).toHaveBeenCalledWith(
      fakeCanvas,
      expect.any(Array),
      1, // счёт по видимым items за неделю, не по total=100
      {
        title: 'Моя неделя',
        subtitle: expect.stringContaining('сколько чего накопилось'),
      },
    );
  });

  it('feed: рисует drawJourneyCard с рядами и заголовком периода', () => {
    const items = [{ type: 'note', at: '2026-07-20' }];
    const payload = buildJourneySharePayload(
      { kind: 'feed' },
      items,
      1,
      [],
      () => null,
      link,
      'all',
    );
    payload.draw(fakeCanvas);
    expect(drawJourneyCard).toHaveBeenCalledWith(
      fakeCanvas,
      expect.any(Array),
      1,
      'Мой путь',
      undefined,
    );
  });

  it('item tracker_day с ratings: рисует drawNeedsRadarCard, не drawJourneyResultCard', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'tracker_day', at: '2026-07-20' },
      result: { parts: [], ratings: { attachment: 7, autonomy: 3 } },
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => null,
      link,
    );
    payload.draw(fakeCanvas);
    expect(drawNeedsRadarCard).toHaveBeenCalledWith(
      fakeCanvas,
      expect.objectContaining({
        eyebrow: 'Трекер потребностей',
        title: 'Мой день',
        center: { value: '5.0', caption: 'индекс' },
      }),
    );
    expect(drawJourneyResultCard).not.toHaveBeenCalled();
  });

  it('item ysq с профилем схем: рисует drawYsqProfileCard с headline и датой', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'ysq', at: '2026-07-20' },
      result: {
        parts: [],
        ysq: {
          scores: { Покорность: { pct5plus: 60, avg: 4.5 } },
          activeCount: 1,
        },
      },
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => null,
      link,
    );
    payload.draw(fakeCanvas);
    expect(drawYsqProfileCard).toHaveBeenCalledTimes(1);
    const [canvasArg, domainsArg, optsArg] = (
      drawYsqProfileCard as unknown as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(canvasArg).toBe(fakeCanvas);
    expect(Array.isArray(domainsArg)).toBe(true);
    expect(optsArg.dateLabel).toBeTruthy();
  });

  it('item с текстовыми частями результата: рисует drawJourneyResultCard с частями', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'letter', at: '2026-07-20' },
      result: { parts: [{ text: 'Письмо себе' }] },
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => null,
      link,
    );
    payload.draw(fakeCanvas);
    expect(drawJourneyResultCard).toHaveBeenCalledWith(
      fakeCanvas,
      expect.objectContaining({ parts: [{ text: 'Письмо себе' }] }),
    );
  });

  it('item без результата: рисует drawJourneyItemCard с подзаголовком из subtitle()', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'note', at: '2026-07-20' },
      result: null,
    };
    const payload = buildJourneySharePayload(
      share,
      [],
      0,
      [],
      () => 'подсказка',
      link,
    );
    payload.draw(fakeCanvas);
    expect(drawJourneyItemCard).toHaveBeenCalledWith(
      fakeCanvas,
      expect.objectContaining({ sub: 'подсказка' }),
    );
  });
});

describe('useJourneyShare', () => {
  const j = {
    items: [{ type: 'note', at: '2026-07-20' }],
    total: 1,
    stats: [],
    period: 'all' as const,
  };
  const subtitle = () => null;
  const link = 'https://t.me/bot';

  it('изначально шит закрыт (payload=null)', () => {
    const { result } = renderHook(() =>
      useJourneyShare(j, subtitle, link, vi.fn()),
    );
    expect(result.current.payload).toBeNull();
  });

  it('shareSummary() открывает шит с payload итогов, close() закрывает', () => {
    const { result } = renderHook(() =>
      useJourneyShare(j, subtitle, link, vi.fn()),
    );
    act(() => result.current.shareSummary());
    expect(result.current.payload?.title).toBe('Итоги пути');

    act(() => result.current.close());
    expect(result.current.payload).toBeNull();
  });

  it('shareFeed() открывает шит с payload ленты', () => {
    const { result } = renderHook(() =>
      useJourneyShare(j, subtitle, link, vi.fn()),
    );
    act(() => result.current.shareFeed());
    expect(result.current.payload?.title).toBe('Мой путь');
    expect(result.current.payload?.filename).toBe('journey.png');
  });

  it('shareItem() сначала тянет содержимое записи, потом открывает шит с найденным результатом', async () => {
    const item = { type: 'letter', at: '2026-07-20', id: 3 };
    const fetchResult = vi
      .fn()
      .mockResolvedValue({ parts: [{ text: 'Письмо себе' }] });
    const { result } = renderHook(() =>
      useJourneyShare(j, subtitle, link, fetchResult),
    );

    act(() => result.current.shareItem(item));
    // До резолва промиса шит ещё не открыт — не «мгновенная» подмена данных.
    expect(result.current.payload).toBeNull();

    await waitFor(() => expect(result.current.payload).not.toBeNull());
    expect(fetchResult).toHaveBeenCalledWith(item);
    expect(result.current.payload?.title).toBe('Результат');
  });

  it('shareItem(): ошибка загрузки записи не роняет шит — открывается карточка шага без результата', async () => {
    const item = { type: 'note', at: '2026-07-20' };
    const fetchResult = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = renderHook(() =>
      useJourneyShare(j, subtitle, link, fetchResult),
    );

    act(() => result.current.shareItem(item));
    await waitFor(() => expect(result.current.payload).not.toBeNull());
    expect(result.current.payload?.title).toBe('Шаг пути');
  });
});
