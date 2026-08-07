// @vitest-environment jsdom
// SchemasTab — вкладка «Схемы» каталога: держит openId (единый для Hero и
// списка), рисует Hero + карточку теста YSQ в трёх состояниях (не начат/
// начат/пройден), оба скрываемые через блоки «Паттернов» (heroes/ysq_status,
// пропс blocks). PatternsHero, YsqStatusCard и SchemasPatternSection — свои
// файлы со своими тестами, здесь их мокаем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import type { BlockVisibility } from './blockVisibility';
import { SchemasTab } from './SchemasTab';

function fakeBlocks(hidden: string[] = []): BlockVisibility {
  return {
    isHidden: (id) => hidden.includes(id),
    holdProps: () =>
      ({}) as unknown as ReturnType<BlockVisibility['holdProps']>,
  };
}

// Дата прохождения теста — относительная (не литерал): fmtDate() рисует её
// как есть, но литерал в прошлом всё равно однажды перестанет быть валидной
// «уже прошедшей» датой относительно системных часов CI при сравнении с now.
const YSQ_COMPLETED_AT = new Date(
  Date.now() - 10 * 24 * 60 * 60 * 1000,
).toISOString();

vi.mock('../../components/PatternsHero', () => ({
  PatternsHero: ({
    onOpenSchemaDetail,
  }: {
    onOpenSchemaDetail: (id: string) => void;
  }) => (
    <button onClick={() => onOpenSchemaDetail('abandonment')}>
      hero-open-abandonment
    </button>
  ),
}));
vi.mock('./SchemasPatternSection', () => ({
  SchemasPatternSection: ({ openId }: { openId: string | null }) => (
    <div data-testid="pattern-section">{openId ?? 'none'}</div>
  ),
}));

function renderWithForm(ui: ReactElement, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

const BASE_PROPS = {
  profileLoading: false,
  allSchemaIds: [] as string[],
  ysqCompletedAt: null as string | null,
  ysqProgressAnswered: null as number | null,
  weekSummary: null,
  schemaFreq: {} as Record<string, number>,
  schemaEntries: [],
  setSchemaEntries: () => {},
  onOpenSchema: vi.fn(),
  onShowSchemaPicker: vi.fn(),
  blocks: fakeBlocks(),
};

describe('SchemasTab — без выбранных схем и непройденным тестом', () => {
  it('карточка теста не рендерится', () => {
    renderWithForm(<SchemasTab {...BASE_PROPS} />);
    expect(screen.queryByText('Тест на схемы')).toBeNull();
  });
});

describe('SchemasTab — карточка теста YSQ по состояниям', () => {
  it('тест не начат: кнопка «Начать»', () => {
    renderWithForm(<SchemasTab {...BASE_PROPS} allSchemaIds={['abandon']} />);
    expect(screen.getByText('Начать')).toBeTruthy();
  });

  it('тест начат (есть прогресс): кнопка «Продолжить» с числом отвеченных', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        allSchemaIds={['abandon']}
        ysqProgressAnswered={40}
      />,
    );
    expect(screen.getByText('Продолжить')).toBeTruthy();
    expect(screen.getByText(/отвечено 40 из 116/)).toBeTruthy();
  });

  it('тест пройден: кнопка «Результаты» с реальной датой прохождения', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        allSchemaIds={['abandon']}
        ysqCompletedAt={YSQ_COMPLETED_AT}
      />,
    );
    expect(screen.getByText('Результаты')).toBeTruthy();
    expect(screen.getByText(/Пройден/)).toBeTruthy();
  });
});

describe('SchemasTab — единый openId для Hero и списка паттернов', () => {
  it('тап по сводке недели в Hero открывает тот же PatternSheet, что и список', () => {
    renderWithForm(<SchemasTab {...BASE_PROPS} />);
    expect(screen.getByTestId('pattern-section').textContent).toBe('none');
    fireEvent.click(screen.getByText('hero-open-abandonment'));
    expect(screen.getByTestId('pattern-section').textContent).toBe(
      'abandonment',
    );
  });
});

describe('SchemasTab — во время загрузки', () => {
  it('Hero скрыт', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        profileLoading={true}
        allSchemaIds={['abandonment']}
      />,
    );
    expect(screen.queryByText('hero-open-abandonment')).toBeNull();
  });
});

describe('SchemasTab — скрываемые блоки (useScreenBlocks)', () => {
  it('блок heroes скрыт — Hero не рендерится, список схем на месте', () => {
    renderWithForm(
      <SchemasTab {...BASE_PROPS} blocks={fakeBlocks(['heroes'])} />,
    );
    expect(screen.queryByText('hero-open-abandonment')).toBeNull();
    expect(screen.getByTestId('pattern-section')).toBeTruthy();
  });

  it('блок ysq_status скрыт — карточка теста не рендерится, список схем на месте', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        allSchemaIds={['abandon']}
        blocks={fakeBlocks(['ysq_status'])}
      />,
    );
    expect(screen.queryByText('Тест на схемы')).toBeNull();
    expect(screen.getByTestId('pattern-section')).toBeTruthy();
  });

  it('ничего не скрыто — Hero и карточка теста оба на месте', () => {
    renderWithForm(<SchemasTab {...BASE_PROPS} allSchemaIds={['abandon']} />);
    expect(screen.getByText('hero-open-abandonment')).toBeTruthy();
    expect(screen.getByText('Тест на схемы')).toBeTruthy();
  });
});

describe('SchemasTab — форма обращения «ты/вы»', () => {
  it('форма «ты»: приглашение к тесту звучит на «ты»', () => {
    renderWithForm(
      <SchemasTab {...BASE_PROPS} allSchemaIds={['abandon']} />,
      'ty',
    );
    expect(screen.getByText(/Определи схемы автоматически/)).toBeTruthy();
  });

  it('форма «вы»: то же приглашение согласовано во множественном числе', () => {
    renderWithForm(
      <SchemasTab {...BASE_PROPS} allSchemaIds={['abandon']} />,
      'vy',
    );
    expect(screen.getByText(/Определите схемы автоматически/)).toBeTruthy();
  });
});
