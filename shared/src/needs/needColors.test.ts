/// <reference types="node" />
// Цвет потребности стал опознавательным знаком вместо эмодзи (волна 5), а
// до этого палитра лежала в четырёх копиях. Тест держит единственный источник:
// список потребностей и их цвета обязаны совпадать с порядком реестра, а
// неизвестный id не имеет права покраситься в чужой цвет.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NEED_HUE, toneHex } from '../theme/entityHue';
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
    expect(needColor('attachment')).toBe(toneHex(NEED_HUE.attachment));
    expect(needColor('nope')).toBe('var(--muted)');
  });
});

// QA 2026-11 (B-З7): вторая палитра COLORS в shared/src/types.ts пережила
// переход на hue (#906, #910) — колесо истории, карточки шаринга и весь
// мини-апп красили потребности старыми hex, а итог трекера и «Неделя» —
// новыми. Копия палитры — объект с hex-цветом под ключом потребности; ни один
// исходник фронтендов, кроме этого модуля, не имеет права его объявлять.
describe('needColors: второй палитры потребностей нет', () => {
  const REPO_ROOT = join(__dirname, '..', '..', '..');
  const DIRS = ['shared/src', 'webapp/src'];
  const PALETTE = new RegExp(
    `(?:${NEED_COLOR_ORDER.join('|')})\\s*:\\s*['"\`]#[0-9a-f]{3,8}['"\`]`,
    'i',
  );
  const walk = (rel: string): string[] =>
    readdirSync(join(REPO_ROOT, rel), { withFileTypes: true }).flatMap((e) => {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory())
        return e.name === 'node_modules' || e.name === 'dist' ? [] : walk(p);
      return /\.(ts|tsx)$/.test(e.name) &&
        !/\.(test|spec)\.(ts|tsx)$/.test(e.name)
        ? [p]
        : [];
    });

  it('образец копии ловится, нейтральный объект — нет', () => {
    expect(PALETTE.test("attachment: '#f472b6',")).toBe(true);
    expect(PALETTE.test("attachment: 'var(--c-rose)',")).toBe(false);
  });

  it('hex-палитру потребностей объявляет только needColors.ts', () => {
    const copies = DIRS.flatMap(walk).filter((f) =>
      PALETTE.test(readFileSync(join(REPO_ROOT, f), 'utf8')),
    );
    expect(copies).toEqual([]);
  });
});
