// @vitest-environment jsdom
// Этап 3 единой версии: недельная частота в чипах, «паттерн недели» и вводная
// новичку на экране «Мои паттерны». Данные — только из дневника (без заглушек).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { SchemasSection } from './SchemasSection';

vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(), getYsqHistory: vi.fn(), getYsqProgress: vi.fn(), listMyModeMaps: vi.fn(),
    updateSettings: vi.fn(), trackEvent: vi.fn(), getSchemaDiary: vi.fn(), getModeDiary: vi.fn(),
    getSchemaNotes: vi.fn(), getModeNotes: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const schemaEntry = (id: number, at: string, schemaIds: string[]) => ({ id, createdAt: at, trigger: 'Т', emotions: [], schemaIds });
const modeEntry = (id: number, at: string, modeId: string) => ({ id, createdAt: at, trigger: 'Т', emotions: [], modeId });

function profile(mySchemaIds: string[], myModeIds: string[]) {
  return {
    name: null, role: 'CLIENT' as const, ysq: { completedAt: null, activeSchemaIds: [] },
    notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 }, streak: 0,
    lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
    mySchemaIds, myModeIds,
  };
}

function renderSection(onOpenSchema = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/schemas']}>
        <Routes>
          <Route path="/schemas" element={<SchemasSection onOpenSchema={onOpenSchema} />} />
          <Route path="/diary" element={<div>экран дневника</div>} />
        </Routes>
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getProfile.mockResolvedValue(profile(['abandonment'], ['demanding_critic']));
  mockApi.getYsqHistory.mockResolvedValue([]);
  mockApi.getYsqProgress.mockResolvedValue(null);
  mockApi.listMyModeMaps.mockResolvedValue([]);
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getSchemaNotes.mockResolvedValue([]);
  mockApi.getModeNotes.mockResolvedValue([]);
});
afterEach(cleanup);

describe('частота за неделю', () => {
  it('чип схемы показывает число РАЗНЫХ дней, подсказка «наблюдение» появляется', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([
      schemaEntry(1, daysAgo(0), ['abandonment']),
      schemaEntry(2, daysAgo(0), ['abandonment']),
      schemaEntry(3, daysAgo(2), ['abandonment']),
      schemaEntry(4, daysAgo(20), ['abandonment']),
    ]);
    renderSection();
    expect(await screen.findByText('2 дня')).toBeTruthy();
    expect(screen.getAllByText(/Это наблюдение, а не оценка/)).toHaveLength(1);
  });

  it('чип режима показывает частоту по дневнику режимов', async () => {
    mockApi.getModeDiary.mockResolvedValue([modeEntry(1, daysAgo(1), 'demanding_critic')]);
    renderSection();
    expect(await screen.findByText('1 день')).toBeTruthy();
    expect(screen.getByText(/Полоска рядом с режимом/)).toBeTruthy();
  });

  it('записей за неделю нет: ни полоски, ни подсказки, ни «0 дней»', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry(1, daysAgo(30), ['abandonment'])]);
    const { container } = renderSection();
    await screen.findByText('Мои схемы');
    await screen.findByText(/Тест на схемы/);
    expect(container.querySelector('.cs-freq')).toBeNull();
    expect(screen.queryByText(/наблюдение, а не оценка/)).toBeNull();
    expect(screen.queryByText(/0 дней/)).toBeNull();
  });
});

describe('паттерн недели', () => {
  it('показывает самый частый и открывает его экран паттерна', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([
      schemaEntry(1, daysAgo(0), ['abandonment']),
      schemaEntry(2, daysAgo(1), ['abandonment']),
    ]);
    renderSection();
    const card = (await screen.findByText('Чаще всего звучит')).closest('button')!;
    expect(within(card).getByText(/2 из 7 дней/)).toBeTruthy();
    fireEvent.click(card);
    expect((await screen.findAllByText(/Покинутость/)).length).toBeGreaterThan(1);
  });

  it('режим чаще схемы — карточка про режим', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry(1, daysAgo(0), ['abandonment'])]);
    mockApi.getModeDiary.mockResolvedValue([
      modeEntry(1, daysAgo(0), 'demanding_critic'), modeEntry(2, daysAgo(1), 'demanding_critic'),
    ]);
    renderSection();
    expect(await screen.findByText('Чаще всего включается')).toBeTruthy();
  });

  it('на пустых данных не рисуется', async () => {
    renderSection();
    await screen.findByText('Мои схемы');
    expect(screen.queryByText('Чаще всего звучит')).toBeNull();
    expect(screen.queryByText('Чаще всего включается')).toBeNull();
  });
});

describe('вводная новичку', () => {
  it('нет схем: «откуда и зачем» и тест как единственное действие', async () => {
    mockApi.getProfile.mockResolvedValue(profile([], []));
    const onOpenSchema = vi.fn();
    renderSection(onOpenSchema);
    expect(await screen.findByText('Узнать свои схемы')).toBeTruthy();
    expect(screen.getByText(/Понятие ввёл Джеффри Янг/)).toBeTruthy();
    fireEvent.click(screen.getByText('Начать тест →'));
    expect(onOpenSchema).toHaveBeenCalledWith({ startTest: true });
  });

  it('форма «вы» в тексте вводной', async () => {
    mockApi.getProfile.mockResolvedValue(profile([], []));
    renderSection(vi.fn(), 'vy');
    expect(await screen.findByText(/увидите, какие из 20 схем/)).toBeTruthy();
  });

  it('схемы есть, режимов нет: знакомство с Критиком', async () => {
    mockApi.getProfile.mockResolvedValue(profile(['abandonment'], []));
    renderSection();
    expect(await screen.findByText('Встретить своего Критика')).toBeTruthy();
  });

  it('всё выбрано, дневник пуст: ведёт в дневник', async () => {
    renderSection();
    fireEvent.click(await screen.findByText('Открыть дневник →'));
    expect(await screen.findByText('экран дневника')).toBeTruthy();
  });

  it('есть записи за неделю — вводной нет, вместо неё паттерн недели', async () => {
    mockApi.getProfile.mockResolvedValue(profile([], []));
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry(1, daysAgo(0), ['abandonment'])]);
    renderSection();
    await screen.findByText('Чаще всего звучит');
    expect(screen.queryByText('Узнать свои схемы')).toBeNull();
  });

  it('пока записи грузятся, вводная не мигает', async () => {
    mockApi.getProfile.mockResolvedValue(profile([], []));
    mockApi.getSchemaDiary.mockReturnValue(new Promise(() => {}));
    renderSection();
    await screen.findByText('Мои схемы');
    expect(screen.queryByText('Узнать свои схемы')).toBeNull();
  });
});
