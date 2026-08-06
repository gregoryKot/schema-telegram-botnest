// @vitest-environment jsdom
// SchemasPatternSection — группировка схем пользователя по доменам с
// недельной частотой и статусом карточки, плюс сам экран паттерна при
// открытом id. PatternFrequencyList/PatternSheet/usePatternStatus — свои
// файлы со своими тестами, здесь их мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemasPatternSection } from './SchemasPatternSection';

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
  hasSchemas: true,
  allSchemaIds: [] as string[],
  schemaFreq: {} as Record<string, number>,
  schemaEntries: [],
  setSchemaEntries: () => {},
  weekSummary: null,
  onShowSchemaPicker: () => {},
  openId: null,
  onOpenChange: () => {},
};

describe('SchemasPatternSection — группировка схем пользователя по доменам', () => {
  it('hasSchemas=false — ни список, ни кнопка «Добавить схему» не рендерятся', () => {
    render(<SchemasPatternSection {...BASE_PROPS} hasSchemas={false} />);
    expect(screen.queryByTestId('pattern-list')).toBeNull();
    expect(screen.queryByText('+ Добавить схему')).toBeNull();
  });

  it('только реально выбранные схемы попадают в список, статус подмешан', () => {
    render(
      <SchemasPatternSection
        {...BASE_PROPS}
        allSchemaIds={['abandonment']}
        schemaFreq={{ abandonment: 2 }}
      />,
    );
    const list = screen.getByTestId('pattern-list');
    expect(list.textContent).toContain('(2)');
    expect(list.textContent).toContain('status-abandonment');
  });

  it('частота отсутствующей в schemaFreq схемы — 0, а не подставное значение', () => {
    render(
      <SchemasPatternSection {...BASE_PROPS} allSchemaIds={['abandonment']} />,
    );
    expect(screen.getByTestId('pattern-list').textContent).toContain('(0)');
  });

  it('во время загрузки — скелетон вместо списка групп', () => {
    render(
      <SchemasPatternSection
        {...BASE_PROPS}
        profileLoading={true}
        allSchemaIds={['abandonment']}
      />,
    );
    expect(screen.queryByTestId('pattern-list')).toBeNull();
  });

  it('нет выбранных схем, но hasSchemas (тест пройден) — кнопка «Добавить схему»', () => {
    render(<SchemasPatternSection {...BASE_PROPS} allSchemaIds={[]} />);
    expect(screen.getByText('+ Добавить схему')).toBeTruthy();
  });
});

describe('SchemasPatternSection — тап открывает экран паттерна, а не справку', () => {
  it('клик по строке зовёт onOpenChange(id)', () => {
    const onOpenChange = vi.fn();
    render(
      <SchemasPatternSection
        {...BASE_PROPS}
        allSchemaIds={['abandonment']}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByText(/\(0\)/));
    expect(onOpenChange).toHaveBeenCalledWith('abandonment');
  });

  it('openId задан — рендерит PatternSheet с этим id', () => {
    render(
      <SchemasPatternSection
        {...BASE_PROPS}
        allSchemaIds={['abandonment']}
        openId="abandonment"
      />,
    );
    expect(screen.getByTestId('pattern-sheet').textContent).toBe('abandonment');
  });
});
