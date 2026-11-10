// @vitest-environment node
// Инлайн `style={{ alignSelf: 'flex-start' }}` — набор, для которого есть утилита `u-self-start`
// (shared/src/theme/utilities.css). Шесть мест жили инлайном, пока утилиты не было
// (docs/open/frontend-ux.md, «примитивы без второго потребителя»). Сверка: объект стиля из одного
// alignSelf: 'flex-start' в .tsx сайта и shared — красное; утилита есть и удвоена, как соседи.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..');
const SHARED = join(WEB, '..', '..', 'shared', 'src');
const utilities = readFileSync(join(SHARED, 'theme', 'utilities.css'), 'utf8');

/** Объекты стиля, где единственное свойство — alignSelf: 'flex-start'. */
function soleSelfStart(src: string): string[] {
  return [...src.matchAll(/style=\{\{\s*alignSelf:\s*['"]flex-start['"]\s*,?\s*\}\}/g)].map((m) => m[0]);
}

// Визитка (pages/landing) — в своём стиле по решению владельца (docs/open/one-frontend.md, «Редизайн
// кабинета — хвосты»): её Btn класса не принимает, стиль идёт пропом.
const tsx = [WEB, SHARED].flatMap((root) =>
  (readdirSync(root, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.') && !f.startsWith('pages/landing/'))
    .map((f) => join(root, f)));

describe('u-self-start вместо инлайн alignSelf', () => {
  it('утилита есть в utilities.css с удвоенным селектором', () => {
    expect(utilities).toMatch(/\.u-self-start\.u-self-start\s*\{\s*align-self:\s*flex-start;\s*\}/);
  });

  it('нет объекта стиля из одного alignSelf: flex-start', () => {
    expect(tsx.length).toBeGreaterThan(100);
    const bad = tsx.flatMap((f) => soleSelfStart(readFileSync(f, 'utf8')).map(() => f.slice(WEB.length - 10)));
    expect(bad).toEqual([]);
  });

  // ModesTab.tsx ушёл из списка с редизайном справочника (b16): чипа группы с alignSelf там больше нет.
  it.each([
    'components/therapist/ClientYSQTab.tsx',
    'components/therapist/concept/YsqCrossCheck.tsx',
    'sections/guide/GuideReference.tsx',
  ])('%s: alignSelf — классом u-self-start', (f) => {
    const src = readFileSync(join(WEB, f), 'utf8');
    expect(src).not.toMatch(/alignSelf/);
    expect(src).toMatch(/u-self-start/);
  });

  it('контрольный образец', () => {
    expect(soleSelfStart(`<b style={{ alignSelf: 'flex-start' }} />`)).toHaveLength(1);
    expect(soleSelfStart(`<b style={{ alignSelf: 'flex-start', minHeight: 44 }} />`)).toEqual([]);
    expect(soleSelfStart(`<b style={{ alignSelf: 'center' }} />`)).toEqual([]);
  });
});
