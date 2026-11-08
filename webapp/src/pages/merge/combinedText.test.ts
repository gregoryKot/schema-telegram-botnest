// R3 (аудит 2026-11): абзац экрана слияния про записи, которые объединятся.
import { describe, it, expect } from 'vitest';
import { combinedText } from './combinedText';

const ty = (t: string) => t;
const vy = (_t: string, v: string) => v;

describe('combinedText', () => {
  it('нет совпадающих записей — абзаца нет', () => {
    expect(combinedText(0, ty)).toBeNull();
    expect(combinedText(-1, ty)).toBeNull();
  });

  it.each([
    [1, '1 запись совпадает'],
    [2, '2 записи совпадают'],
    [5, '5 записей совпадают'],
    [21, '21 запись совпадает'],
  ])('%i — число и глагол согласованы: «%s»', (n, head) => {
    expect(combinedText(n, ty)).toMatch(new RegExp(`^${head} с твоими`));
  });

  it('называет, что станет с каждым видом записей', () => {
    const text = combinedText(2, ty) ?? '';
    expect(text).toContain('объединится в одну');
    expect(text).toContain('Заметки и благодарности за день сложатся');
    expect(text).toContain('заполнятся только пустые поля');
    expect(text).toContain('прежний результат теста сохранится в истории');
  });

  it('форма «вы» — «с вашими»', () => {
    expect(combinedText(2, vy)).toMatch(/^2 записи совпадают с вашими/);
  });
});
