// @vitest-environment jsdom
// PortraitNeedRows — пять строк потребностей листа «Мой портрет»: все пять
// рендерятся с подписью, тап раскрывает объяснение (переиспользованный текст
// NEEDS_EXPLAINER), второй тап по той же строке схлопывает, тап по другой
// строке переключает аккордеон (открыта только одна за раз).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PortraitNeedRows } from './PortraitNeedRows';
import type { PortraitNeed } from '../../../../shared/src/portrait/portraitData';

afterEach(cleanup);

const needs: PortraitNeed[] = [
  {
    id: 'attachment',
    label: 'Привязанность',
    emoji: '🤝',
    color: '#ff6b9d',
    count: 3,
  },
  {
    id: 'autonomy',
    label: 'Автономия',
    emoji: '🧭',
    color: '#4fa3f7',
    count: 0,
  },
  {
    id: 'expression',
    label: 'Выражение чувств',
    emoji: '💬',
    color: '#facc15',
    count: 1,
  },
  {
    id: 'play',
    label: 'Спонтанность',
    emoji: '🎉',
    color: '#06d6a0',
    count: 0,
  },
  { id: 'limits', label: 'Границы', emoji: '⚖️', color: '#a78bfa', count: 2 },
];

describe('PortraitNeedRows — рендер пяти строк', () => {
  it('рендерит все пять потребностей с подписью и эмодзи, включая нулевые', () => {
    render(<PortraitNeedRows needs={needs} />);
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('Автономия')).toBeTruthy();
    expect(screen.getByText('Выражение чувств')).toBeTruthy();
    expect(screen.getByText('Спонтанность')).toBeTruthy();
    expect(screen.getByText('Границы')).toBeTruthy();
    expect(screen.getByText('🤝')).toBeTruthy();
  });

  it('ни одна строка не раскрыта по умолчанию', () => {
    render(<PortraitNeedRows needs={needs} />);
    expect(screen.queryByText(/Потребность в настоящем контакте/)).toBeNull();
  });
});

describe('PortraitNeedRows — тап раскрывает/схлопывает объяснение', () => {
  it('тап по строке раскрывает объяснение этой потребности (текст NEEDS_EXPLAINER)', () => {
    render(<PortraitNeedRows needs={needs} />);
    fireEvent.click(screen.getByText('Привязанность'));
    expect(screen.getByText(/Потребность в настоящем контакте/)).toBeTruthy();
  });

  it('повторный тап по той же строке схлопывает объяснение', () => {
    render(<PortraitNeedRows needs={needs} />);
    const row = screen.getByText('Привязанность');
    fireEvent.click(row);
    expect(screen.getByText(/Потребность в настоящем контакте/)).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText(/Потребность в настоящем контакте/)).toBeNull();
  });

  it('тап по другой строке переключает аккордеон — раскрыта только одна', () => {
    render(<PortraitNeedRows needs={needs} />);
    fireEvent.click(screen.getByText('Привязанность'));
    expect(screen.getByText(/Потребность в настоящем контакте/)).toBeTruthy();

    fireEvent.click(screen.getByText('Автономия'));
    expect(screen.queryByText(/Потребность в настоящем контакте/)).toBeNull();
    expect(screen.getByText(/Потребность действовать из себя/)).toBeTruthy();
  });

  it('aria-expanded отражает состояние раскрытия строки', () => {
    render(<PortraitNeedRows needs={needs} />);
    const button = screen.getByText('Привязанность').closest('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
