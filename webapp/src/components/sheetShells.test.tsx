// @vitest-environment jsdom
// Шапки оболочек листов (#906, волна 1, срез F4): «← Назад/Закрыть» — кнопка
// .ds-back внутри .ds-sheet-head, onBack/onClose вызывается по клику.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OverlayFrame } from './OverlayFrame';
import { Topbar } from './SchemaFlashcardTopbar';
import { SsSheet } from './schemaSheets/SsSheet';

afterEach(cleanup);

function expectHead(btn: HTMLElement) {
  expect(btn.classList.contains('ds-back')).toBe(true);
  expect(btn.parentElement?.classList.contains('ds-sheet-head')).toBe(true);
}

describe('оболочки листов — ds-sheet-head/ds-back', () => {
  it('OverlayFrame: «Назад» вызывает onBack', () => {
    const onBack = vi.fn();
    render(<OverlayFrame title="Все задания" onBack={onBack}>x</OverlayFrame>);
    const b = screen.getByRole('button', { name: /Назад/ });
    expectHead(b);
    fireEvent.click(b);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Topbar флешкарт: подпись по умолчанию «Закрыть», своя подпись и клик', () => {
    const onBack = vi.fn();
    const { rerender } = render(<Topbar onBack={onBack} />);
    const b = screen.getByRole('button', { name: /Закрыть/ });
    expectHead(b);
    fireEvent.click(b);
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(<Topbar onBack={onBack} label="Назад" />);
    expect(screen.getByRole('button', { name: /Назад/ })).toBeTruthy();
  });

  it('SsSheet: «Назад» слева, правый слот последним ребёнком шапки', () => {
    const onBack = vi.fn();
    render(<SsSheet onBack={onBack} barRight={<button type="button">Готово</button>}>тело</SsSheet>);
    const b = screen.getByRole('button', { name: /Назад/ });
    expectHead(b);
    expect(b.parentElement?.lastElementChild?.textContent).toBe('Готово');
    fireEvent.click(b);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
