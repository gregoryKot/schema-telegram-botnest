// @vitest-environment jsdom
// ScreenCustomizeSheet — generic лист «что показывать» по экрану. Проверяем:
// рендерит блоки экрана из реестра, клик по строке зовёт onToggle(id),
// подсветка нужной строки, «Готово» закрывает, «Паттерны» (пустой реестр
// order пока) не рендерят ни одной строки и не падают.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ScreenCustomizeSheet } from './ScreenCustomizeSheet';

afterEach(cleanup);

describe('ScreenCustomizeSheet', () => {
  it('рендерит заголовок и все блоки экрана «Профиль»', () => {
    render(
      <ScreenCustomizeSheet
        screen="profile"
        hidden={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Настроить экран')).toBeTruthy();
    expect(screen.getByText('Мой путь')).toBeTruthy();
    expect(screen.getByText('Серия дней')).toBeTruthy();
    expect(screen.getByText('Календарь активности')).toBeTruthy();
    expect(screen.getByText('Достижения')).toBeTruthy();
    expect(screen.getByText('Паттерны')).toBeTruthy();
  });

  it('клик по видимому блоку вызывает onToggle(id)', () => {
    const onToggle = vi.fn();
    render(
      <ScreenCustomizeSheet
        screen="profile"
        hidden={[]}
        onToggle={onToggle}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Серия дней'));
    expect(onToggle).toHaveBeenCalledWith('streak');
  });

  it('скрытый блок показан как выключенный тумблер (aria-checked=false)', () => {
    render(
      <ScreenCustomizeSheet
        screen="profile"
        hidden={['streak']}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const row = screen.getByText('Серия дней').closest('[role="switch"]');
    expect(row?.getAttribute('aria-checked')).toBe('false');
  });

  it('highlight подсвечивает нужную строку и не трогает остальные', () => {
    render(
      <ScreenCustomizeSheet
        screen="profile"
        hidden={[]}
        highlight="heatmap"
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const highlighted = screen
      .getByText('Календарь активности')
      .closest('[role="switch"]') as HTMLElement;
    const other = screen
      .getByText('Серия дней')
      .closest('[role="switch"]') as HTMLElement;
    expect(highlighted.style.background).not.toBe('');
    expect(other.style.background).toBe('');
  });

  it('«Готово» закрывает лист', () => {
    const onClose = vi.fn();
    render(
      <ScreenCustomizeSheet
        screen="profile"
        hidden={[]}
        onToggle={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalled();
  });

  it('экран «Паттерны» (реестр порядка пока пуст) не рендерит строк и не падает', () => {
    render(
      <ScreenCustomizeSheet
        screen="patterns"
        hidden={[]}
        onToggle={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });
});
