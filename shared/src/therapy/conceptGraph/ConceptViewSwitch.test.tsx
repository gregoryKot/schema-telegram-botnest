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
import { ConceptSkinContext, type ConceptSkin } from './conceptSkin';

const SKIN: ConceptSkin = {
  seg: { group: 'sk-seg', btn: 'sk-seg-btn' },
  label: 'sk-label',
  link: 'sk-link',
  card: 'sk-card',
  fold: { root: 'f-root', btn: 'f-btn', chev: 'f-chev', body: 'f-body' },
  digest: {
    title: 'dg-title',
    list: 'dg-list',
    row: 'dg-row',
    term: 'dg-term',
    value: 'dg-value',
  },
};

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

describe('ConceptViewSwitch со skin', () => {
  it('классы сегмента, is-active по виду, инлайн-стилей нет', () => {
    render(
      <ConceptSkinContext.Provider value={SKIN}>
        <ConceptViewSwitch view="fields" onChange={() => {}} />
      </ConceptSkinContext.Provider>,
    );
    const group = screen.getByRole('group', { name: 'Вид концептуализации' });
    expect(group.className).toBe('sk-seg');
    expect(group.getAttribute('style')).toBeNull();
    const graph = screen.getByRole('button', { name: 'Схема' });
    const fields = screen.getByRole('button', { name: 'Поля' });
    expect(graph.className).toBe('sk-seg-btn');
    expect(fields.className).toBe('sk-seg-btn is-active');
    expect(fields.getAttribute('style')).toBeNull();
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
