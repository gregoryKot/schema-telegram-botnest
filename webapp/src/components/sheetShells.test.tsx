// @vitest-environment jsdom
// Шапки оболочек листов (#906, волна 1, срез F4): «← Назад/Закрыть» — кнопка
// .ds-back внутри .ds-sheet-head, onBack/onClose вызывается по клику.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OverlayFrame } from './OverlayFrame';
import { ExBar } from './exercises/ExBar';
import { ExScreen } from './exercises/ExScreen';
import { FlashcardFrame } from './flashcard/FlashcardFrame';
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

  it('ExBar — бар упражнения: подпись, клик; sticky добавляет липкость .ex2-top', () => {
    const onBack = vi.fn();
    const { rerender } = render(<ExBar onBack={onBack} label="Закрыть" />);
    const b = screen.getByRole('button', { name: 'Закрыть' });
    expectHead(b);
    expect(b.parentElement?.classList.contains('ex2-top')).toBe(false);
    fireEvent.click(b);
    expect(onBack).toHaveBeenCalledTimes(1);
    rerender(<ExBar onBack={onBack} label="Назад" sticky />);
    expect(screen.getByRole('button', { name: 'Назад' }).parentElement?.classList.contains('ex2-top')).toBe(true);
  });

  it('флешкарты и экран упражнения — один бар: та же разметка, у флешкарт без липкости (грид держит отступ)', () => {
    const { container: fc } = render(<FlashcardFrame onBack={vi.fn()} label="Закрыть">x</FlashcardFrame>);
    const { container: ex } = render(<ExScreen onBack={vi.fn()} backLabel="Закрыть" eyebrow="e" title="t" />);
    const fcBar = fc.querySelector('.ds-sheet-head')!;
    const exBar = ex.querySelector('.ds-sheet-head')!;
    expect(fcBar.innerHTML).toBe(exBar.innerHTML);
    expect(exBar.className).toBe('ds-sheet-head ex2-top');
    expect(fcBar.className).toBe('ds-sheet-head');
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
