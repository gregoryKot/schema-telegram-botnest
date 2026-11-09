// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { cssBundle } from './cssBundle.test-helpers';

// Файл вместе с частями, подключёнными через @import (раскрой 2026-11): сверка смотрит на весь раздел.
const read = (f: string) => cssBundle(f).replace(/\/\*[\s\S]*?\*\//g, '');

describe('строки-переходы клиента: локальные хаки удалены (#906, волна 2)', () => {
  it.each(['!important', 'font-size: 0', "content: '›'", '.cp-breath', '.cp-chev', '--crisis', '.cp-empty', 'var(--err)'])(
    'client-practice.css: нет %s',
    (bad) => {
      const css = read('client-practice.css');
      if (bad === 'var(--err)') expect(css).not.toMatch(/background:\s*var\(--err\)/);
      else expect(css).not.toContain(bad);
    },
  );
  it('client-more.css: нет .cm-row и .cm-list', () => {
    const css = read('client-more.css');
    expect(css).not.toContain('.cm-row');
    expect(css).not.toContain('.cm-list');
  });
  it('client-today.css: нет .ct-empty', () => {
    expect(read('client-today.css')).not.toContain('.ct-empty');
  });
  it('client-why.css: нет .cw-h1', () => {
    expect(read('client-why.css')).not.toContain('.cw-h1');
  });
});

// Класс как целый селектор: `.ex2-chip` не совпадает с `.ex2-chips`.
const hasClass = (css: string, cls: string) => new RegExp('\\.' + cls.replace(/-/g, '\\-') + '(?![\\w-])').test(css);

describe('волна 3 (#906): один примитив на механику', () => {
  it.each(['sk-empty', 'sk-empty-text', 'sk-fc-empty', 'sk-danger', 'sk-fc-hist-title'])('sheet-tasks.css: нет .%s', (cls) => {
    expect(hasClass(read('sheet-tasks.css'), cls)).toBe(false);
  });
  it('sheet-tasks.css: палитра команд переехала, .sk-cmd- нет', () => {
    expect(read('sheet-tasks.css')).not.toContain('.sk-cmd-');
  });
  it.each(['ex2-pick-arrow', 'ex2-pick-name', 'ex2-empty', 'ex2-chip'])('sheet-exercises.css: нет .%s', (cls) => {
    expect(hasClass(read('sheet-exercises.css'), cls)).toBe(false);
  });
  it('sheet-exercises.css: контейнер .ex2-chips остался', () => {
    expect(hasClass(read('sheet-exercises.css'), 'ex2-chips')).toBe(true);
  });
  it('sheet-childhood.css: ни одного селектора .cw-, префикс chw-', () => {
    const css = read('sheet-childhood.css');
    expect(css).not.toMatch(/\.cw-/);
    expect(css).toMatch(/\.chw-/);
  });
  it('client-practice.css: у .cp-page--phone нет gap и padding-top', () => {
    const rules = [...read('client-practice.css').matchAll(/\.cp-page--phone\s*\{([^}]*)\}/g)].map(m => m[1]).join(';');
    expect(rules).not.toMatch(/(^|[;\s])gap\s*:/);
    expect(rules).not.toMatch(/padding-top\s*:/);
  });
});
