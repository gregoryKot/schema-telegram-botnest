// @vitest-environment jsdom
// Итог упражнения — одна рамка на группу (ревью g6): колонка «прошлых» справа есть, только когда есть что
// в неё положить; строка прошлого — одна разметка (знак, дата, цитата), нажимается целиком, если есть onOpen.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExDonePage, ExPastList, ExPastRow } from './ExDonePage';

describe('ExDonePage', () => {
  it('с историей — колонка side и класс --side; бар «Назад» зовёт onBack', () => {
    const onBack = vi.fn();
    const { container } = render(
      <ExDonePage onBack={onBack} side={<ExPastList label="Прошлые письма · 1"><ExPastRow sign="sheets" date="вчера" quote="Привет" /></ExPastList>}>
        <p>лист</p>
      </ExDonePage>,
    );
    const page = container.querySelector('.ex2-screen > .ex2-done-page')!;
    expect(page.className).toBe('ex2-done-page ex2-done-page--side');
    expect([...page.children].map((c) => c.className)).toEqual(['ex2-done-main', 'ex2-done-side']);
    expect(page.querySelector('.ex2-done-side .ex2-past .pp-art--row')).toBeTruthy();
    expect(screen.getByText('«Привет»').className).toBe('ex2-past-snip');
    fireEvent.click(container.querySelector('.ex2-top .ds-back')!);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('без истории (false/undefined) — колонки нет, лист по центру', () => {
    for (const side of [undefined, false]) {
      const { container, unmount } = render(<ExDonePage onBack={() => {}} side={side}><p>лист</p></ExDonePage>);
      expect(container.querySelector('.ex2-done-page')!.className).toBe('ex2-done-page');
      expect(container.querySelector('.ex2-done-side')).toBeNull();
      unmount();
    }
  });

  it('строка с onOpen — кнопка с подписью, нажимается целиком', () => {
    const onOpen = vi.fn();
    render(<ExPastRow sign="looming" date="сегодня" quote="Опять" onOpen={onOpen} openLabel="Открыть разбор: Опять" />);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть разбор: Опять' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('колонка справа — только на ≥1024 (ex-done.css)', () => {
    const css = readFileSync(join(__dirname, '../../styles/ex-done.css'), 'utf8');
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\s*\.ex2-done-page--side \{ grid-template-columns: minmax\(0, 540px\) minmax\(300px, 420px\); \}/);
  });
});
