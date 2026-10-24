import { describe, it, expect } from 'vitest';
import { hitboxStyle } from './hitbox';

describe('hitboxStyle', () => {
  it('расширяет квадратную кнопку 34×34 до хитбокса 44×44 симметричным margin', () => {
    const { outer, inner } = hitboxStyle(34, 34);
    expect(outer.width).toBe(44);
    expect(outer.height).toBe(44);
    expect(outer.marginLeft).toBe(-5);
    expect(outer.marginRight).toBe(-5);
    expect(outer.marginTop).toBe(-5);
    expect(outer.marginBottom).toBe(-5);
    expect(inner).toEqual({ width: 34, height: 34 });
  });

  it('вклад во flow родителя (width + margins) равен исходному визуальному размеру', () => {
    const { outer } = hitboxStyle(34, 34);
    expect(outer.width + outer.marginLeft + outer.marginRight).toBe(34);
    expect(outer.height + outer.marginTop + outer.marginBottom).toBe(34);
  });

  it('поддерживает не квадратный визуальный размер (точка-пагинатор) и меньший hitSize', () => {
    const { outer, inner } = hitboxStyle(20, 8, 24);
    expect(outer.width).toBe(24);
    expect(outer.height).toBe(24);
    expect(outer.marginLeft).toBe(-2);
    expect(outer.marginTop).toBe(-8);
    expect(inner).toEqual({ width: 20, height: 8 });
  });

  it('не сжимает хитбокс ниже визуального размера (уже больше hitSize)', () => {
    const { outer } = hitboxStyle(50, 50, 44);
    expect(outer.marginLeft).toBe(0);
    expect(outer.marginTop).toBe(0);
  });

  it('outer прозрачен и центрирует inner флексом', () => {
    const { outer } = hitboxStyle(34, 34);
    expect(outer.background).toBe('transparent');
    expect(outer.border).toBe('none');
    expect(outer.display).toBe('flex');
    expect(outer.alignItems).toBe('center');
    expect(outer.justifyContent).toBe('center');
  });
});
