// Тест practiceShareText — единственная функция shareTexts.ts, у которой
// раньше не было прямого теста в shared (остальные покрыты через
// schema-miniapp/src/share/shareTexts.test.ts, зеркалящий эти же чистые
// функции — см. cardKit.test.ts про тот же принцип раздельных прямых тестов).
import { describe, it, expect } from 'vitest';
import { practiceShareText, modeEntryFullShareText } from './shareTexts';

describe('practiceShareText', () => {
  it('со счётчиком: заголовок и счётчик в тексте', () => {
    const text = practiceShareText('Дыхание 4-4-6', 'прошли 7 раз');
    expect(text).toContain('Дыхание 4-4-6');
    expect(text).toContain('прошли 7 раз');
  });

  it('без счётчика (null): без хвоста-счётчика, без падения', () => {
    const text = practiceShareText('Техника «Стоп»', null);
    expect(text).toContain('Техника «Стоп»');
    expect(text).not.toContain('null');
  });

  it('со ссылкой: ссылка попадает в текст', () => {
    const text = practiceShareText(
      'Заземление 5-4-3-2-1',
      null,
      't.me/TestBot',
    );
    expect(text).toContain('t.me/TestBot');
  });

  it('без ссылки: текст короткий, без пустого хвоста', () => {
    const text = practiceShareText('Дыхание 4-4-6', null);
    expect(text.trim().endsWith('.')).toBe(true);
  });
});

describe('modeEntryFullShareText', () => {
  it('без текста записи в сообщении (текст на картинке), ссылка на месте', () => {
    const text = modeEntryFullShareText('t.me/TestBot');
    expect(text).toContain('🌿');
    expect(text).toContain('t.me/TestBot');
  });
});
