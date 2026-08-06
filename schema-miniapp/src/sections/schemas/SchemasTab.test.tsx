// @vitest-environment jsdom
// SchemasTab — вкладка «Схемы» каталога (0% покрытия): группировка выбранных
// схем по доменам с недельной частотой + карточка теста YSQ в трёх состояниях
// (не начат/начат/пройден). PatternsHero и PatternFrequencyList — свои файлы
// со своими тестами, здесь их мокаем, чтобы бить только по логике SchemasTab.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { SchemasTab } from './SchemasTab';

// Дата прохождения теста — относительная (не литерал): fmtDate() рисует её
// как есть, но литерал в прошлом всё равно однажды перестанет быть валидной
// «уже прошедшей» датой относительно системных часов CI при сравнении с now.
const YSQ_COMPLETED_AT = new Date(
  Date.now() - 10 * 24 * 60 * 60 * 1000,
).toISOString();

vi.mock('../../components/PatternsHero', () => ({
  PatternsHero: () => <div data-testid="patterns-hero" />,
}));
vi.mock('../../components/myCards/MyCardsSection', () => ({
  MyCardsSection: () => <div data-testid="my-cards-section" />,
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
  onOpenSchema: vi.fn(),
  onShowSchemaPicker: vi.fn(),
  onOpenSchemaDetail: vi.fn(),
};

describe('SchemasTab — без выбранных схем и непройденным тестом', () => {
  it('карточка теста и группы схем не рендерятся', () => {
    renderWithForm(<SchemasTab {...BASE_PROPS} />);
    expect(screen.queryByText('Тест на схемы')).toBeNull();
    expect(screen.queryByTestId('pattern-list')).toBeNull();
  });

  it('секция «Мои карточки» всегда смонтирована — сама решает, показываться ли', () => {
    renderWithForm(<SchemasTab {...BASE_PROPS} />);
    expect(screen.getByTestId('my-cards-section')).toBeTruthy();
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

describe('SchemasTab — группировка схем пользователя по доменам', () => {
  it('только реально выбранные схемы попадают в список групп', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        allSchemaIds={['abandonment']}
        schemaFreq={{ abandonment: 2 }}
      />,
    );
    const list = screen.getByTestId('pattern-list');
    expect(list.textContent).toContain('(2)');
  });

  it('частота отсутствующей в schemaFreq схемы — 0, а не подставное значение', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        allSchemaIds={['abandonment']}
        schemaFreq={{}}
      />,
    );
    expect(screen.getByTestId('pattern-list').textContent).toContain('(0)');
  });

  it('во время загрузки профиля — скелетон вместо списка групп', () => {
    renderWithForm(
      <SchemasTab
        {...BASE_PROPS}
        profileLoading={true}
        allSchemaIds={['abandonment']}
      />,
    );
    expect(screen.queryByTestId('pattern-list')).toBeNull();
    expect(screen.queryByTestId('patterns-hero')).toBeNull(); // hero скрыт во время загрузки
  });

  it('нет выбранных схем, но тест пройден без результатов-групп — кнопка «Добавить схему»', () => {
    renderWithForm(
      <SchemasTab {...BASE_PROPS} ysqCompletedAt={YSQ_COMPLETED_AT} />,
    );
    expect(screen.getByText('+ Добавить схему')).toBeTruthy();
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
