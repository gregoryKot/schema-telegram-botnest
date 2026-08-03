// Сборка шаринга «Моего пути»: чистые части — радар дня трекера и выбор
// правильной карточки/текста по типу записи. `draw` НЕ вызываем (canvas
// в jsdom не рисует) — проверяем только собранные данные (title/shareText/
// filename/eventKind), которые видит пользователь до нажатия «Поделиться».
import { describe, it, expect } from 'vitest';
import {
  journeyRadarRows,
  journeyRadarIndex,
  buildJourneySharePayload,
  type JourneyShareState,
} from './journeyShare';
import { JOURNEY_NEED_NAMES } from './journeyMeta';
import { EMPTY_JOURNEY_COUNTS } from './journeyCounts.fixture';
import { journeyStatRows } from './journeyStats';

describe('journeyRadarRows', () => {
  it('пропущенная потребность → value null и «—», а не 0 (нет выдуманных данных)', () => {
    const rows = journeyRadarRows({ attachment: 7 });
    const attachment = rows.find((r) => r.label === JOURNEY_NEED_NAMES.attachment);
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
        ysq: { scores: { Покорность: { pct5plus: 60, avg: 4.5 } }, activeCount: 1 },
      },
    };
    const payload = buildJourneySharePayload(share, [], 0, [], () => null, link);
    expect(payload.filename).toBe('journey-schema-test.png');
    expect(payload.shareText).toContain(link);
  });

  it('есть текстовые части результата → карточка-результат с текстом шага', () => {
    const share: JourneyShareState = {
      kind: 'item',
      item: { type: 'letter', at: '2026-07-20' },
      result: { parts: [{ text: 'Письмо себе' }] },
    };
    const payload = buildJourneySharePayload(share, [], 0, [], () => null, link);
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
