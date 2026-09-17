// @vitest-environment jsdom
// ModesPatternSection — группировка режимов пользователя по MODE_GROUPS с
// недельной частотой и статусом карточки, плюс сам экран паттерна при
// открытом id. PatternFrequencyList/PatternSheet/usePatternStatus — свои
// файлы со своими тестами, здесь их мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModesPatternSection } from './ModesPatternSection';

vi.mock('../../components/patternSheet/usePatternStatus', () => ({
  usePatternStatus: () => ({
    items: [],
    reload: vi.fn(),
    statusFor: (id: string) => `status-${id}`,
  }),
}));
vi.mock('../../components/patternSheet/PatternSheet', () => ({
  PatternSheet: ({ id }: { id: string }) => (
    <div data-testid="pattern-sheet">{id}</div>
  ),
}));
vi.mock('../../components/PatternFrequencyList', () => ({
  PatternFrequencyList: ({
    groups,
    onSelect,
  }: {
    groups: {
      title: string;
      items: { id: string; name: string; freq: number; status?: string }[];
    }[];
    onSelect: (id: string) => void;
  }) => (
    <div data-testid="pattern-list">
      {groups.map((g) => (
        <div key={g.title}>
          {g.items.map((i) => (
            <button key={i.id} onClick={() => onSelect(i.id)}>
              {i.name}({i.freq}) {i.status}
            </button>
          ))}
        </div>
      ))}
    </div>
  ),
}));

afterEach(cleanup);

const BASE_PROPS = {
  profileLoading: false,
  modeFreq: {},
  modeEntries: [],
  setModeEntries: () => {},
  modeSummary: null,
  onShowModePicker: () => {},
  openId: null,
  onOpenChange: () => {},
};

describe('ModesPatternSection — группировка режимов пользователя', () => {
  it('без выбранных режимов список не рендерится', () => {
    render(<ModesPatternSection {...BASE_PROPS} myModeIds={[]} />);
    expect(screen.queryByTestId('pattern-list')).toBeNull();
  });

  it('только группы с реально выбранными режимами попадают в список, статус подмешан', () => {
    render(
      <ModesPatternSection
        {...BASE_PROPS}
        myModeIds={['demanding_critic']}
        modeFreq={{ demanding_critic: 3 }}
      />,
    );
    const list = screen.getByTestId('pattern-list');
    expect(list.textContent).toContain('Требовательный Критик(3)');
    expect(list.textContent).toContain('status-demanding_critic');
  });

  it('частота отсутствующего в modeFreq режима — 0, а не undefined', () => {
    render(
      <ModesPatternSection {...BASE_PROPS} myModeIds={['demanding_critic']} />,
    );
    expect(screen.getByTestId('pattern-list').textContent).toContain(
      'Требовательный Критик(0)',
    );
  });

  it('во время загрузки — скелетон-строки (форма списка), а не список', () => {
    const { container } = render(
      <ModesPatternSection
        {...BASE_PROPS}
        myModeIds={['demanding_critic']}
        profileLoading={true}
      />,
    );
    expect(screen.queryByTestId('pattern-list')).toBeNull();
    // Минимум 3 строки, даже когда локально известен всего один режим.
    expect(container.querySelectorAll('.card > div').length).toBe(3);
  });

  it('во время загрузки — строк скелетона столько же, сколько локально известных режимов', () => {
    const { container } = render(
      <ModesPatternSection
        {...BASE_PROPS}
        myModeIds={[
          'demanding_critic',
          'vulnerable_child',
          'punitive_parent',
          'detached_protector',
          'angry_child',
        ]}
        profileLoading={true}
      />,
    );
    expect(container.querySelectorAll('.card > div').length).toBe(5);
  });
});

describe('ModesPatternSection — тап открывает экран паттерна, а не опросник', () => {
  it('клик по строке зовёт onOpenChange(id) — сам PatternSheet рисует родитель', () => {
    const onOpenChange = vi.fn();
    render(
      <ModesPatternSection
        {...BASE_PROPS}
        myModeIds={['demanding_critic']}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText(/Требовательный Критик/));
    expect(onOpenChange).toHaveBeenCalledWith('demanding_critic');
  });

  it('openId задан — рендерит PatternSheet с этим id', () => {
    render(
      <ModesPatternSection
        {...BASE_PROPS}
        myModeIds={['demanding_critic']}
        openId="demanding_critic"
      />,
    );
    expect(screen.getByTestId('pattern-sheet').textContent).toBe(
      'demanding_critic',
    );
  });
});
