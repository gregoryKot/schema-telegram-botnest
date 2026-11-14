// Тесты чистой части кита карточек: цвет с прозрачностью, яркость, оттенок
// цвета сущности и расчёт высоты шапки. Canvas в jsdom нет — рисующие
// функции остаются за кадром, проверяем то, от чего зависит раскладка.
import { describe, it, expect } from 'vitest';
import { withAlpha, luminance } from './theme';
import { oklchHue, nearestHue } from './color';
import { headerHeight } from './header';

describe('withAlpha', () => {
  it('переводит #rrggbb в rgba', () => {
    expect(withAlpha('#5aa8f7', 0.5)).toBe('rgba(90,168,247,0.5)');
  });

  it('понимает короткий #rgb', () => {
    expect(withAlpha('#fff', 0.2)).toBe('rgba(255,255,255,0.2)');
  });

  it('переопределяет альфу у rgb/rgba', () => {
    expect(withAlpha('rgb(10, 20, 30)', 0.4)).toBe('rgba(10,20,30,0.4)');
    expect(withAlpha('rgba(10, 20, 30, 0.9)', 0.1)).toBe('rgba(10,20,30,0.1)');
  });

  it('незнакомый формат возвращает как есть (не роняет отрисовку)', () => {
    expect(withAlpha('red', 0.5)).toBe('red');
  });
});

describe('luminance', () => {
  it('фон тёмной темы темнее середины, светлой — светлее', () => {
    expect(luminance('#191b25')).toBeLessThan(0.5);
    expect(luminance('#f4f0e9')).toBeGreaterThan(0.5);
  });

  it('нераспознанный цвет считается тёмным (свечения не выцветают)', () => {
    expect(luminance('var(--bg)')).toBe(0);
  });
});

describe('oklchHue / nearestHue', () => {
  it('цвет сущности уходит на ближайшую бумагу по кругу оттенков', () => {
    const h = oklchHue('#5d6d8a');
    expect(h).not.toBeNull();
    expect(nearestHue(h!, [28, 70, 135, 240, 310])).toBe(240);
    expect(nearestHue(355, [28, 310])).toBe(28);
  });
  it('серый и не-hex — без оттенка (null), а не выдуманный', () => {
    expect(oklchHue('#888888')).toBeNull();
    expect(oklchHue('var(--x)')).toBeNull();
  });
});

describe('headerHeight', () => {
  it('вторая строка заголовка и подпись добавляют высоту', () => {
    const one = headerHeight(1);
    expect(headerHeight(2)).toBeGreaterThan(one);
    expect(headerHeight(1, true)).toBeGreaterThan(one);
  });
});
