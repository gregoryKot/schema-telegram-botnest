// Тест сборки данных радара трекера для карточки шага «Мой путь»: оценки дня
// → строки радара + индекс в центре. Пустые/частичные оценки — без выдуманных
// чисел (правило «никаких заглушек вместо данных»).
import { describe, it, expect } from 'vitest';
import {
  journeyRadarRows,
  journeyRadarIndex,
} from '../../../shared/src/journey/journeyShare';
import { JOURNEY_NEED_NAMES } from '../../../shared/src/journey/journeyMeta';

describe('journeyRadarRows', () => {
  it('без оценок — все вершины пустые, «—» вместо чисел', () => {
    const rows = journeyRadarRows(undefined);
    expect(rows).toHaveLength(Object.keys(JOURNEY_NEED_NAMES).length);
    expect(rows.every((r) => r.value === null && r.valueText === '—')).toBe(
      true,
    );
  });

  it('частичные оценки — отмеченные с числом, остальные «—»', () => {
    const rows = journeyRadarRows({ attachment: 7 });
    const attachment = rows.find((r) => r.label === 'Привязанность');
    const autonomy = rows.find((r) => r.label === 'Автономия');
    expect(attachment).toMatchObject({ value: 7, valueText: '7' });
    expect(autonomy).toMatchObject({ value: null, valueText: '—' });
  });

  it('порядок строк — как в JOURNEY_NEED_NAMES/COLORS', () => {
    const rows = journeyRadarRows({});
    expect(rows.map((r) => r.label)).toEqual(Object.values(JOURNEY_NEED_NAMES));
  });
});

describe('journeyRadarIndex', () => {
  it('без оценок → «—»', () => {
    expect(journeyRadarIndex(undefined)).toBe('—');
    expect(journeyRadarIndex({})).toBe('—');
  });

  it('среднее только по отмеченным потребностям', () => {
    expect(journeyRadarIndex({ attachment: 6, autonomy: 8 })).toBe('7.0');
    expect(journeyRadarIndex({ attachment: 5 })).toBe('5.0');
  });
});
