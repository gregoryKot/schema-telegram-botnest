// @vitest-environment node
// Журнальный стиль врезок и кризисных строк (#1674, К15/К17): врезка — линия слева на бумаге, без серой
// заливки и рамки; кризисные номера — строки между линиями, без белых плашек, капсулы «112» и теней.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRules } from './cssRules.test-helpers';

const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');
const decls = (name: string, sel: string) =>
  parseRules(read(name)).filter((r) => !r.media && r.selectors.includes(sel)).map((r) => r.body).join(';');

const FILL = /background(-color)?\s*:(?!\s*(?:none|transparent))/;

describe('врезка .ds-aside', () => {
  const aside = decls('cabinet.css', '.ds-aside');
  it('линия слева, без заливки, рамки и скругления', () => {
    expect(aside).toContain('border-left: 2px solid var(--line)');
    expect(aside).not.toMatch(FILL);
    expect(aside).not.toMatch(/border-radius|box-shadow|(^|;)\s*border\s*:/);
  });
  it('серая плашка не вернулась: наклейка и врезки страниц — на примитиве', () => {
    expect(decls('therapy-caution.css', '.ds-aside.th-caution--compact')).not.toMatch(FILL);
    expect(read('../components/therapy/TherapyCaution.tsx')).toMatch(/ds-aside th-caution/);
    expect(read('../pages/OfferPage.tsx')).toContain('ds-aside');
    expect(read('../pages/ReviewsPage.tsx')).toContain('ds-aside');
    expect(read('../pages/admin/shared.ts')).not.toContain('rgba(var(--fg-rgb)');
  });
});

describe('кризисные строки без плашек', () => {
  const style = read('../../../shared/src/components/crisisCardStyle.ts');
  it('номера карточки — строки на линиях: без заливки, тени и радиуса', () => {
    expect(style).not.toMatch(/boxShadow|borderRadius|background\s*:/);
    expect(style).toContain("borderBottom: '1px solid var(--panel-line)'");
  });
  it('минимальная высота строки номера ≥44 (тап-цель)', () => {
    for (const m of style.matchAll(/minHeight:\s*(\d+)/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(44);
  });
  it('«112» — ссылка без капсулы; «Мне очень плохо» в «Ещё» — строка, не карточка', () => {
    const cr = decls('crisis.css', '.cr-112');
    expect(cr).not.toMatch(FILL);
    expect(cr).not.toContain('border-radius');
    expect(cr).toContain('min-height: 44px');
    expect(read('../sections/MoreSection.tsx')).not.toContain('ds-card--crisis');
    expect(decls('client-more.css', '.cm-crisis')).not.toMatch(FILL);
  });
});
