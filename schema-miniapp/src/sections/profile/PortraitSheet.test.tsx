// @vitest-environment jsdom
// PortraitSheet — лист «Мой портрет»: полные списки «Мои схемы»/«Мои режимы»
// (MyPatternsCard reused БЕЗ лимита в 3 строки — правило «одна механика —
// один компонент»), тап по строке открывает PatternSheet (мокаем — свои
// тесты у MyPatternsCard/PatternSheet), футер «Все N →» закрывает лист ПЕРЕД
// навигацией на «Паттерны» (иначе лист остаётся смонтированным поверх неё).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PortraitSheet } from './PortraitSheet';
import type { AboutMeState } from './useAboutMe';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

vi.mock('../../components/patternSheet/PatternSheet', () => ({
  PatternSheet: ({ id, onClose }: { id: string; onClose: () => void }) => (
    <div data-testid="pattern-sheet">
      {id}
      <button onClick={onClose}>close-pattern-sheet</button>
    </div>
  ),
}));
vi.mock('../../components/patternSheet/usePatternStatus', () => ({
  usePatternStatus: () => ({
    items: [],
    reload: vi.fn(),
    statusFor: () => 'карточка пока пустая',
  }),
}));

afterEach(cleanup);

const emptyNeeds = [
  {
    id: 'attachment' as const,
    label: 'Привязанность',
    emoji: '🤝',
    color: '#ff6b9d',
    count: 0,
  },
  {
    id: 'autonomy' as const,
    label: 'Автономия',
    emoji: '🧭',
    color: '#4fa3f7',
    count: 0,
  },
  {
    id: 'expression' as const,
    label: 'Выражение чувств',
    emoji: '💬',
    color: '#facc15',
    count: 0,
  },
  {
    id: 'play' as const,
    label: 'Спонтанность',
    emoji: '🎉',
    color: '#06d6a0',
    count: 0,
  },
  {
    id: 'limits' as const,
    label: 'Границы',
    emoji: '⚖️',
    color: '#a78bfa',
    count: 0,
  },
];

function makeAboutMe(overrides: Partial<AboutMeState> = {}): AboutMeState {
  return {
    ready: true,
    portrait: {
      needs: emptyNeeds,
      totalSchemas: 0,
      totalModes: 0,
      delta: null,
    },
    ysqCompletedAt: null,
    mySchemaIds: [],
    myModeIds: [],
    schemaEntries: [],
    setSchemaEntries: vi.fn(),
    modeEntries: [],
    setModeEntries: vi.fn(),
    schemaWeekFreq: {},
    modeWeekFreq: {},
    ...overrides,
  };
}

describe('PortraitSheet — пусто', () => {
  it('нет ни одной отмеченной схемы/режима — объясняет откуда/зачем', () => {
    render(
      <PortraitSheet
        aboutMe={makeAboutMe()}
        onOpenPatterns={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Мой портрет')).toBeTruthy();
    expect(screen.getByText(/Отметь схемы и режимы/)).toBeTruthy();
  });
});

describe('PortraitSheet — строки пяти потребностей над списками', () => {
  it('рендерит все пять потребностей, а списки «Мои схемы»/«Мои режимы» — под ними', () => {
    render(
      <PortraitSheet
        aboutMe={makeAboutMe({ mySchemaIds: ['abandonment'] })}
        onOpenPatterns={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('Автономия')).toBeTruthy();
    expect(screen.getByText('Выражение чувств')).toBeTruthy();
    expect(screen.getByText('Спонтанность')).toBeTruthy();
    expect(screen.getByText('Границы')).toBeTruthy();
    // Список схем всё ещё рендерится (карточка паттерна с id).
    expect(
      screen
        .getAllByRole('button')
        .some((b) => b.textContent?.includes('карточка')),
    ).toBe(true);
  });

  it('тап по строке раскрывает объяснение потребности, второй тап схлопывает', () => {
    render(
      <PortraitSheet
        aboutMe={makeAboutMe()}
        onOpenPatterns={() => {}}
        onClose={() => {}}
      />,
    );
    const row = screen.getByText('Привязанность');
    expect(screen.queryByText(/Потребность в настоящем контакте/)).toBeNull();
    fireEvent.click(row);
    expect(screen.getByText(/Потребность в настоящем контакте/)).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText(/Потребность в настоящем контакте/)).toBeNull();
  });
});

describe('PortraitSheet — полные списки без лимита в 3 строки', () => {
  it('показывает все 4 отмеченные схемы, не только топ-3 (в отличие от карточки профиля)', () => {
    render(
      <PortraitSheet
        aboutMe={makeAboutMe({
          mySchemaIds: [
            'abandonment',
            'mistrust',
            'defectiveness',
            'social_isolation',
          ],
        })}
        onOpenPatterns={() => {}}
        onClose={() => {}}
      />,
    );
    const rows = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes('карточка'));
    expect(rows.length).toBe(4);
  });

  it('тап по строке открывает PatternSheet с этим id', () => {
    render(
      <PortraitSheet
        aboutMe={makeAboutMe({ myModeIds: ['vulnerable_child'] })}
        onOpenPatterns={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId('pattern-sheet')).toBeNull();
    fireEvent.click(screen.getByText('карточка пока пустая'));
    expect(screen.getByTestId('pattern-sheet').textContent).toContain(
      'vulnerable_child',
    );
  });
});

describe('PortraitSheet — футер «Все N →» закрывает лист перед навигацией', () => {
  it('клик по футеру списка схем сначала зовёт onClose, потом onOpenPatterns("schemas")', () => {
    const calls: string[] = [];
    render(
      <PortraitSheet
        aboutMe={makeAboutMe({ mySchemaIds: ['abandonment', 'mistrust'] })}
        onOpenPatterns={(tab) => calls.push(`open:${tab}`)}
        onClose={() => calls.push('close')}
      />,
    );
    fireEvent.click(screen.getByText('Все 2 →'));
    expect(calls).toEqual(['close', 'open:schemas']);
  });
});
