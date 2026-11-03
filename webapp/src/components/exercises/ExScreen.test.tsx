// @vitest-environment jsdom
// ExScreen — общая оболочка упражнений: шапка «Назад» на ds-sheet-head/ds-back
// (#906; липкость и --safe-top несёт .ex2-top — safeTop.test.ts), заголовок —
// ds-h2 без локального кегля, eyebrow и lede на месте, backLabel подменяет подпись.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExScreen } from './ExScreen';

afterEach(cleanup);

describe('ExScreen — шапка листа (#906)', () => {
  it('«Назад к упражнениям» — ds-back внутри липкой .ds-sheet-head.ex2-top, зовёт onBack', () => {
    const onBack = vi.fn();
    render(<ExScreen onBack={onBack} eyebrow="Упражнение" title="Письмо">тело</ExScreen>);
    const back = screen.getByRole('button', { name: 'Назад к упражнениям' });
    expect(back.className).toBe('ds-back');
    const head = back.parentElement!;
    expect(head.classList.contains('ds-sheet-head')).toBe(true);
    expect(head.classList.contains('ex2-top')).toBe(true);
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('backLabel подменяет подпись; заголовок — ds-h2 без локального кегля, eyebrow и lede на месте', () => {
    render(<ExScreen onBack={() => {}} backLabel="Закрыть" eyebrow="Разбор" title="Фраза" lede="Подсказка" />);
    expect(screen.getByRole('button', { name: 'Закрыть' }).className).toBe('ds-back');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Фраза');
    expect(h1.classList.contains('ds-h2')).toBe(true);
    expect(screen.getByText('Разбор').className).toBe('ds-eyebrow');
    expect(screen.getByText('Подсказка').className).toContain('ds-sub');
  });
});
