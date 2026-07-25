import { describe, it, expect } from 'vitest';
import {
  buildJourneyDetailParts,
  buildJourneyResultParts,
} from '../../../shared/src/journey/journeyContent';

describe('buildJourneyDetailParts — детальный просмотр (все поля, без обрезки)', () => {
  it('дневник режима: возвращает ВСЕ заполненные поля с заголовками', () => {
    const entry = {
      situation: 'позвонил папа',
      thoughts: 'не лезь',
      feelings: 'пустота',
      bodyFeelings: 'тяжесть в груди',
      actions: 'свернул разговор',
      actualNeed: 'тепло',
      childhoodMemories: 'мама уставала',
      healthyResponse: 'мне можно',
    };
    const parts = buildJourneyDetailParts('mode_diary', entry);
    expect(parts.map((p) => p.title)).toEqual([
      'Ситуация',
      'Мысли',
      'Чувства',
      'Тело',
      'Действия',
      'Что было нужно',
      'Воспоминания',
      'Здоровый Взрослый',
    ]);
    expect(parts.find((p) => p.title === 'Здоровый Взрослый')?.text).toBe(
      'мне можно',
    );
  });

  it('пропускает пустые поля', () => {
    const parts = buildJourneyDetailParts('mode_diary', {
      situation: 'x',
      thoughts: '',
    });
    expect(parts).toHaveLength(1);
    expect(parts[0].title).toBe('Ситуация');
  });

  it('НЕ обрезает длинный текст (в отличие от карточки)', () => {
    const long = 'а'.repeat(300);
    const detail = buildJourneyDetailParts('letter', { text: long });
    const card = buildJourneyResultParts('letter', { text: long });
    expect(detail[0].text).toHaveLength(300);
    expect(detail[0].title).toBeUndefined();
    expect(card[0].text.length).toBeLessThan(300); // карточка обрезает
  });

  it('благодарность: все пункты, а не первые 3', () => {
    const parts = buildJourneyDetailParts('gratitude', {
      items: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(parts).toHaveLength(5);
  });

  it('пустая/битая запись → []', () => {
    expect(buildJourneyDetailParts('mode_diary', null)).toEqual([]);
    expect(buildJourneyDetailParts('unknown_type', { x: 1 })).toEqual([]);
  });
});
