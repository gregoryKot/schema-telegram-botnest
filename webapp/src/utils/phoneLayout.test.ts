// @vitest-environment node
// Условие «телефон» живёт в utils/phoneLayout.ts; CSS повторяет его буквально.
// Тест не даёт CSS и JS разойтись: любой @media про 767/768 обязан быть
// ровно PHONE_MEDIA или DESKTOP_MEDIA.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PHONE_MEDIA, DESKTOP_MEDIA } from './phoneLayout';

const SRC = path.resolve(__dirname, '..');
/** Общие стили shared/ сайт подключает так же, как свои: условие то же. */
const SHARED = path.resolve(__dirname, '../../../shared/src');
/** Осознанные исключения: касание любой ширины (кабинет, тап-цели). */
const ALLOWED_OTHER = ['@media (pointer: coarse), (max-width: 767px)'];

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return p.endsWith('.css') ? [p] : [];
  });
}

type Device = { w: number; h: number; pointer: 'fine' | 'coarse' };
/** Медиа-запрос вида «(a) and (b), (c)» на устройстве — только признаки PHONE_MEDIA/DESKTOP_MEDIA. */
function matches(query: string, d: Device): boolean {
  return query.split(',').some((alt) => [...alt.matchAll(/\(([\w-]+):\s*([^)]+)\)/g)].every(([, f, v]) => {
    const n = Number.parseFloat(v);
    if (f === 'max-width') return d.w <= n;
    if (f === 'min-width') return d.w >= n;
    if (f === 'max-height') return d.h <= n;
    if (f === 'min-height') return d.h >= n;
    if (f === 'pointer') return d.pointer === v.trim();
    throw new Error(`неизвестный признак ${f}`);
  }));
}
const DEVICES: [string, 'телефон' | 'компьютер', Device][] = [
  ['компьютер 1280×800, мышь', 'компьютер', { w: 1280, h: 800, pointer: 'fine' }],
  ['низкое окно компьютера 1440×480, мышь', 'компьютер', { w: 1440, h: 480, pointer: 'fine' }],
  ['узкий ноутбук 768×600, мышь', 'компьютер', { w: 768, h: 600, pointer: 'fine' }],
  ['окно уже 768 (700×900), мышь', 'телефон', { w: 700, h: 900, pointer: 'fine' }],
  ['планшет 768×1024, палец', 'компьютер', { w: 768, h: 1024, pointer: 'coarse' }],
  ['планшет 1024×768, палец', 'компьютер', { w: 1024, h: 768, pointer: 'coarse' }],
  ['телефон 393×852, палец', 'телефон', { w: 393, h: 852, pointer: 'coarse' }],
  ['телефон в альбомной 844×390, палец', 'телефон', { w: 844, h: 390, pointer: 'coarse' }],
  ['телефон в альбомной 932×430, палец', 'телефон', { w: 932, h: 430, pointer: 'coarse' }],
];

describe('phoneLayout: CSS и JS говорят одно и то же', () => {
  const mediaLines = [...cssFiles(SRC), ...cssFiles(SHARED)].flatMap((f) =>
    fs.readFileSync(f, 'utf8').split('\n')
      .filter((l) => /^\s*@media/.test(l) && /76[78]px/.test(l))
      .map((l) => ({ f: path.relative(SRC, f), q: l.trim().replace(/\s*\{.*$/, '') })));

  it('нашёл запросы телефона', () => {
    expect(mediaLines.length).toBeGreaterThan(30);
  });

  it('каждый @media про 767/768 — каноническая строка', () => {
    const bad = mediaLines.filter(({ q }) =>
      q !== `@media ${PHONE_MEDIA}` && q !== `@media ${DESKTOP_MEDIA}` && !ALLOWED_OTHER.includes(q));
    expect(bad).toEqual([]);
  });

  // Инцидент 2026-11-04 (#924): компьютер с мышью при ширине ≥768 — всегда компьютерная раскладка,
  // в том числе в низком окне; телефон в альбомной — телефонная. Каждое устройство — ровно в одном условии.
  it.each(DEVICES)('%s → %s', (_name, expected, d) => {
    const got = [matches(PHONE_MEDIA, d) && 'телефон', matches(DESKTOP_MEDIA, d) && 'компьютер'].filter(Boolean);
    expect(got).toEqual([expected]);
  });

  it('вычислитель запроса ловит промах: голый (min-width: 768px) отдаёт компьютеру и телефон в альбомной', () => {
    expect(matches('(min-width: 768px)', { w: 844, h: 390, pointer: 'coarse' })).toBe(true);
    expect(matches(DESKTOP_MEDIA, { w: 844, h: 390, pointer: 'coarse' })).toBe(false);
  });

  it('телефон под пальцем с низкой высотой входит в PHONE_MEDIA, планшет и мышь — нет', () => {
    expect(PHONE_MEDIA).toContain('(pointer: coarse) and (max-height: 500px)');
    expect(DESKTOP_MEDIA).toContain('(min-height: 501px)');
    expect(DESKTOP_MEDIA).toContain('(pointer: fine)');
  });
});
