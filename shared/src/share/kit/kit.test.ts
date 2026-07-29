// Тесты чистой части кита карточек: цвет с прозрачностью, яркость темы,
// геометрия радара и расчёт высоты шапки. Canvas в jsdom нет — рисующие
// функции остаются за кадром, проверяем то, от чего зависит раскладка.
import { describe, it, expect } from 'vitest';
import { withAlpha, luminance } from './theme';
import { axisPoint, valueRadius } from './charts';
import { headerHeight } from './frame';

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

describe('axisPoint', () => {
  const cx = 100;
  const cy = 100;

  it('первая ось смотрит вверх', () => {
    const p = axisPoint(0, 5, 50, cx, cy);
    expect(p.x).toBeCloseTo(cx, 5);
    expect(p.y).toBeCloseTo(cy - 50, 5);
  });

  it('оси идут по часовой стрелке и равномерно', () => {
    const p1 = axisPoint(1, 4, 50, cx, cy);
    const p2 = axisPoint(2, 4, 50, cx, cy);
    expect(p1.x).toBeCloseTo(cx + 50, 5);
    expect(p1.y).toBeCloseTo(cy, 5);
    expect(p2.y).toBeCloseTo(cy + 50, 5);
  });

  it('нулевой радиус — все оси в центре', () => {
    for (let i = 0; i < 5; i++) {
      const p = axisPoint(i, 5, 0, cx, cy);
      expect(p.x).toBeCloseTo(cx, 5);
      expect(p.y).toBeCloseTo(cy, 5);
    }
  });
});

describe('valueRadius', () => {
  it('не отмеченная потребность — вершина в центре', () => {
    expect(valueRadius(null, 10, 100)).toBe(0);
  });

  it('максимум даёт полный радиус', () => {
    expect(valueRadius(10, 10, 100)).toBeCloseTo(100, 5);
  });

  it('ноль не схлопывается в точку — иначе полигон вырождается', () => {
    expect(valueRadius(0, 10, 100)).toBeGreaterThan(0);
    expect(valueRadius(0, 10, 100)).toBeLessThan(20);
  });

  it('растёт монотонно и не вылезает за радиус', () => {
    expect(valueRadius(3, 10, 100)).toBeLessThan(valueRadius(7, 10, 100));
    expect(valueRadius(99, 10, 100)).toBeCloseTo(100, 5);
  });
});

describe('headerHeight', () => {
  it('вторая строка заголовка и подпись добавляют высоту', () => {
    const one = headerHeight(1);
    expect(headerHeight(2)).toBeGreaterThan(one);
    expect(headerHeight(1, true)).toBeGreaterThan(one);
  });
});
