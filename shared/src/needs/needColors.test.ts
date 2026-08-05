// Цвет потребности стал опознавательным знаком вместо эмодзи (волна 5), а
// до этого палитра лежала в четырёх копиях. Тест держит единственный источник:
// список потребностей и их цвета обязаны совпадать с порядком реестра, а
// неизвестный id не имеет права покраситься в чужой цвет.
import { describe, it, expect } from 'vitest';
import { NEED_COLORS, NEED_COLOR_ORDER, needColor } from './needColors';

describe('needColors', () => {
  it('цвет есть у каждой из пяти потребностей и все цвета разные', () => {
    const colors = NEED_COLOR_ORDER.map((id) => NEED_COLORS[id]);
    expect(colors).toHaveLength(5);
    expect(colors.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
    expect(new Set(colors).size).toBe(5);
  });

  it('в реестре нет лишних ключей сверх порядка — иначе они разъедутся', () => {
    expect(Object.keys(NEED_COLORS).sort()).toEqual(
      [...NEED_COLOR_ORDER].sort(),
    );
  });

  it('неизвестная потребность получает нейтральный токен, а не чужой цвет', () => {
    expect(needColor('attachment')).toBe('#ff6b9d');
    expect(needColor('nope')).toBe('var(--muted)');
  });
});
