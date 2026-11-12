// @vitest-environment jsdom
// Стрелки рисунком (принцип 7): глиф «←/→» уходит из текста, слова и доступное имя остаются.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BackLabel, withStepArrows } from './NavGlyphs';

afterEach(cleanup);

describe('NavGlyphs', () => {
  it('BackLabel: имя ссылки — только слова, стрелка — svg вне дерева доступности', () => {
    const { container } = render(<a href="/"><BackLabel>На главную</BackLabel></a>);
    expect(screen.getByRole('link', { name: 'На главную' })).toBeTruthy();
    expect(container.textContent).toBe('На главную');
    expect(container.querySelector('[aria-hidden="true"] svg')).toBeTruthy();
  });

  it('withStepArrows: «→» между пунктами — рисунком с подписью «→», части текста целиком', () => {
    const { container } = render(<p>{withStepArrows('Или меню браузера → «Сохранить» → «Установить…»')}</p>);
    expect(container.textContent).toBe('Или меню браузера«Сохранить»«Установить…»');
    expect(screen.getAllByRole('img', { name: '→' })).toHaveLength(2);
  });

  it('контроль: строка без стрелки остаётся строкой, форматер применяется', () => {
    expect(withStepArrows('Меню ⋮ справа вверху', (s) => s.toUpperCase())).toBe('МЕНЮ ⋮ СПРАВА ВВЕРХУ');
  });
});
