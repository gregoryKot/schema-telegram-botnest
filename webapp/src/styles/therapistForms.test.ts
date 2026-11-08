// Тест-сверка #906, волна 2: локальные копии примитивов (поиск, дата, пустое
// состояние YSQ, счётчик сегмента, вкладки карт, суммы доната, «Управлять →»,
// resize у полей) удалены — их роль играют ds-* из cabinet.css.
import { describe, it, expect } from 'vitest';
import { cssBundle } from './cssBundle.test-helpers';

// Файл вместе с частями из @import (раскрой 2026-11): sheet-tasks.css — сборник.
const css = (name: string) => cssBundle(name);
const rule = (src: string, sel: string) => {
  const m = src.match(new RegExp(`(^|\\n)${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : '';
};

describe('формы терапевта и сопутствующие экраны: локальные копии удалены (#906)', () => {
  it('therapist-clients.css: у .tc-search нет рамки, высоты и радиуса', () => {
    const body = rule(css('therapist-clients.css'), '.tc-search');
    expect(body).not.toBe('');
    expect(body).not.toMatch(/border|height|border-radius/);
  });
  it('therapist-tabs.css: нет .tb-date-pill, .tb-ysq-empty, .tb-seg-n, .tb-filter', () => {
    const src = css('therapist-tabs.css');
    for (const c of ['.tb-date-pill', '.tb-ysq-empty', '.tb-seg-n', '.tb-filter']) expect(src).not.toContain(c);
  });
  it('sheet-modemap.css: нет вкладок-карточек, значка пустого состояния, resize и min-height: 32px у сегмента', () => {
    const src = css('sheet-modemap.css');
    for (const c of ['.mm2-map-x', '.mm2-empty-ico', 'resize: vertical']) expect(src).not.toContain(c);
    expect(rule(src, '.mm2-seg .ds-seg-btn')).toBe('');
    expect(src).not.toMatch(/\.mm2-seg[^{]*\{[^}]*min-height: 32px/);
  });
  it('auth-pay.css: нет .ap-amount и .ap-input', () => {
    const src = css('auth-pay.css');
    expect(src).not.toMatch(/^\s*\.ap-amount/m);
    expect(src).not.toMatch(/^\s*\.ap-input/m);
  });
  it('auth-account.css: нет resize и .aa-sub a', () => {
    const src = css('auth-account.css');
    expect(src).not.toContain('resize');
    expect(src).not.toContain('.aa-sub a');
  });
  it('sheet-tasks.css: нет .sk-cmd-input', () => {
    expect(css('sheet-tasks.css')).not.toContain('.sk-cmd-input');
  });
  it('command-palette.css: панель r28 и calc(100vw - 32px), строка r14, у подписи нет своего кегля', () => {
    const src = css('command-palette.css');
    expect(rule(src, '.cmd-panel')).toMatch(/border-radius:\s*28px/);
    expect(rule(src, '.cmd-panel')).toContain('max-width: calc(100vw - 32px)');
    expect(rule(src, '.cmd-row')).toMatch(/border-radius:\s*14px/);
    expect(rule(src, '.cmd-sub')).not.toContain('font-size');
  });
  it('therapist-today.css: нет .tt-arrow', () => {
    expect(css('therapist-today.css')).not.toContain('.tt-arrow');
  });
});
