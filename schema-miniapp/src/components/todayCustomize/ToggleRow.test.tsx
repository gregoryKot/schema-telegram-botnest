// @vitest-environment jsdom
// Строка-тумблер листа «Настроить экран» трекера (CLAUDE.md — приоритет
// покрытия «экраны трекера»). iOS-ряд: вся строка — role=switch с
// aria-checked; вложенный визуал Toggle презентационный (aria-hidden), не
// должен создавать второй tab-стоп/срабатывание.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToggleRow } from './ToggleRow';

afterEach(() => {
  cleanup();
});

describe('ToggleRow', () => {
  it('включено — role=switch, aria-checked=true', () => {
    render(
      <ToggleRow
        emoji="📊"
        title="Серия дней"
        sub="Показывать карточку серии"
        on={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('switch', { checked: true })).toBeTruthy();
  });

  it('выключено — role=switch, aria-checked=false', () => {
    render(
      <ToggleRow
        emoji="📊"
        title="Серия дней"
        sub="Показывать карточку серии"
        on={false}
        onToggle={() => {}}
      />,
    );
    expect(screen.getByRole('switch', { checked: false })).toBeTruthy();
  });

  it('клик по строке вызывает onToggle один раз', () => {
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

  it('один tab-стоп: вложенный визуал свитча не виден как второй switch', () => {
    render(
      <ToggleRow
        emoji="📊"
        title="Серия дней"
        sub="Показывать карточку серии"
        on={true}
        onToggle={() => {}}
      />,
    );
    expect(screen.getAllByRole('switch')).toHaveLength(1);
  });
});
