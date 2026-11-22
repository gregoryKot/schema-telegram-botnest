// @vitest-environment jsdom
// Лист потребности «Справочника»: каркас GuidePage — «Потребность» в шапке, герой с описанием и знаком,
// домен схем с «общим для домена», схемы домена строками; тап по схеме зовёт открытие её листа.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NeedGuideSheet } from './NeedGuideSheet';
import type { NeedGuideView } from '../../../sections/guide/guideReferenceNeeds';

const NEED: NeedGuideView = {
  id: 'attachment', name: 'Привязанность', subtitle: 'Безопасность и связь', desc: 'Рядом есть надёжные люди.',
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
  it('шапка «Потребность»; герой — название, описание и знак; домен с пояснением; источников и «Подробнее» нет', () => {
    const { dialog } = renderSheet();
    expect(within(dialog).getByText('Потребность')).toBeTruthy();
    expect(within(dialog).getByRole('heading', { level: 2, name: NEED.name })).toBeTruthy();
    expect(within(dialog).getByText(NEED.desc)).toBeTruthy();
    expect(dialog.querySelector('.gd-hero svg.pp-art--hero')).not.toBeNull();
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Когда потребность не закрыта', 'Схемы']);
    const domain = within(screen.getByRole('region', { name: 'Когда потребность не закрыта' }));
    expect(domain.getByText(NEED.domain.name)).toBeTruthy();
    expect(domain.getByText(NEED.domain.note)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Подробнее' })).toBeNull();
  });

  it('схемы домена — строки с непокрытой потребностью; тап открывает лист схемы', () => {
    const { onOpenSchema, onClose } = renderSheet();
    const rows = within(screen.getByRole('region', { name: 'Схемы' })).getAllByRole('button');
    expect(rows.map((r) => r.textContent)).toEqual(['Покинутость / НестабильностьНадёжная, предсказуемая связь', 'Недоверие / Ожидание жестокого обращения']);
    fireEvent.click(rows[1]);
    expect(onOpenSchema).toHaveBeenCalledWith('mistrust');
    expect(onClose).not.toHaveBeenCalled();
  });
});
