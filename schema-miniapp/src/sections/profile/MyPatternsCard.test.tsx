// @vitest-environment jsdom
// MyPatternsCard — «Мои схемы»/«Мои режимы» вкладки «Я»: до 3 строк по
// правилу сортировки (частота → заполненность → имя), тап трекает открытие
// и открывает единый PatternSheet (мокаем — свои тесты), пусто → ничего.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MyPatternsCard } from './MyPatternsCard';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as { trackEvent: ReturnType<typeof vi.fn> };

vi.mock('../../components/patternSheet/PatternSheet', () => ({
  PatternSheet: ({ id, onClose }: { id: string; onClose: () => void }) => (
    <div data-testid="pattern-sheet">
      {id}
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

let mockItems: { id: string }[] = [];
vi.mock('../../components/patternSheet/usePatternStatus', () => ({
  usePatternStatus: () => ({
    items: mockItems,
    reload: vi.fn(),
    statusFor: (id: string) =>
      mockItems.some((i) => i.id === id)
        ? 'карточка заполнена'
        : 'карточка пока пустая',
  }),
}));

afterEach(() => {
  cleanup();
  mockItems = [];
  vi.clearAllMocks();
});

describe('MyPatternsCard — пусто', () => {
  it('нет ни одной выбранной сущности этого вида — не рендерит ничего', () => {
    const { container } = render(
      <MyPatternsCard
        kind="schema"
        ids={[]}
        weekFreq={{}}
        onOpenPatterns={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('MyPatternsCard — сортировка и ограничение до 3 строк', () => {
  it('сортирует по недельной частоте, затем по заполненности карточки, затем по имени', () => {
    mockItems = [{ id: 'abandonment' }];
    render(
      <MyPatternsCard
        kind="schema"
        ids={['mistrust', 'abandonment', 'defectiveness', 'social_isolation']}
        weekFreq={{ mistrust: 1, abandonment: 3, defectiveness: 3 }}
        onOpenPatterns={() => {}}
      />,
    );
    const rows = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('карточка'));
    // abandonment (freq=3, filled) идёт раньше defectiveness (freq=3, не заполнена) —
    // тот же freq, заполненная карточка выше. social_isolation (freq=0) не входит в топ-3.
    expect(rows.length).toBe(3);
    const order = rows.map((r) => r.textContent);
    expect(order[0]).toContain('карточка заполнена');
  });
});

describe('MyPatternsCard — тап открывает PatternSheet и трекает событие', () => {
  it('клик по строке шлёт trackEvent(profile_pattern_open, {kind}) и открывает лист с этим id', () => {
    render(
      <MyPatternsCard
        kind="mode"
        ids={['vulnerable_child']}
        weekFreq={{ vulnerable_child: 2 }}
        onOpenPatterns={() => {}}
      />,
    );
    expect(screen.queryByTestId('pattern-sheet')).toBeNull();
    fireEvent.click(screen.getByText('карточка пока пустая'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('profile_pattern_open', {
      kind: 'mode',
    });
    expect(screen.getByTestId('pattern-sheet').textContent).toContain(
      'vulnerable_child',
    );
  });
});

const FIVE_SCHEMA_IDS = [
  'abandonment',
  'mistrust',
  'defectiveness',
  'social_isolation',
  'dependence',
];

describe('MyPatternsCard — лимит строк (default=3 на карточке профиля, PortraitSheet передаёт Infinity)', () => {
  it('без limit — показывает не больше 3 строк даже при 5 отмеченных', () => {
    render(
      <MyPatternsCard
        kind="schema"
        ids={FIVE_SCHEMA_IDS}
        weekFreq={{}}
        onOpenPatterns={() => {}}
      />,
    );
    const rows = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('карточка'));
    expect(rows.length).toBe(3);
  });

  it('limit=Infinity (PortraitSheet) — показывает все строки, не только 3', () => {
    render(
      <MyPatternsCard
        kind="schema"
        ids={FIVE_SCHEMA_IDS}
        weekFreq={{}}
        onOpenPatterns={() => {}}
        limit={Infinity}
      />,
    );
    const rows = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('карточка'));
    expect(rows.length).toBe(5);
  });
});

describe('MyPatternsCard — футер «Все N →»', () => {
  it('клик по футеру зовёт onOpenPatterns с правильной вкладкой', () => {
    const onOpenPatterns = vi.fn();
    render(
      <MyPatternsCard
        kind="schema"
        ids={['abandonment', 'mistrust']}
        weekFreq={{}}
        onOpenPatterns={onOpenPatterns}
      />,
    );
    fireEvent.click(screen.getByText('Все 2 →'));
    expect(onOpenPatterns).toHaveBeenCalledWith('schemas');
  });
});
