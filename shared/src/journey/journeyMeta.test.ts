// Тест новых типов ленты «Мой путь» — три быстрые практики (дыхание,
// заземление, «Стоп»), добавленные вместе с shared/src/practices. Полное
// покрытие остального journeyMeta — в schema-miniapp/src/share/journeyMeta.test.ts
// (зеркалит эти же чистые функции, см. cardKit.test.ts про раздельные тесты).
import { describe, it, expect } from 'vitest';
import { JOURNEY_TYPE_META, journeyTypeMeta } from './journeyMeta';

describe('JOURNEY_TYPE_META — быстрые практики', () => {
  it('breathing: эмодзи, подпись, группа exercise', () => {
    expect(JOURNEY_TYPE_META.breathing).toEqual({
      emoji: '🌬',
      label: 'Дыхание',
      group: 'exercise',
    });
  });

  it('grounding: эмодзи, подпись, группа exercise', () => {
    expect(JOURNEY_TYPE_META.grounding).toEqual({
      emoji: '🌍',
      label: 'Заземление 5-4-3-2-1',
      group: 'exercise',
    });
  });

  it('stop: эмодзи, подпись, группа exercise', () => {
    expect(JOURNEY_TYPE_META.stop).toEqual({
      emoji: '🛑',
      label: 'Техника «Стоп»',
      group: 'exercise',
    });
  });

  it('journeyTypeMeta находит все три по ключу (не фолбэк)', () => {
    expect(journeyTypeMeta('breathing').label).toBe('Дыхание');
    expect(journeyTypeMeta('grounding').label).toBe('Заземление 5-4-3-2-1');
    expect(journeyTypeMeta('stop').label).toBe('Техника «Стоп»');
  });
});
