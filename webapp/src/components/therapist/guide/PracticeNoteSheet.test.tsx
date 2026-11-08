// @vitest-environment jsdom
// Лист раздела «Для терапевта» (живой язык 2026-11): тот же каркас GuidePage, что у листов
// режима, схемы и техники, — «Для терапевта» в шапке, герой с сутью и знаком раздела, «Что
// делать» пунктами, «Как это звучит» в кавычках, `more` под «Подробнее», источники. Оболочка —
// панель (ConceptFullscreenSheet `panel`): затемнение рядом закрывает лист, как «Закрыть», а
// лист без `panel` остаётся на весь экран, без затемнения. Содержание — фикстура, не
// shared/src/schemaTherapy/guide/practice.ts.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticeNoteSheet } from './PracticeNoteSheet';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import type { PracticeNote } from '../../../../../shared/src/schemaTherapy/guide';
import { FIXTURE_PRACTICE_NOTE as NOTE } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide.fixture';

const regions = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));

function renderNote(note: PracticeNote = NOTE) {
  const onClose = vi.fn();
  const view = render(<MemoryRouter><PracticeNoteSheet note={note} onClose={onClose} /></MemoryRouter>);
  return { ...view, onClose, dialog: screen.getByRole('dialog', { name: note.title }) };
}

describe('PracticeNoteSheet', () => {
  it('шапка «Для терапевта»; герой — заголовок, суть и знак раздела; затем «Что делать», «Как это звучит», источники', () => {
    const { dialog } = renderNote();
    expect(within(dialog).getByText('Для терапевта')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { level: 2, name: NOTE.title })).toBeTruthy();
    expect(within(dialog).getByText(NOTE.summary)).toBeTruthy();
    expect(dialog.querySelector('.gd-hero svg.pp-art--hero')).not.toBeNull();
    expect(regions()).toEqual(['Что делать', 'Как это звучит', 'Источники']);
    const points = within(screen.getByRole('region', { name: 'Что делать' })).getAllByRole('listitem');
    expect(points.map((li) => li.textContent)).toEqual(NOTE.points);
    expect(screen.getByText(`«${NOTE.voice![0]}»`)).toBeTruthy();
    expect(screen.getByText(NOTE.sources)).toBeTruthy();
  });

  it('`more` — под «Подробнее»: закрыто, по тапу открывается', () => {
    renderNote();
    expect(screen.queryByText(NOTE.more![0])).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }));
    expect(screen.getByText(NOTE.more![0])).toBeTruthy();
  });

  it('раздел без реплик, `more` и своего знака — без этих блоков и без чужой картинки', () => {
    const { dialog } = renderNote({ ...NOTE, id: 'нет_знака', voice: undefined, more: undefined, points: ['Один пункт.', ' '] });
    expect(dialog.querySelector('.gd-hero svg')).toBeNull();
    expect(regions()).toEqual(['Что делать', 'Источники']);
    expect(within(screen.getByRole('region', { name: 'Что делать' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('панель: тап по затемнению закрывает лист, как «Закрыть»', () => {
    const { container, dialog, onClose } = renderNote();
    expect(dialog.className).toBe('cfs-panel');
    fireEvent.click(container.querySelector('.cfs-layer > .cfs-scrim')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConceptFullscreenSheet без panel', () => {
  it('лист на весь экран, без затемнения рядом («Главное», схема у клиента)', () => {
    const { container } = render(
      <MemoryRouter>
        <ConceptFullscreenSheet title="Главное" closeLabel="Закрыть" onClose={() => {}}>текст</ConceptFullscreenSheet>
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Главное' });
    expect(dialog.style.position).toBe('fixed');
    expect(dialog.style.inset).toBe('0px');
    expect(container.querySelector('.cfs-scrim, .cfs-layer')).toBeNull();
  });
});
