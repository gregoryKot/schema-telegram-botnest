// @vitest-environment jsdom
// Вынесено из IntroSheetShell.tsx (правило №10 CLAUDE.md) — вёрстка не
// менялась, тест фиксирует поведение до/после выноса.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { IntroSheetHeader, HeaderInfoButton } from './IntroSheetHeader';

afterEach(() => {
  cleanup();
});

describe('IntroSheetHeader', () => {
  it('рендерит эмодзи, заголовок и подзаголовок', () => {
    render(
      <IntroSheetHeader
        emoji="🥺"
        title="Уязвимый Ребёнок"
        subtitle="Детские режимы"
        accentColor="#60a5fa"
        showDescription={false}
      />,
    );
    expect(screen.getByText('🥺')).toBeTruthy();
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Детские режимы')).toBeTruthy();
  });

  it('description показывается только при showDescription=true', () => {
    const { rerender } = render(
      <IntroSheetHeader
        emoji="🥺"
        title="Т"
        subtitle="П"
        accentColor="#60a5fa"
        description="Описание режима"
        showDescription={false}
      />,
    );
    expect(screen.queryByText('Описание режима')).toBeNull();

    rerender(
      <IntroSheetHeader
        emoji="🥺"
        title="Т"
        subtitle="П"
        accentColor="#60a5fa"
        description="Описание режима"
        showDescription
      />,
    );
    expect(screen.getByText('Описание режима')).toBeTruthy();
  });

  it('explainer показывается только если передан', () => {
    const { rerender } = render(
      <IntroSheetHeader
        emoji="🥺"
        title="Т"
        subtitle="П"
        accentColor="#60a5fa"
        showDescription={false}
      />,
    );
    expect(screen.queryByText('Зачем это')).toBeNull();

    rerender(
      <IntroSheetHeader
        emoji="🥺"
        title="Т"
        subtitle="П"
        accentColor="#60a5fa"
        showDescription={false}
        explainer="Зачем это"
      />,
    );
    expect(screen.getByText('Зачем это')).toBeTruthy();
  });

  it('headerAction рендерится рядом с названием, если передан', () => {
    render(
      <IntroSheetHeader
        emoji="🥺"
        title="Т"
        subtitle="П"
        accentColor="#60a5fa"
        showDescription={false}
        headerAction={<button>Доп. действие</button>}
      />,
    );
    expect(screen.getByText('Доп. действие')).toBeTruthy();
  });
});

describe('HeaderInfoButton', () => {
  it('кликабельна, зона нажатия ≥44×44, зовёт onClick', () => {
    const onClick = vi.fn();
    render(<HeaderInfoButton onClick={onClick} />);
    const btn = screen.getByLabelText('Про режим');
    expect(btn.style.width).toBe('44px');
    expect(btn.style.height).toBe('44px');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('label переопределяем', () => {
    render(<HeaderInfoButton onClick={() => {}} label="Про схему" />);
    expect(screen.getByLabelText('Про схему')).toBeTruthy();
  });
});
