// @vitest-environment jsdom
// Btn (лендинги, визитка, запись): вид варианта и наведение — классы .lk-btn* из index.css. Раньше
// onMouseEnter/onMouseLeave правили инлайн-стиль, а инлайн перебивал :hover. Сверка: класс варианта на
// элементе, цвета в инлайне нет, наведение стиль не трогает; у класса в index.css покой и наведение —
// с теми же значениями, что ставил JS.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { Btn } from './landing-kit';
import { INK_ON_DARK } from './landing-kit-hooks';

const CSS = readFileSync(join(__dirname, '..', 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Объявления правила с ровно этим селектором в index.css. */
function decls(selector: string): Record<string, string> | null {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  return Object.fromEntries(m[1].split(';').map((d) => d.split(':').map((s) => s.trim())).filter(([k, v]) => k && v));
}

const STATES = {
  primary: { rest: { background: 'var(--accent)', color: 'var(--on-accent)' }, hover: { transform: 'translateY(-1px)' } },
  ghost: {
    rest: { background: 'transparent', 'border-color': 'var(--line-strong)', color: 'var(--text-sub)', 'font-weight': '500' },
    hover: { 'border-color': 'var(--text)', color: 'var(--text)' },
  },
  dark: {
    rest: { background: 'rgba(255, 255, 255, .1)', 'border-color': 'rgba(255, 255, 255, .2)', color: INK_ON_DARK },
    hover: { background: 'rgba(255, 255, 255, .18)' },
  },
} as const;
const VARIANTS = Object.keys(STATES) as (keyof typeof STATES)[];

describe('Btn: вид варианта — классом, без JS-наведения', () => {
  it.each(VARIANTS)('%s: класс варианта на кнопке, цвета и рамки в инлайне нет', (v) => {
    render(<Btn variant={v}>Записаться</Btn>);
    const el = screen.getByRole('button', { name: 'Записаться' });
    expect([...el.classList]).toEqual(['lk-btn', `lk-btn--${v}`]);
    for (const p of ['background', 'color', 'border', 'border-color', 'transform', 'font-weight', 'opacity']) {
      expect(el.style.getPropertyValue(p)).toBe('');
    }
  });

  it('наведение не трогает инлайн-стиль ссылки', () => {
    render(<Btn variant="ghost" href="/articles">Читать ещё</Btn>);
    const el = screen.getByRole('link', { name: 'Читать ещё' });
    const before = el.getAttribute('style');
    fireEvent.mouseEnter(el);
    expect(el.getAttribute('style')).toBe(before);
    fireEvent.mouseLeave(el);
    expect(el.getAttribute('style')).toBe(before);
  });

  it('выключенная кнопка и ссылка несут is-disabled — наведение в CSS их обходит', () => {
    render(<><Btn disabled>Отправить</Btn><Btn href="/x" disabled>Ссылка</Btn></>);
    expect(screen.getByRole('button', { name: 'Отправить' }).className).toBe('lk-btn lk-btn--primary is-disabled');
    expect(screen.getByRole('link', { name: 'Ссылка' }).className).toBe('lk-btn lk-btn--primary is-disabled');
  });
});

describe('index.css: правила Btn', () => {
  it.each(VARIANTS)('%s: покой и наведение — прежние значения', (v) => {
    expect(decls(`.lk-btn--${v}`)).toEqual(STATES[v].rest);
    expect(decls(`.lk-btn--${v}:not(.is-disabled):hover`)).toEqual(STATES[v].hover);
  });

  it('база выше вариантов: при равной специфичности рамка и вес варианта побеждают', () => {
    expect(decls('.lk-btn')).toMatchObject({ border: '1.5px solid transparent', 'font-weight': '600', cursor: 'pointer' });
    expect(decls('.lk-btn.is-disabled')).toEqual({ cursor: 'default', opacity: '.4' });
    expect(CSS.indexOf('\n.lk-btn {')).toBeLessThan(CSS.indexOf('\n.lk-btn--ghost {'));
  });

  it('токен чернил тёмной секции, на который ссылается INK_ON_DARK, объявлен', () => {
    expect(INK_ON_DARK).toMatch(/^var\(--[\w-]+\)$/);
    expect(CSS).toMatch(new RegExp(`(?<![\\w-])${INK_ON_DARK.slice(4, -1)}:\\s*#[0-9a-f]{6};`));
  });
});
