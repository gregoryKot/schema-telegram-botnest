// Карточка дня трекера — чистые части (индекс дня, текст шаринга, строки
// радара). drawDayCard/makeDayShare.draw не вызываем — canvas не рисуем,
// но makeDayShare проверяем как объект пропсов (title/shareText/filename).
import { describe, it, expect } from 'vitest';
import {
  dayIndex,
  buildDayShareText,
  dayRadarRows,
  makeDayShare,
} from './dayCard';
import type { Need } from '../../types';

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автоном.' },
];

describe('dayIndex', () => {
  it('среднее по отмеченным потребностям', () => {
    expect(dayIndex(NEEDS, { attachment: 8, autonomy: 4 })).toBe(6);
  });

  it('без единой оценки — null, не 0 (нет данных ≠ ноль)', () => {
    expect(dayIndex(NEEDS, {})).toBeNull();
  });

  it('частичные оценки считаются только по отмеченным', () => {
    expect(dayIndex(NEEDS, { attachment: 10 })).toBe(10);
  });
});

describe('buildDayShareText', () => {
  it('индекс с одним знаком после запятой и дата в тексте', () => {
    const text = buildDayShareText(
      NEEDS,
      { attachment: 7, autonomy: 4 },
      '17 июл',
      'https://t.me/bot',
    );
    expect(text).toContain('17 июл');
    expect(text).toContain('5.5/10');
    expect(text).toContain('https://t.me/bot');
  });

  it('без оценок — «—» вместо выдуманного числа', () => {
    expect(buildDayShareText(NEEDS, {}, '17 июл', 'link')).toContain('—/10');
  });
});

describe('dayRadarRows', () => {
  it('пропущенная потребность → value null и valueText «—»', () => {
    const rows = dayRadarRows(NEEDS, { attachment: 9 });
    expect(rows[0]).toMatchObject({ value: 9, valueText: '9' });
    expect(rows[1]).toMatchObject({ value: null, valueText: '—' });
  });
});

describe('makeDayShare', () => {
  it('собирает готовые пропсы карточки дня', () => {
    const share = makeDayShare(
      NEEDS,
      { attachment: 5 },
      '17 июл',
      'https://t.me/bot',
    );
    expect(share.title).toBe('Карточка дня');
    expect(share.filename).toBe('needs-day.png');
    expect(share.eventKind).toBe('day');
    expect(share.shareText).toContain('17 июл');
    expect(typeof share.draw).toBe('function');
  });
});
