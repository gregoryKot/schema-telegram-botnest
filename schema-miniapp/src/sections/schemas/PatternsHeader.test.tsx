// @vitest-environment jsdom
// PatternsHeader — шапка «Паттерны». Было: пилюля «Настроить» висела второй
// строкой под «Библиотека» (фидбек владельца с живого устройства — читалась
// как случайная). Теперь шестерёнка GearButton и «Библиотека» — один ряд,
// один общий контейнер actions. Проверяем оба клика и что второй строки нет.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PatternsHeader } from './PatternsHeader';

afterEach(() => {
  cleanup();
});

describe('PatternsHeader', () => {
  // В8 дизайн-аудита 2026-08: заголовок экрана — h1.
  it('«Паттерны» — h1', () => {
    render(<PatternsHeader onOpenSchema={() => {}} onCustomize={() => {}} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Паттерны' }),
    ).toBeTruthy();
  });

  it('шестерёнка и «Библиотека» — в одном ряду actions, без второй строки', () => {
    render(<PatternsHeader onOpenSchema={() => {}} onCustomize={() => {}} />);
    const gear = screen.getByLabelText('Настроить экран');
    const library = screen.getByLabelText('Библиотека схема-терапии');
    // Одна и та же родительская строка actions — не разъехались по разным
    // строкам вёрстки (регресс, который чинит эта задача).
    expect(gear.parentElement).toBe(library.parentElement);
  });

  it('клик по шестерёнке вызывает onCustomize', () => {
    const onCustomize = vi.fn();
    render(
      <PatternsHeader onOpenSchema={() => {}} onCustomize={onCustomize} />,
    );
    fireEvent.click(screen.getByLabelText('Настроить экран'));
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it('клик по «Библиотека» вызывает onOpenSchema', () => {
    const onOpenSchema = vi.fn();
    render(
      <PatternsHeader onOpenSchema={onOpenSchema} onCustomize={() => {}} />,
    );
    fireEvent.click(screen.getByLabelText('Библиотека схема-терапии'));
    expect(onOpenSchema).toHaveBeenCalledTimes(1);
  });
});
