// @vitest-environment jsdom
// Тело экрана «Мой путь»: скелетон при загрузке, ошибка, пустое состояние,
// заполненный вид (hero + счётчики + фильтры + таймлайн). Правило онбординга
// CLAUDE.md: explainer обязан звучать в обеих формах через tr() — проверяем,
// что вилка реально доезжает до разметки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { JourneyView, type JourneyViewProps } from './JourneyView';
import type { JourneyKit } from './journeyKit';
import type { JourneyStatRow } from './journeyStats';
import type { JourneyState } from './useJourney';
import type { JourneyItem } from './journeyMeta';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

afterEach(() => {
  cleanup();
});

// Вёрстку передаёт обёртка площадки пропсом (journeyHeroes.ts) — как
// JourneySheet сайта; здесь — минимальная заглушка с теми же текстами.
const STUB_KIT: JourneyKit = {
  Hero: ({ total, onShareFeed }) => (
    <div>
      <span>{total}</span>
      <span>шагов заботы о себе</span>
      <button onClick={onShareFeed}>Поделиться лентой шагов</button>
    </div>
  ),
  EmptyHero: ({ explainer }) => (
    <div>
      <div>Путь ещё впереди</div>
      <div>{explainer}</div>
    </div>
  ),
  Stat: ({ row }) => (
    <div data-testid="stat">
      {row.count} {row.label}
    </div>
  ),
  Chip: ({ label, on, onToggle }) => (
    <button aria-pressed={on} onClick={onToggle}>
      {label}
    </button>
  ),
};

const View = (
  p: Omit<JourneyViewProps, 'kit'> & Partial<Pick<JourneyViewProps, 'kit'>>,
) => <JourneyView kit={STUB_KIT} {...p} />;

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
    reload: vi.fn(),
    ...overrides,
  } as unknown as JourneyState;
}

describe('JourneyView — состояния загрузки', () => {
  it('data=null и не failed — показывает переданный скелетон', () => {
    render(
      <View
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
      <View
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
      <View
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

describe('JourneyView — герой от площадки', () => {
  const state = (total: number) =>
    baseState({
      data: { counts: {} as never, items: [] },
      total,
      items: total ? [{ type: 'gratitude', at: '2026-07-21T10:00:00Z' }] : [],
    });
  const view = (total: number, kit: JourneyViewProps['kit']) => (
    <View
      tr={tr}
      j={state(total)}
      subtitle={() => null}
      onOpenItem={vi.fn()}
      onShareFeed={vi.fn()}
      kit={kit}
      skeleton={<div />}
    />
  );

  it('переданный компонент получает total, пустой — пояснение; свой не мешает телу экрана', () => {
    const kit = {
      ...STUB_KIT,
      Hero: ({ total }: { total: number }) => <div>свой герой {total}</div>,
      EmptyHero: ({ explainer }: { explainer: string }) => (
        <div>свой пустой: {explainer.slice(0, 7)}</div>
      ),
    };
    render(view(7, kit));
    expect(screen.getByText('свой герой 7')).toBeTruthy();
    expect(screen.getByText('Неделя')).toBeTruthy();
    cleanup();
    render(view(0, kit));
    expect(screen.getByText(/свой пустой: Всё, чт/)).toBeTruthy();
  });
});

describe('JourneyView — заполненный путь', () => {
  const ITEM: JourneyItem = { type: 'gratitude', at: '2026-07-21T10:00:00Z' };

  it('рендерит hero с итогом, счётчики и таймлайн; кнопка hero зовёт onShareFeed', () => {
    const onShareFeed = vi.fn();
    render(
      <View
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [ITEM] },
          total: 5,
          items: [ITEM],
          stats: [
            {
              type: 'gratitude',
              label: 'Благодарности',
              count: 5,
            },
          ],
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
      <View
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
      <View
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
      <View
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
      <View
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

describe('JourneyView — плитки счётчиков 2×3', () => {
  it('показывает не больше шести самых частых занятий, без эмодзи на экране', () => {
    const stats: JourneyStatRow[] = Array.from({ length: 8 }, (_, i) => ({
      type: `t${i}`,
      emoji: '🌱',
      label: `Занятие ${i}`,
      count: 10 - i,
    }));
    const item: JourneyItem = { type: 'gratitude', at: '2026-07-21T10:00:00Z' };
    const { container } = render(
      <View
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [item] },
          total: 60,
          items: [item],
          stats,
        })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    expect(screen.getAllByTestId('stat').map((n) => n.textContent)).toEqual(
      stats.slice(0, 6).map((s) => `${s.count} ${s.label}`),
    );
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('выбранный период и группа — чип в состоянии «включён»', () => {
    const item: JourneyItem = { type: 'gratitude', at: '2026-07-21T10:00:00Z' };
    render(
      <View
        tr={tr}
        j={baseState({
          data: { counts: {} as never, items: [item] },
          total: 1,
          items: [item],
          period: 'week',
          group: 'diary',
        })}
        subtitle={() => null}
        onOpenItem={vi.fn()}
        onShareFeed={vi.fn()}
        skeleton={<div />}
      />,
    );
    const on = screen
      .getAllByRole('button', { pressed: true })
      .map((b) => b.textContent);
    expect(on).toEqual(['Неделя', 'Дневники']);
  });
});
