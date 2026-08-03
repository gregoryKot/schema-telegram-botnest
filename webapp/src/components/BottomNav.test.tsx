// @vitest-environment jsdom
// BottomNav — нижняя навигация (0% покрытия). Логика минимальна (иконки —
// чистый JSX), но проверяем контракт: активная вкладка подсвечена, клик
// зовёт onSelect с правильным разделом, рендерятся все 5 вкладок.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BottomNav } from './BottomNav';

afterEach(() => {
  cleanup();
});

describe('BottomNav', () => {
  it('рендерит все 5 вкладок с подписями', () => {
    render(<BottomNav section="today" onSelect={vi.fn()} />);
    for (const label of ['Сегодня', 'Дневник', 'Паттерны', 'Практика', 'Профиль']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('клик по вкладке вызывает onSelect с её id', () => {
    const onSelect = vi.fn();
    render(<BottomNav section="today" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Дневник'));
    expect(onSelect).toHaveBeenCalledWith('diary');
  });

  it('активная вкладка получает акцентный цвет текста, остальные — нейтральный', () => {
    render(<BottomNav section="schemas" onSelect={vi.fn()} />);
    const active = screen.getByText('Паттерны');
    const inactive = screen.getByText('Сегодня');
    expect(active.style.color).toBe('rgb(96, 165, 250)');
    expect(inactive.style.color).toBe('var(--text-faint)');
  });
});
