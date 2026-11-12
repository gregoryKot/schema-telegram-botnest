// @vitest-environment jsdom
// Стрелки рисунком (принцип 7): глиф «←/→» уходит из текста, слова и доступное имя остаются.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BackLabel, StepText } from './NavGlyphs';

afterEach(cleanup);

describe('NavGlyphs', () => {
  it('BackLabel: имя ссылки — только слова, стрелка — svg вне дерева доступности', () => {
    const { container } = render(<a href="/"><BackLabel>На главную</BackLabel></a>);
    expect(screen.getByRole('link', { name: 'На главную' })).toBeTruthy();
    expect(container.textContent).toBe('На главную');
    expect(container.querySelector('[aria-hidden="true"] svg')).toBeTruthy();
  });

  it('StepText: «→» между пунктами — рисунком с подписью «→», части текста целиком', () => {
    const { container } = render(<p><StepText text="Или меню браузера → «Сохранить» → «Установить…»" /></p>);
    expect(container.textContent).toBe('Или меню браузера«Сохранить»«Установить…»');
    expect(screen.getAllByRole('img', { name: '→' })).toHaveLength(2);
  });

  it('контроль: строка без стрелки остаётся строкой, форматер применяется', () => {
    const { container } = render(<p><StepText text="Меню ⋮ справа вверху" fmt={(s) => s.toUpperCase()} /></p>);
    expect(container.textContent).toBe('МЕНЮ ⋮ СПРАВА ВВЕРХУ');
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});
