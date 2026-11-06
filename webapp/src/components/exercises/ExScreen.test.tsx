// @vitest-environment jsdom
// ExScreen — общая оболочка упражнений: шапка «Назад» на ds-sheet-head/ds-back
// (#906; липкость и --safe-top несёт .ex2-top — safeTop.test.ts), заголовок —
// ds-h2 без локального кегля, eyebrow и lede на месте, backLabel подменяет подпись.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExScreen, ExScreenSkeleton } from './ExScreen';

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

// Бэклог «Объяснения упражнений не доезжают до телефона»: старый `.ex-aside`
// прятался на ≤767px вместе с «откуда и зачем» и кнопками «Сменить схему/режим».
// Боковая колонка обязана остаться на телефоне — встать под основную.
describe('ExScreen — aside на телефоне', () => {
  const css = readFileSync(join(__dirname, '../../styles/sheet-exercises.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const asideRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(m => /\.ex2-aside(?![\w-])/.test(m[1]));

  it('нигде не скрыт: ни display: none, ни visibility: hidden', () => {
    expect(asideRules.length).toBeGreaterThan(0);
    for (const [, , body] of asideRules) expect(body).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it('рендерится в DOM рядом с основной колонкой: кнопки из aside доступны', () => {
    const onSwitch = vi.fn();
    render(<ExScreen onBack={vi.fn()} eyebrow="Схема" title="Покинутость" aside={<button onClick={onSwitch}>Сменить схему</button>}>тело</ExScreen>);
    fireEvent.click(screen.getByRole('button', { name: 'Сменить схему' }));
    expect(onSwitch).toHaveBeenCalled();
    expect(document.querySelector('.ex2-body .ex2-aside')).toBeTruthy();
  });
});

describe('ExScreen — предупреждение о самопомощи', () => {
  it('caution рендерит предупреждение, без него — нет', () => {
    localStorage.clear();
    const { rerender } = render(<ExScreen onBack={() => {}} eyebrow="Упражнение" title="Письмо" lede="Подсказка">тело</ExScreen>);
    expect(screen.queryByText('Это самопомощь, не замена терапии.')).toBeNull();
    rerender(<ExScreen onBack={() => {}} eyebrow="Упражнение" title="Письмо" lede="Подсказка" caution>тело</ExScreen>);
    expect(screen.getByText('Это самопомощь, не замена терапии.')).toBeTruthy();
  });
});

// Пока грузится чанк упражнения (Suspense в TaskExerciseHost) — силуэт той же рамки,
// а не крутилка на весь экран (бывший Loader 100dvh).
describe('ExScreenSkeleton', () => {
  it('рамка упражнения с живым «Назад» хоста, тело — плашки без спиннера', () => {
    const onBack = vi.fn();
    const { container } = render(<ExScreenSkeleton onBack={onBack} />);
    expect(container.querySelector('.ex2-screen .ds-sheet-head.ex2-top')).toBeTruthy();
    expect(container.querySelector('.ex2-body[aria-hidden] .skel')).toBeTruthy();
    expect(container.querySelector('.spinner')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Назад к упражнениям' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
