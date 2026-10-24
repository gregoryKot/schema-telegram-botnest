// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import {
  ConceptViewSwitch,
  defaultConceptView,
  useConceptView,
} from './ConceptViewSwitch';

describe('ConceptViewSwitch', () => {
  it('две кнопки, активная помечена aria-pressed', () => {
    render(<ConceptViewSwitch view="graph" onChange={() => {}} />);
    expect(
      screen
        .getByRole('button', { name: 'Схема' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Поля' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('тап по неактивной кнопке зовёт onChange с видом', () => {
    const onChange = vi.fn();
    render(<ConceptViewSwitch view="graph" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Поля' }));
    expect(onChange).toHaveBeenCalledWith('fields');
  });

  it('тап-цель не ниже 44', () => {
    render(<ConceptViewSwitch view="graph" onChange={() => {}} />);
    for (const name of ['Схема', 'Поля']) {
      expect(screen.getByRole('button', { name }).style.minHeight).toBe('44px');
    }
  });
});

describe('defaultConceptView / useConceptView', () => {
  it('есть режимы — схема, нет — поля', () => {
    expect(defaultConceptView(3)).toBe('graph');
    expect(defaultConceptView(0)).toBe('fields');
  });

  it('вид выбирается при открытии и не прыгает, когда режимы добавляются позже', () => {
    const { result, rerender } = renderHook(({ n }) => useConceptView(n), {
      initialProps: { n: 0 },
    });
    expect(result.current[0]).toBe('fields');
    rerender({ n: 2 });
    expect(result.current[0]).toBe('fields');
    act(() => result.current[1]('graph'));
    expect(result.current[0]).toBe('graph');
    rerender({ n: 0 });
    expect(result.current[0]).toBe('graph');
  });
});
