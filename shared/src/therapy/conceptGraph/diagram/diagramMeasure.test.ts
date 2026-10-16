import { describe, it, expect } from 'vitest';
import { measureNode, wrapLines } from './diagramMeasure';

describe('wrapLines', () => {
  it('короткий текст — одна строка, пустой тоже', () => {
    expect(wrapLines('слово', 20)).toBe(1);
    expect(wrapLines('', 20)).toBe(1);
  });

  it('жадный перенос по словам', () => {
    // «aaaa bbbb» = 9 букв, «cccc» не помещается рядом
    expect(wrapLines('aaaa bbbb cccc', 9)).toBe(2);
    expect(wrapLines('aaaa bbbb cccc dddd', 9)).toBe(2);
    expect(wrapLines('aaaa bbbb cccc dddd eeee', 9)).toBe(3);
  });

  it('слово длиннее строки рвётся и добавляет строки', () => {
    expect(wrapLines('x'.repeat(25), 10)).toBe(3);
    expect(wrapLines('ab ' + 'x'.repeat(25), 10)).toBe(4);
  });

  it('перенос строки в тексте начинает новый абзац', () => {
    expect(wrapLines('раз\nдва\nтри', 20)).toBe(3);
  });

  it('нулевая или отрицательная ширина не зацикливает счёт', () => {
    expect(wrapLines('два слова', 0)).toBeGreaterThanOrEqual(2);
  });
});

describe('measureNode', () => {
  const node = (body: string) => ({
    shape: 'rounded' as const,
    label: 'Название',
    body,
  });

  it('высота растёт с длиной текста и упирается в лимит строк', () => {
    const short = measureNode(node('коротко'), 230, 6, 0);
    const mid = measureNode(node('слово '.repeat(30)), 230, 6, 0);
    const huge = measureNode(node('слово '.repeat(400)), 230, 6, 0);
    const huger = measureNode(node('слово '.repeat(900)), 230, 6, 0);
    expect(mid.h).toBeGreaterThan(short.h);
    expect(huge.bodyLines).toBe(6);
    expect(huge.h).toBeGreaterThanOrEqual(mid.h);
    expect(huger.h).toBe(huge.h);
  });

  it('узкая фигура даёт больше строк, чем широкая', () => {
    const text = 'слово '.repeat(20);
    expect(measureNode(node(text), 160, 8, 0).bodyLines).toBeGreaterThan(
      measureNode(node(text), 300, 8, 0).bodyLines,
    );
  });

  it('эллипс при том же тексте выше прямоугольника: в контур вписывается меньше', () => {
    const text = 'слово '.repeat(15);
    const rect = measureNode({ ...node(text), shape: 'rounded' }, 230, 6, 0);
    const oval = measureNode({ ...node(text), shape: 'ellipse' }, 230, 6, 0);
    expect(oval.h).toBeGreaterThan(rect.h);
  });

  it('minH держит пустую фигуру от схлопывания', () => {
    expect(measureNode({ shape: 'rounded', label: 'А' }, 230, 6, 72).h).toBe(
      72,
    );
  });

  it('длинное название занимает две строки и не больше', () => {
    const r = measureNode(
      { shape: 'rounded', label: 'Очень длинное название режима '.repeat(5) },
      200,
      6,
      0,
    );
    expect(r.titleLines).toBe(2);
  });
});
