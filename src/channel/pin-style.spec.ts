// Оформление пинов. Смысл фичи — чтобы лента Pinterest не выглядела как одна
// картинка, показанная двадцать раз (до 2026-08 все пины были одинаковыми:
// один фон, один кегль, одна раскладка).
//
// Главное свойство под тестом — вид берётся ИЗ ТЕКСТА: повторная отправка той
// же фразы даёт тот же пин, а не второй непохожий.
import {
  DECORS,
  LAYOUTS,
  PALETTES,
  pinStyle,
  sizeForLength,
} from './pin-style';

describe('pinStyle', () => {
  it('одна фраза — всегда одно и то же оформление', () => {
    const text = 'Отдых не надо заслуживать.';
    expect(pinStyle(text)).toEqual(pinStyle(text));
  });

  it('соседние по тексту фразы не сливаются в один вид', () => {
    // Фразы пула часто начинаются одинаково; слабый хэш сваливал такие в
    // одну палитру, и пины шли парами-близнецами.
    const a = pinStyle('Ты сегодня сделал достаточно.');
    const b = pinStyle('Ты сегодня сделал достаточно. Правда.');
    expect([a.palette.name, a.layout, a.decor]).not.toEqual([
      b.palette.name,
      b.layout,
      b.decor,
    ]);
  });

  it('выбирает только из объявленных наборов', () => {
    const s = pinStyle('Можно просто остановиться.');
    expect(PALETTES).toContain(s.palette);
    expect(LAYOUTS).toContain(s.layout);
    expect(DECORS).toContain(s.decor);
  });

  it('кегль берётся из длины фразы', () => {
    const short = pinStyle('Ты не обязан быть удобным.');
    const long = pinStyle('Ты не обязан быть удобным. '.repeat(12));
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
  });
});

describe('sizeForLength', () => {
  it('чем длиннее фраза, тем мельче набор — и наоборот', () => {
    const sizes = [20, 80, 150, 250, 500].map((n) => sizeForLength(n).fontSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('высота строки всегда больше кегля — строки не наезжают', () => {
    for (const n of [10, 60, 110, 190, 300, 900]) {
      const { fontSize, lineHeight } = sizeForLength(n);
      expect(lineHeight).toBeGreaterThan(fontSize * 1.2);
    }
  });
});

describe('палитры', () => {
  it('у тёмных текст светлый, у светлых — тёмный', () => {
    // Иначе пин выйдет нечитаемым, а заметно это станет только в ленте.
    for (const p of PALETTES) {
      const [r, g, b] = p.fg.split(',').map((v) => Number(v.trim()));
      const light = (r + g + b) / 3 > 128;
      expect(light).toBe(p.dark);
    }
  });

  it('в наборе есть и тёмные, и светлые — лента не превращается в одно пятно', () => {
    expect(PALETTES.filter((p) => p.dark).length).toBeGreaterThanOrEqual(6);
    expect(PALETTES.filter((p) => !p.dark).length).toBeGreaterThanOrEqual(3);
  });

  it('имена палитр не повторяются — иначе в отладке не различить', () => {
    expect(new Set(PALETTES.map((p) => p.name)).size).toBe(PALETTES.length);
  });
});
