// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AboutWhy } from './AboutWhy';
import { NEEDS_EXPLAINER } from '../../../../shared/src/about/aboutData';

afterEach(cleanup);
// Абзацы идут через glue (неразрывные пробелы, связка у диапазона «3–5») — сверяем слова, а не пробелы.
const WHY_TERM = /Через\s3\S*–\S*5\sдней\sпаттерн/;

describe('AboutWhy', () => {
  it('показывает «зачем» (срок результата) и все пять потребностей', () => {
    render(<AboutWhy />);
    expect(screen.getByText(WHY_TERM)).toBeTruthy();
    for (const n of NEEDS_EXPLAINER) expect(screen.getByText(new RegExp(n.name))).toBeTruthy();
    expect(NEEDS_EXPLAINER).toHaveLength(5);
  });
});

describe('AboutWhy — знак потребности вместо эмодзи', () => {
  it('у каждой из пяти строк свой знак, эмодзи из данных не рисуются', () => {
    const { container } = render(<AboutWhy />);
    const rows = [...container.querySelectorAll('.st-need')];
    expect(rows.map((r) => r.getAttribute('data-need'))).toEqual(['attachment', 'autonomy', 'expression', 'play', 'limits']);
    for (const r of rows) expect(r.querySelector('.pp-row-art svg')).toBeTruthy();
    for (const n of NEEDS_EXPLAINER) expect(container.textContent).not.toContain(n.emoji);
  });
});
