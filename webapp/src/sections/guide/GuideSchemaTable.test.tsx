// @vitest-environment jsdom
// Таблица копингов «Справочника» на настоящих текстах: 60 выжимок, фильтр одного стиля — 20 строк с одной
// колонкой, «Подробно» показывает полные тексты, тап по клетке раскрывает одну клетку, тап по схеме открывает лист.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as guide from '../../../../shared/src/schemaTherapy/guide';
import { SCHEMA_COPING } from '../../../../shared/src/schemaTherapy/guide/schemas/coping';
import { SCHEMA_COPING_HEADLINES } from '../../../../shared/src/schemaTherapy/guide/schemas/copingHeadlines';
import { buildReference } from './guideReferenceModel';
import { GuideSchemaTable } from './GuideSchemaTable';

const tr = (ty: string) => ty;
const groups = buildReference(guide, tr).schemas;
const guides = guide.buildSchemaDomainGuides(tr);
const fullTexts = () => document.querySelectorAll('.gst-full');
const bodyRows = () => document.querySelectorAll('tbody tr');

function renderTable(onOpen = vi.fn()) {
  render(<GuideSchemaTable groups={groups} guides={guides} onOpen={onOpen} />);
  return onOpen;
}

describe('GuideSchemaTable', () => {
  it('«Все три», «Коротко»: 20 схем, 60 выжимок, полных текстов нет', () => {
    renderTable();
    expect(bodyRows()).toHaveLength(20);
    expect(document.querySelectorAll('.gst-head')).toHaveLength(60);
    expect(screen.getByText(SCHEMA_COPING_HEADLINES.abandonment.avoidance)).toBeTruthy();
    expect(fullTexts()).toHaveLength(0);
  });

  it('один стиль: 20 строк, в каждой одна клетка этого стиля', () => {
    renderTable();
    fireEvent.click(screen.getByRole('tab', { name: 'Избегание' }));
    expect(bodyRows()).toHaveLength(20);
    expect(document.querySelectorAll('tbody td')).toHaveLength(20);
    expect(screen.getByText(SCHEMA_COPING_HEADLINES.failure.avoidance)).toBeTruthy();
    expect(screen.queryByText(SCHEMA_COPING_HEADLINES.failure.surrender)).toBeNull();
  });

  it('«Подробно» показывает полные тексты во всех клетках', () => {
    renderTable();
    fireEvent.click(screen.getByRole('tab', { name: 'Подробно' }));
    expect(fullTexts()).toHaveLength(60);
    expect(screen.getByText(SCHEMA_COPING.mistrust.overcompensation)).toBeTruthy();
  });

  it('тап раскрывает клетку, тап по другой сменяет её, повторный сворачивает', () => {
    renderTable();
    const cell = (text: string) => screen.getByText(text).closest('button')!;
    fireEvent.click(cell(SCHEMA_COPING_HEADLINES.failure.surrender));
    expect(fullTexts()).toHaveLength(1);
    expect(screen.getByText(SCHEMA_COPING.failure.surrender)).toBeTruthy();
    expect(cell(SCHEMA_COPING_HEADLINES.failure.surrender).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(cell(SCHEMA_COPING_HEADLINES.failure.avoidance));
    expect(fullTexts()).toHaveLength(1);
    expect(screen.getByText(SCHEMA_COPING.failure.avoidance)).toBeTruthy();
    fireEvent.click(cell(SCHEMA_COPING_HEADLINES.failure.avoidance));
    expect(fullTexts()).toHaveLength(0);
  });

  it('тап по имени схемы открывает её лист', () => {
    const onOpen = renderTable();
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'schema', id: 'abandonment' }));
  });
});
