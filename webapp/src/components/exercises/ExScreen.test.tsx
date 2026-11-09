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

// Редизайн 2026-11: герой на бумаге упражнения (look → EntitySheet), подсказка до поля на телефоне
// (hintBeforeField) и разворот (spread). Без них разметка прежняя — 40 экранов не сдвигаются.
describe('ExScreen — герой и раскладки', () => {
  const aside = <button type="button">С чего начать</button>;

  it('без look — прежняя шапка: ds-h2 в основной колонке, листа нет', () => {
    const { container } = render(<ExScreen onBack={vi.fn()} eyebrow="Письмо" title="Себе маленькому" aside={aside}>поле</ExScreen>);
    expect(container.querySelector('.pa-sheet')).toBeNull();
    expect(container.querySelector('.ex2-body > .ex2-main > h1.ds-h2')).toBeTruthy();
    const body = container.querySelector('.ex2-body')!;
    expect([...body.children].map((c) => c.className)).toEqual(['ex2-main', 'ex2-aside']);
  });

  it('look — лист упражнения: надпись, h1 Literata и подводка на бумаге, знак из ENTITY_LOOK', () => {
    const { container } = render(<ExScreen onBack={vi.fn()} look="letter" eyebrow="Упражнение" title="Письмо" lede="Ребёнку, которым ты был">поле</ExScreen>);
    const sheet = container.querySelector('.ex2-main > .pa-sheet.ex2-hero') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.getAttribute('data-sign')).toBe('sheets');
    expect(sheet.style.getPropertyValue('--h')).toBe('290');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.className).toBe('pa-sheet-title');
    expect(sheet.contains(screen.getByText('Ребёнку, которым ты был'))).toBe(true);
    expect(container.querySelector('.ex2-title')).toBeNull();
  });

  it('look + heroArt — сцена с данными вместо знака; прежний art при look не рисуется', () => {
    const { container } = render(
      <ExScreen onBack={vi.fn()} look="childhood_wheel" heroArt={<i data-testid="scene" />} art={<i data-testid="old" />} eyebrow="Колесо" title="Детство" compact>поле</ExScreen>,
    );
    const sheet = container.querySelector('.pa-sheet')!;
    expect(sheet.className).toContain('pa-sheet--compact');
    expect(sheet.querySelector('.pa-sheet-art [data-testid="scene"]')).toBeTruthy();
    expect(sheet.hasAttribute('data-sign')).toBe(false);
    expect(container.querySelector('[data-testid="old"]')).toBeNull();
  });

  // Принцип 5: на 390 до первого поля — только шапка и лист; «самопомощь» у героя — под кнопками.
  it('у героя «самопомощь» — наклейкой после кнопок, во всех трёх раскладках', () => {
    localStorage.clear();
    const foot = <button type="button">Запечатать</button>;
    const tail = (main: Element) => [...main.children].at(-1)!;
    const { container, rerender } = render(<ExScreen onBack={vi.fn()} look="letter" eyebrow="Письмо" title="Себе" caution foot={foot}><textarea /></ExScreen>);
    let main = container.querySelector('.ex2-main')!;
    expect(main.querySelector('.pa-sheet')!.nextElementSibling?.tagName).toBe('TEXTAREA');
    expect(tail(main).className).toBe('th-caution th-caution--compact');
    expect(tail(main).previousElementSibling?.textContent).toBe('Запечатать');

    rerender(<ExScreen onBack={vi.fn()} look="letter" eyebrow="Письмо" title="Себе" caution foot={foot} aside={aside} hintBeforeField><textarea /></ExScreen>);
    expect(container.querySelector('.ex2-head .th-caution')).toBeNull();
    main = container.querySelector('.ex2-body--split > .ex2-main')!;
    expect(tail(main).className).toBe('th-caution th-caution--compact');

    rerender(<ExScreen onBack={vi.fn()} look="letter" eyebrow="Письмо" title="Себе" caution foot={foot} aside={aside} spread><textarea /></ExScreen>);
    const [side, spreadMain] = [...container.querySelector('.pa-spread')!.children];
    expect(side.querySelector('.th-caution')).toBeNull();
    expect(tail(spreadMain).className).toBe('th-caution th-caution--compact');
  });

  it('cautionAt="head" — наклейка под листом, если экран так выбрал; без look — полное под шапкой', () => {
    localStorage.clear();
    const { container, rerender } = render(<ExScreen onBack={vi.fn()} look="letter" eyebrow="Письмо" title="Себе" caution cautionAt="head">поле</ExScreen>);
    expect(container.querySelector('.pa-sheet')!.nextElementSibling?.className).toBe('th-caution th-caution--compact');
    rerender(<ExScreen onBack={vi.fn()} eyebrow="Письмо" title="Себе" lede="Подводка" caution>поле</ExScreen>);
    expect(container.querySelector('.ex2-lede')!.nextElementSibling?.className).toBe('th-caution');
  });

  it('hintBeforeField: шапка, подсказка, поле — по порядку (на телефоне подсказка до поля)', () => {
    const { container } = render(
      <ExScreen onBack={vi.fn()} look="letter" eyebrow="Письмо" title="Себе" aside={aside} hintBeforeField foot={<button type="button">Запечатать</button>}>поле</ExScreen>,
    );
    const body = container.querySelector('.ex2-body.ex2-body--split')!;
    expect([...body.children].map((c) => c.className)).toEqual(['ex2-head', 'ex2-aside', 'ex2-main']);
    expect(body.querySelector('.ex2-head .pa-sheet')).toBeTruthy();
    expect(body.querySelector('.ex2-main')?.textContent).toBe('полеЗапечатать');
  });

  it('hintBeforeField без подсказки — прежняя раскладка в одну колонку', () => {
    const { container } = render(<ExScreen onBack={vi.fn()} eyebrow="Письмо" title="Себе" hintBeforeField>поле</ExScreen>);
    expect(container.querySelector('.ex2-body')?.className).toBe('ex2-body ex2-body--single');
  });

  it('spread: шапка и подсказка — в боковой колонке разворота, поле — в основной', () => {
    const { container } = render(
      <ExScreen onBack={vi.fn()} look="letter" eyebrow="Письмо" title="Себе" aside={aside} spread>поле</ExScreen>,
    );
    const spreadEl = container.querySelector('.ex2-body.ex2-body--spread > .pa-spread')!;
    const [side, main] = [...spreadEl.children];
    expect(side.querySelector('.pa-sheet')).toBeTruthy();
    expect(side.querySelector('.ex2-aside')).toBeTruthy();
    expect(main.textContent).toBe('поле');
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
