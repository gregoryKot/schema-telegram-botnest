// @vitest-environment jsdom
// ModesTab — композиция Hero + ModesPatternSection: держит openId и
// сводит воедино открытие ОДНОГО и того же экрана паттерна и от тапа по
// строке списка, и от тапа по сводке недели в Hero. Hero скрываемый через
// блок «Паттернов» heroes (пропс blocks — тот же id, что у PatternsHero на
// вкладке «Схемы»). У Hero/ModesPatternSection — своя логика и свои тесты,
// здесь мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { BlockVisibility } from './blockVisibility';
import { ModesTab } from './ModesTab';

function fakeBlocks(hidden: string[] = []): BlockVisibility {
  return {
    isHidden: (id) => hidden.includes(id),
    holdProps: () =>
      ({}) as unknown as ReturnType<BlockVisibility['holdProps']>,
  };
}

vi.mock('../../components/ModesHero', () => ({
  ModesHero: ({
    onOpenModeDetail,
  }: {
    onOpenModeDetail: (id: string) => void;
  }) => (
    <button onClick={() => onOpenModeDetail('demanding_critic')}>
      hero-open-critic
    </button>
  ),
}));

vi.mock('./ModesPatternSection', () => ({
  ModesPatternSection: ({ openId }: { openId: string | null }) => (
    <div data-testid="pattern-section">{openId ?? 'none'}</div>
  ),
}));

afterEach(cleanup);

const BASE_PROPS = {
  profileLoading: false,
  myModeIds: [],
  modeSummary: null,
  modeFreq: {},
  modeEntries: [],
  setModeEntries: () => {},
  onOpenSchema: () => {},
  onShowModePicker: () => {},
  onMeetCritic: () => {},
  blocks: fakeBlocks(),
};

describe('ModesTab — единый openId для Hero и списка паттернов', () => {
  it('изначально ничего не открыто', () => {
    render(<ModesTab {...BASE_PROPS} />);
    expect(screen.getByTestId('pattern-section').textContent).toBe('none');
  });

  it('тап по сводке недели в Hero открывает тот же PatternSheet, что и список', () => {
    render(<ModesTab {...BASE_PROPS} />);
    fireEvent.click(screen.getByText('hero-open-critic'));
    expect(screen.getByTestId('pattern-section').textContent).toBe(
      'demanding_critic',
    );
  });
});

describe('ModesTab — загрузка', () => {
  it('во время загрузки Hero скрыт', () => {
    render(<ModesTab {...BASE_PROPS} profileLoading={true} />);
    expect(screen.queryByText('hero-open-critic')).toBeNull();
  });
});

describe('ModesTab — скрываемые блоки (useScreenBlocks)', () => {
  it('блок heroes скрыт — Hero не рендерится, список режимов на месте', () => {
    render(<ModesTab {...BASE_PROPS} blocks={fakeBlocks(['heroes'])} />);
    expect(screen.queryByText('hero-open-critic')).toBeNull();
    expect(screen.getByTestId('pattern-section')).toBeTruthy();
  });

  it('блок heroes не скрыт — Hero на месте', () => {
    render(<ModesTab {...BASE_PROPS} />);
    expect(screen.getByText('hero-open-critic')).toBeTruthy();
  });
});
