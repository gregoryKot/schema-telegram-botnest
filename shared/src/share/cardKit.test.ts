// Тесты чистой логики кита карточек: перенос/обрезка строк (wrapLines,
// clampLines) — то, что реально тестируется без canvas 2d-контекста (jsdom
// его не реализует; resolveCardTheme/beginCard/draw* остаются непокрытыми).
// Кейсы зеркалили тест удалённого мини-аппа — это отдельный
// прямой тест той же shared-функции, не перенос существующего теста.
import { describe, it, expect } from 'vitest';
import { wrapLines, clampLines, wrapClamp, cardFont, SANS } from './cardKit';

const measure = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('пустой текст → пусто', () => {
    expect(wrapLines(measure, '', 100)).toEqual([]);
    expect(wrapLines(measure, '   ', 100)).toEqual([]);
  });

  it('короткая строка не переносится', () => {
    expect(wrapLines(measure, 'один два', 100)).toEqual(['один два']);
  });

  it('переносит по словам при переполнении', () => {
    expect(wrapLines(measure, 'aaaa bbbb cccc', 60)).toEqual([
      'aaaa',
      'bbbb',
      'cccc',
    ]);
  });

  it('слово длиннее строки остаётся одной строкой (не режется)', () => {
    expect(wrapLines(measure, 'сверхдлинноеслово да', 50)).toEqual([
      'сверхдлинноеслово',
      'да',
    ]);
  });

  it('схлопывает множественные пробелы и переводы строк', () => {
    expect(wrapLines(measure, 'a  b\nc', 1000)).toEqual(['a b c']);
  });

  it('неразрывный пробел строку не рвёт: предлог уходит со своим словом', () => {
    expect(wrapLines(measure, 'Приглашение от терапевта', 150)).toEqual([
      'Приглашение',
      'от терапевта',
    ]);
  });
});

describe('clampLines', () => {
  it('не трогает список короче лимита', () => {
    expect(clampLines(['a', 'b'], 3)).toEqual(['a', 'b']);
  });

  it('обрезает и ставит многоточие', () => {
    expect(clampLines(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b…']);
  });

  it('заменяет конечную пунктуацию на многоточие', () => {
    expect(clampLines(['начало', 'конец,', 'хвост'], 2)).toEqual([
      'начало',
      'конец…',
    ]);
  });
});

describe('cardFont', () => {
  it('без веса — обычный шрифт', () => {
    expect(cardFont(14)).toBe(`14px ${SANS}`);
    expect(SANS.startsWith("'Manrope'")).toBe(true);
  });

  it('bold — с префиксом bold', () => {
    expect(cardFont(14, 'bold')).toBe(`bold 14px ${SANS}`);
  });
});

describe('wrapClamp — многоточие в поле', () => {
  const measure = (s: string) => s.length * 10;
  it('последняя строка с «…» не шире поля: слова снимаются с конца', () => {
    const lines = wrapClamp(
      measure,
      'вдох короче выдоха так тело получает сигнал что опасность прошла',
      100,
      2,
    );
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(100);
  });
  it('текст влезает — без многоточия', () => {
    expect(wrapClamp(measure, 'коротко', 100, 2)).toEqual(['коротко']);
  });
});
