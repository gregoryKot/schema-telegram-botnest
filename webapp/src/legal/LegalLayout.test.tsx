// @vitest-environment jsdom
// Таблица реквизитов юридических страниц. jsdom ширину не меряет, поэтому
// здесь — стили, без которых сетка раздвигается (регрессия: /privacy и /offer
// шире экрана телефона), и то, что обе страницы берут одну таблицу. Замер в
// настоящем браузере — `e2e-browser/public-pages.spec.ts`.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Table } from './LegalLayout';
import { TABLE_ROW_COLUMNS, h1, column } from './legalStyles';
import { PrivacyPage } from '../pages/PrivacyPage';
import { OfferPage } from '../pages/OfferPage';

afterEach(() => {
  cleanup();
});

describe('LegalLayout Table', () => {
  it('колонка подписи не фиксирована в 220px и сжимается на узком экране', () => {
    expect(TABLE_ROW_COLUMNS).not.toMatch(/^220px\b/);
    expect(TABLE_ROW_COLUMNS).toMatch(/^min\(220px, \d+%\)/);
    expect(TABLE_ROW_COLUMNS).toMatch(/minmax\(0, 1fr\)$/);
  });

  it('обе ячейки переносят длинное неразрывное значение', () => {
    const long = 'очень-длинное-значение-без-пробелов@example-domain.example';
    render(<Table rows={[['Электронная почта', long]]} />);
    const row = screen.getByTestId('legal-table-row');
    expect(row.style.gridTemplateColumns).toBe(TABLE_ROW_COLUMNS);
    const cells = Array.from(row.children) as HTMLElement[];
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.style.minWidth).toBe('0px');
      expect(cell.style.overflowWrap).toBe('anywhere');
    }
    expect(cells[1].textContent).toBe(long);
  });

  it('заголовок страницы переносится, а не раздвигает узкий экран', () => {
    // «Конфиденциальности» в 32px шире колонки телефона — заголовок держал
    // страницу шире экрана уже после починки таблицы.
    expect(h1.overflowWrap).toBe('anywhere');
    expect(String(h1.fontSize)).toMatch(/^clamp\(2\dpx,/);
    expect(String(column.padding)).toContain('clamp(');
  });

  it.each([
    ['политика', PrivacyPage],
    ['оферта', OfferPage],
  ])('%s рисует реквизиты общей таблицей', (_name, Page) => {
    render(<Page />);
    const rows = screen.getAllByTestId('legal-table-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.style.gridTemplateColumns).toBe(TABLE_ROW_COLUMNS);
    }
  });
});
