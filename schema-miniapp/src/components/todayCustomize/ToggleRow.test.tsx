// @vitest-environment jsdom
// Строка-тумблер листа «Настроить экран» трекера (CLAUDE.md — приоритет
// покрытия «экраны трекера»). Поведение: состояние вкл/выкл, клик переключает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToggleRow } from './ToggleRow';

afterEach(() => {
  cleanup();
});

describe('ToggleRow', () => {
  it('включено — показывает галочку', () => {
    render(
      <ToggleRow
        emoji="📊"
        title="Серия дней"
        sub="Показывать карточку серии"
        on={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('выключено — показывает прочерк', () => {
    render(
      <ToggleRow
        emoji="📊"
        title="Серия дней"
        sub="Показывать карточку серии"
        on={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('клик по строке вызывает onToggle', () => {
    const onToggle = vi.fn();
    render(
      <ToggleRow
        emoji="📊"
        title="Серия дней"
        sub="Показывать карточку серии"
        on={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByText('Серия дней'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
