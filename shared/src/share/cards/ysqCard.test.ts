// Карточка результата теста на схемы — текстовые билдеры (canvas — в
// ysqProfileCard.test аналоге, не здесь). Проверяем склонение «схема/схемы/
// схем» и нулевое состояние (тест пройден, но ни одна схема не выражена).
import { describe, it, expect } from 'vitest';
import { pluralActiveSchemas, buildYsqShareText, ysqCardHeadline, ysqShareCard } from './ysqCard';

describe('pluralActiveSchemas', () => {
  it('1 — единственное число', () => {
    expect(pluralActiveSchemas(1)).toBe('выраженная схема');
  });

  it('2-4 — «схемы»', () => {
    expect(pluralActiveSchemas(2)).toBe('выраженные схемы');
    expect(pluralActiveSchemas(4)).toBe('выраженные схемы');
  });

  it('0 и 5+ — «схем»', () => {
    expect(pluralActiveSchemas(0)).toBe('выраженных схем');
    expect(pluralActiveSchemas(11)).toBe('выраженных схем');
    expect(pluralActiveSchemas(20)).toBe('выраженных схем');
  });
});

describe('buildYsqShareText', () => {
  it('0 выраженных схем — отдельная нейтральная формулировка, не «0 схем»', () => {
    expect(buildYsqShareText(0, 'link')).toContain('не обнаружено');
    expect(buildYsqShareText(0, 'link')).not.toContain('0 ');
  });

  it('ненулевой счёт — число + правильное склонение + ссылка', () => {
    const text = buildYsqShareText(3, 'https://t.me/bot');
    expect(text).toContain('3 выраженные схемы из 20');
    expect(text).toContain('https://t.me/bot');
  });
});

describe('ysqCardHeadline', () => {
  it('0 — «не обнаружено»', () => {
    expect(ysqCardHeadline(0)).toBe('Выраженных схем не обнаружено');
  });

  it('ненулевой — «N из 20» с верным словом', () => {
    expect(ysqCardHeadline(1)).toBe('1 выраженная схема из 20');
  });
});

describe('ysqShareCard', () => {
  it('собирает готовые пропсы для ShareCardSheet', () => {
    const card = ysqShareCard(
      { Покорность: { pct5plus: 60, avg: 4.5 } },
      { activeCount: 1, dateLabel: '17 июля' },
      'https://t.me/bot',
    );
    expect(card.title).toBe('Результат теста');
    expect(card.filename).toBe('schema-test.png');
    expect(card.eventKind).toBe('ysq');
    expect(card.shareText).toContain('https://t.me/bot');
    expect(typeof card.draw).toBe('function');
  });
});
