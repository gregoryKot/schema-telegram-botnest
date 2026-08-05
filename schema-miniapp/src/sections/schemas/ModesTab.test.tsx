// @vitest-environment jsdom
// ModesTab — вкладка «Режимы» каталога: собственная логика — группировка
// режимов пользователя по MODE_GROUPS с недельной частотой (остальное —
// composition из ModesHero/PatternFrequencyList, у них своя ответственность,
// здесь их мокаем, чтобы тест бил по группировке, а не дублировал их тесты).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ModesTab } from './ModesTab';

vi.mock('../../components/ModesHero', () => ({
  ModesHero: () => <div data-testid="modes-hero" />,
  INTRO_MODE_ID: 'demanding_critic',
}));

vi.mock('../../components/PatternFrequencyList', () => ({
  PatternFrequencyList: ({
    groups,
  }: {
    groups: { title: string; items: { name: string; freq: number }[] }[];
  }) => (
    <div data-testid="pattern-list">
      {groups.map((g) => (
        <div key={g.title}>
          {g.title}: {g.items.map((i) => `${i.name}(${i.freq})`).join(', ')}
        </div>
      ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const BASE_PROPS = {
  profileLoading: false,
  modeSummary: null,
  onOpenSchema: () => {},
  onShowModePicker: () => {},
  onOpenModeIntro: () => {},
};

describe('ModesTab — группировка режимов пользователя', () => {
  it('без выбранных режимов список групп не рендерится', () => {
    render(<ModesTab {...BASE_PROPS} myModeIds={[]} modeFreq={{}} />);
    expect(screen.queryByTestId('pattern-list')).toBeNull();
  });

  it('только группы с реально выбранными режимами попадают в список', () => {
    render(
      <ModesTab
        {...BASE_PROPS}
        myModeIds={['demanding_critic']}
        modeFreq={{ demanding_critic: 3 }}
      />,
    );
    const list = screen.getByTestId('pattern-list');
    expect(list.textContent).toContain('Требовательный Критик(3)');
  });

  it('частота отсутствующего в modeFreq режима — 0, а не undefined', () => {
    render(
      <ModesTab
        {...BASE_PROPS}
        myModeIds={['demanding_critic']}
        modeFreq={{}}
      />,
    );
    expect(screen.getByTestId('pattern-list').textContent).toContain(
      'Требовательный Критик(0)',
    );
  });
});

describe('ModesTab — загрузка', () => {
  it('во время загрузки (есть режимы) показывает скелетон, а не список', () => {
    render(
      <ModesTab
        {...BASE_PROPS}
        profileLoading={true}
        myModeIds={['demanding_critic']}
        modeFreq={{}}
      />,
    );
    expect(screen.queryByTestId('pattern-list')).toBeNull();
    expect(screen.queryByTestId('modes-hero')).toBeNull(); // hero скрыт во время загрузки
  });
});
