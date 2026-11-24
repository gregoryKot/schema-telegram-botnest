// @vitest-environment jsdom
// Лист потребности «Справочника»: каркас GuidePage — «Потребность» в шапке, герой с сутью для терапевта и знаком,
// разделы листа потребности, схемы домена строками (тап зовёт открытие листа схемы), «Источники» из данных.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NeedGuideSheet } from './NeedGuideSheet';
import type { NeedGuideView } from '../../../sections/guide/guideReferenceNeeds';

const NEED: NeedGuideView = {
  id: 'attachment', name: 'Привязанность', subtitle: 'Безопасность и связь',
  guide: {
    id: 'attachment', subtitle: 'Безопасность и связь', essence: 'Потребность в надёжной привязанности.',
    frustration: 'Заботы не хватало.', schemas: 'Складывается домен.', care: 'Терапевт — надёжная база.', sources: '[Янг, гл. 1]',
  },
  domain: { id: 'rejection', name: 'Нарушение связи и отвержение', note: 'В основе нарушенная привязанность.' },
  schemas: [
    { id: 'abandonment', name: 'Покинутость / Нестабильность', need: 'Надёжная, предсказуемая связь' },
    { id: 'mistrust', name: 'Недоверие / Ожидание жестокого обращения', need: ' ' },
  ],
};

function renderSheet(need: NeedGuideView = NEED) {
  const onOpenSchema = vi.fn();
  const onClose = vi.fn();
  render(<MemoryRouter><NeedGuideSheet need={need} onOpenSchema={onOpenSchema} onClose={onClose} /></MemoryRouter>);
  return { onOpenSchema, onClose, dialog: screen.getByRole('dialog', { name: need.name }) };
}

describe('NeedGuideSheet', () => {
  it('шапка «Потребность»; герой — название, суть для терапевта и знак; разделы листа и источники — из данных', () => {
    const { dialog } = renderSheet();
    expect(within(dialog).getByText('Потребность')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { level: 2, name: NEED.name })).toBeTruthy();
    expect(within(dialog).getByText(NEED.guide!.essence)).toBeTruthy();
    expect(dialog.querySelector('.gd-hero svg.pp-art--hero')).not.toBeNull();
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')))
      .toEqual(['Фрустрация в детстве', 'Схемы домена', 'Ограниченное родительство', 'Общее для домена']);
    expect(within(screen.getByRole('region', { name: 'Схемы домена' })).getByText(NEED.guide!.schemas)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Общее для домена' })).getByText(NEED.domain.note)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Источники · \d+ книг/ }));
    expect(screen.getAllByText(/Янг/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('тексты не доехали — на листе остаются домен и его схемы', () => {
    renderSheet({ ...NEED, guide: undefined, domain: { ...NEED.domain, note: '' } });
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Схемы домена']);
    expect(screen.getByText(NEED.domain.name)).toBeTruthy();
  });

  it('схемы домена — чипы; тап открывает лист схемы', () => {
    const { onOpenSchema, onClose } = renderSheet();
    const rows = within(screen.getByRole('region', { name: 'Схемы домена' })).getAllByRole('button');
    expect(rows.map((r) => r.textContent)).toEqual(['Покинутость / Нестабильность', 'Недоверие / Ожидание жестокого обращения']);
    fireEvent.click(rows[1]);
    expect(onOpenSchema).toHaveBeenCalledWith('mistrust');
    expect(onClose).not.toHaveBeenCalled();
  });
});
