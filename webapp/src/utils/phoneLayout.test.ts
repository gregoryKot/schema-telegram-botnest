// @vitest-environment node
// Условие «телефон» живёт в utils/phoneLayout.ts; CSS повторяет его буквально.
// Тест не даёт CSS и JS разойтись: любой @media про 767/768 обязан быть
// ровно PHONE_MEDIA или DESKTOP_MEDIA.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PHONE_MEDIA, DESKTOP_MEDIA } from './phoneLayout';

const SRC = path.resolve(__dirname, '..');
/** Осознанные исключения: касание любой ширины (кабинет, тап-цели). */
const ALLOWED_OTHER = ['@media (pointer: coarse), (max-width: 767px)'];

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return p.endsWith('.css') ? [p] : [];
  });
}

describe('phoneLayout: CSS и JS говорят одно и то же', () => {
  const mediaLines = cssFiles(SRC).flatMap((f) =>
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

  it('телефон под пальцем с низкой высотой входит в PHONE_MEDIA, планшет и мышь — нет', () => {
    expect(PHONE_MEDIA).toContain('(pointer: coarse) and (max-height: 500px)');
    expect(DESKTOP_MEDIA).toContain('(min-height: 501px)');
    expect(DESKTOP_MEDIA).toContain('(pointer: fine)');
  });
});
