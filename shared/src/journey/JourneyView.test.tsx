// @vitest-environment jsdom
// Тело экрана «Мой путь»: скелетон при загрузке, ошибка, пустое состояние,
// заполненный вид (hero + счётчики + фильтры + таймлайн). Правило онбординга
// CLAUDE.md: explainer обязан звучать в обеих формах через tr() — проверяем,
// что вилка реально доезжает до разметки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JourneyView } from './JourneyView';
import type { JourneyState } from './useJourney';
import type { JourneyItem } from './journeyMeta';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

afterEach(() => {
  cleanup();
});

function baseState(overrides: Partial<JourneyState> = {}): JourneyState {
  return {
    data: null,
    failed: false,
    sortDir: 'desc',
    setSortDir: vi.fn(),
    group: 'all',
    setGroup: vi.fn(),
    period: 'all',
    setPeriod: vi.fn(),
    stats: [],
    total: 0,
    items: [],
    ...overrides,
  };
}

describe('JourneyView — состояния загрузки', () => {
  it('data=null и не failed — показывает переданный скелетон', () => {
    render(
      <JourneyView
        tr={tr}
        j={baseState()}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div data-testid="skeleton" />}
      />,
    );
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });

  it('failed=true — сообщение об ошибке, обе формы обращения через tr()', () => {
    render(
      <JourneyView
        tr={tr}
        j={baseState({ failed: true })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    expect(screen.getByText((c) => c.includes('|'))).toBeTruthy();
  });
});

describe('JourneyView — пустой путь', () => {
  it('total=0 — пустое hero-состояние, а не список с нулями', () => {
    render(
      <JourneyView
        tr={tr}
        j={baseState({ data: { counts: {} as never, items: [] } })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    expect(screen.getByText('Путь ещё впереди')).toBeTruthy();
  });
});

describe('JourneyView — заполненный путь', () => {
  const ITEM: JourneyItem = { type: 'gratitude', at: '2026-07-21T10:00:00Z' };

  it('рендерит hero с итогом, счётчики и таймлайн; кнопка hero зовёт onShareFeed', () => {
    const onShareFeed = vi.fn();
    render(
      <JourneyView
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [ITEM] },
          total: 5,
          items: [ITEM],
          stats: [{ emoji: '🌱', label: 'Благодарности', count: 5 }],
        })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={onShareFeed}
        skeleton={<div />}
      />,
    );
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Поделиться лентой шагов'));
    expect(onShareFeed).toHaveBeenCalledTimes(1);
  });

  it('клик по фильтру-чипу зовёт setGroup, по периоду — setPeriod', () => {
    const setGroup = vi.fn();
    const setPeriod = vi.fn();
    render(
      <JourneyView
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [ITEM] },
          total: 1,
          items: [ITEM],
          setGroup,
          setPeriod,
        })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    fireEvent.click(screen.getByText('Дневники'));
    expect(setGroup).toHaveBeenCalledWith('diary');
    fireEvent.click(screen.getByText('Неделя'));
    expect(setPeriod).toHaveBeenCalledWith('week');
  });

  it('кнопка сортировки переключает направление через setSortDir', () => {
    const setSortDir = vi.fn();
    render(
      <JourneyView
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [ITEM] },
          total: 1,
          items: [ITEM],
          setSortDir,
          sortDir: 'desc',
        })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    fireEvent.click(screen.getByLabelText('Сначала новые'));
    expect(setSortDir).toHaveBeenCalledWith('asc');
  });

  it('total>0, но текущий фильтр/период дал пустой items — «здесь пока пусто»', () => {
    render(
      <JourneyView
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [ITEM] },
          total: 5,
          items: [],
        })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    expect(screen.getByText(/Здесь пока пусто/)).toBeTruthy();
  });

  it('тап по записи таймлайна зовёт onOpenItem', () => {
    const onOpenItem = vi.fn();
    render(
      <JourneyView
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [ITEM] },
          total: 1,
          items: [ITEM],
        })}
        subtitle={() => null}
        onOpenItem={onOpenItem}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    fireEvent.click(screen.getByText('Благодарность'));
    expect(onOpenItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gratitude' }),
    );
  });
});
