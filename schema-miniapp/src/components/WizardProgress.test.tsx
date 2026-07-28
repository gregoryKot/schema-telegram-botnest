// @vitest-environment jsdom
// Общий примитив прогресса визарда (правило «одна механика — один компонент»,
// CLAUDE.md) — используется IntroSheetShell и ModeDiaryWizard.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WizardProgress } from './WizardProgress';

afterEach(() => {
  cleanup();
});

describe('WizardProgress', () => {
  it('рендерит по одному сегменту на каждый элемент segments', () => {
    const { container } = render(
      <WizardProgress
        segments={[{ filled: false }, { filled: false }, { filled: false }]}
        active={0}
        accentColor="#a78bfa"
      />,
    );
    expect(container.firstChild?.childNodes.length).toBe(3);
  });

  it('заполненный сегмент красится в accent', () => {
    const { container } = render(
      <WizardProgress
        segments={[{ filled: true }, { filled: false }]}
        active={1}
        accentColor="#a78bfa"
      />,
    );
    const [first] = container.firstChild!
      .childNodes as unknown as HTMLElement[];
    expect(first.style.background).toBe('rgb(167, 139, 250)');
  });

  it('активный незаполненный сегмент — полупрозрачный accent', () => {
    const { container } = render(
      <WizardProgress
        segments={[{ filled: false }, { filled: false }]}
        active={1}
        accentColor="#a78bfa"
      />,
    );
    const [, second] = container.firstChild!
      .childNodes as unknown as HTMLElement[];
    expect(second.style.background).toBe('rgba(167, 139, 250, 0.333)');
  });

  it('неактивный незаполненный сегмент — var(--surface-2)', () => {
    const { container } = render(
      <WizardProgress
        segments={[{ filled: false }, { filled: false }]}
        active={0}
        accentColor="#a78bfa"
      />,
    );
    const [, second] = container.firstChild!
      .childNodes as unknown as HTMLElement[];
    expect(second.style.background).toBe('var(--surface-2)');
  });

  it('клик по сегменту зовёт onSelect с индексом', () => {
    const onSelect = vi.fn();
    render(
      <WizardProgress
        segments={[{ filled: false }, { filled: false }, { filled: false }]}
        active={0}
        accentColor="#a78bfa"
        onSelect={onSelect}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('без onSelect клик по сегменту не падает и ничего не зовёт', () => {
    const { container } = render(
      <WizardProgress
        segments={[{ filled: false }, { filled: false }]}
        active={0}
        accentColor="#a78bfa"
      />,
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const [first] = container.firstChild!
      .childNodes as unknown as HTMLElement[];
    expect(() => fireEvent.click(first)).not.toThrow();
  });
});
