// @vitest-environment jsdom
// Правило владельца (2026-11, frontend-visual.md): текст для чтения оформлен — абзац короткий, перечисление списком.
// Сверка на настоящих текстах: шапка таблицы «Схем» с раскрытой врезкой и подписи групп каждой вкладки «Справочника».
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import * as guide from '../../../../shared/src/schemaTherapy/guide';
import { REFERENCE_TABS, buildReference } from './guideReferenceModel';
import { GuideReferenceList } from './GuideReferenceList';
import { GuideSchemaTable } from './GuideSchemaTable';

/** Потолок абзаца без меток книг: длиннее — делить на абзацы, список или пары «термин — суть». */
const PARAGRAPH_MAX = 300;
const READING = 'p, li, .sg-hint';

/** Абзацы и пункты длиннее потолка; метки книг «[Янг, гл. 1]» не считаются. Пустой список — текст в порядке. */
function wallProblems(root: ParentNode): string[] {
  return [...root.querySelectorAll(READING)]
    .map((el) => (el.textContent ?? '').replace(/\s*\[[^[\]]+\]/g, '').trim())
    .filter((text) => text.length > PARAGRAPH_MAX)
    .map((text) => `${text.length} знаков: «${text.slice(0, 40)}…»`);
}

const tr = (ty: string) => ty;
const ref = buildReference(guide, tr);

describe('справочник: текст для чтения не полотном', () => {
  it('шапка таблицы «Схем»: лид, три копинга блоками, врезка — короткие абзацы и список уровней', () => {
    const { container } = render(<GuideSchemaTable groups={ref.schemas} guides={guide.buildSchemaDomainGuides(tr)} onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Почему копинг держит схему/ }));
    const intro = container.querySelector('.gst-intro')!;
    expect(intro.querySelectorAll('.gst-style')).toHaveLength(3);
    expect(intro.querySelectorAll('.gst-levels li')).toHaveLength(4);
    expect(intro.querySelectorAll('.gd-cite').length).toBeGreaterThan(0);
    expect(wallProblems(intro)).toEqual([]);
  });

  it('подсказка как читать таблицу: «Про клиента» — только когда отметка доступна', () => {
    const props = { groups: ref.schemas, guides: guide.buildSchemaDomainGuides(tr), onOpen: () => {} };
    const { container, rerender } = render(<GuideSchemaTable {...props} />);
    expect(container.querySelector('.gst-how')!.textContent).not.toContain('Про клиента');
    rerender(<GuideSchemaTable {...props} onMark={() => {}} />);
    expect(container.querySelector('.gst-how')!.textContent).toContain('Про клиента');
  });

  it.each(REFERENCE_TABS.map((t) => t.id))('подписи групп вкладки %s', (tab) => {
    const { container } = render(<GuideReferenceList groups={ref[tab]} layout="tiles" onOpen={() => {}} />);
    expect(wallProblems(container)).toEqual([]);
  });

  const box = (html: string) => Object.assign(document.createElement('div'), { innerHTML: html });

  it('красный образец: абзац в 400 знаков', () => {
    expect(wallProblems(box(`<p>${'а'.repeat(400)}</p>`))).toEqual([expect.stringMatching(/^400 знаков/)]);
  });

  it('контрольный образец: тот же текст абзацем и списком, длинная метка книги не в счёт', () => {
    const split = box(`<p>${'а'.repeat(200)}</p><ul><li>${'а'.repeat(200)}</li></ul>`);
    expect(wallProblems(split)).toEqual([]);
    expect(wallProblems(box(`<p>${'а'.repeat(290)} [Арнтц ПРЛ, гл. 2; Rijkeboer &amp; Lobbestael, 2012; van Wijk-Herbrink et al., 2018]</p>`))).toEqual([]);
  });
});
