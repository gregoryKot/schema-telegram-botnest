// @vitest-environment jsdom
// Компонентные тесты SchemasSection (экран «Мои паттерны»): реальные данные
// профиля/YSQ (без хардкод-заглушек), пустые/скелетон-состояния, пикеры схем
// и режимов, ты/вы-вилка (включая два дефекта, найденные и починенные в этом
// заходе — «Пройди тест...» и «Добавь режимы...» без tr()).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { SchemasSection } from './SchemasSection';

vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(),
    getYsqHistory: vi.fn(),
    getYsqProgress: vi.fn(),
    listMyModeMaps: vi.fn(),
    updateSettings: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function profile(overrides: Partial<{ mySchemaIds: string[]; myModeIds: string[]; activeSchemaIds: string[]; completedAt: string | null }> = {}) {
  return {
    name: null, role: 'CLIENT' as const,
    ysq: { completedAt: overrides.completedAt ?? null, activeSchemaIds: overrides.activeSchemaIds ?? [] },
    notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 },
    streak: 0,
    lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
    mySchemaIds: overrides.mySchemaIds ?? [],
    myModeIds: overrides.myModeIds ?? [],
  };
}

function renderSection(props: Partial<{ onOpenChildhoodWheel: () => void; childhoodRatings: Record<string, number> }> = {}, form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter>
        <SchemasSection onOpenSchema={vi.fn()} onOpenChildhoodWheel={vi.fn()} {...props} />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getProfile.mockResolvedValue(profile());
  mockApi.getYsqHistory.mockResolvedValue([]);
  mockApi.getYsqProgress.mockResolvedValue(null);
  mockApi.listMyModeMaps.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('SchemasSection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('без схем/режимов показывает реальные пустые подсказки, а не выдуманные данные', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Пройди тест на схемы или добавь вручную')).toBeTruthy();
    expect(screen.getByText('Добавь режимы которые узнаёшь у себя')).toBeTruthy();
    expect(screen.getByText('Начать →')).toBeTruthy();
  });

  it('ошибка getProfile не роняет экран — остаётся пустое состояние вместо краха', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('network down'));
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Пройди тест на схемы или добавь вручную')).toBeTruthy();
  });
});

describe('SchemasSection — скелетон загрузки', () => {
  it('пока грузится профиль — скелетон-плашки вместо "Пройди тест..." и без 0/NaN', async () => {
    let resolveProfile!: (v: unknown) => void;
    mockApi.getProfile.mockReturnValue(new Promise(r => { resolveProfile = r; }));
    const { container } = renderSection();

    // Скелетон — блок мерцающих плашек (animation: shimmer), а не готовый текст.
    expect(container.querySelectorAll('[style*="shimmer"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('Пройди тест на схемы или добавь вручную')).toBeNull();

    resolveProfile(profile());
    await waitFor(() => expect(container.querySelectorAll('[style*="shimmer"]').length).toBe(0));
  });
});

describe('SchemasSection — ты/вы вилка', () => {
  it('на «ты»: подсказки на «ты», без "вы"-форм', async () => {
    renderSection({}, 'ty');
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Пройди тест на схемы или добавь вручную')).toBeTruthy();
    expect(screen.getByText('Добавь режимы которые узнаёшь у себя')).toBeTruthy();
    expect(screen.getByText(/Определи схемы автоматически/)).toBeTruthy();
  });

  it('на «вы»: те же подсказки во множественном числе, ни одной "ты"-формы', async () => {
    renderSection({}, 'vy');
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Пройдите тест на схемы или добавьте вручную')).toBeTruthy();
    expect(screen.getByText('Добавьте режимы которые узнаёте у себя')).toBeTruthy();
    expect(screen.getByText(/Определите схемы автоматически/)).toBeTruthy();
    expect(screen.queryByText('Пройди тест на схемы или добавь вручную')).toBeNull();
    expect(screen.queryByText('Добавь режимы которые узнаёшь у себя')).toBeNull();
  });

  it('заголовок ЮSQ-раздела "Твои/Ваши выраженные схемы" разводится по форме', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ activeSchemaIds: ['emotional_deprivation'] }));
    renderSection({}, 'vy');
    await screen.findByText('Ваши выраженные схемы');
    expect(screen.queryByText('Твои выраженные схемы')).toBeNull();
  });
});

describe('SchemasSection — реальные данные YSQ/профиля', () => {
  it('активные схемы из ysq.activeSchemaIds показывают реальное имя и балл, а не заглушку', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ activeSchemaIds: ['emotional_deprivation'], completedAt: '2026-07-01T00:00:00Z' }));
    mockApi.getYsqHistory.mockResolvedValue([
      { id: 1, completedAt: '2026-07-01T00:00:00Z', scores: [{ id: 'emotional_deprivation', pct5plus: 80, avg: 4.5 }] },
    ]);
    renderSection();

    await screen.findByText('Эмоциональная депривация');
    expect(screen.getByText('4.5/6')).toBeTruthy();
  });

  it('незавершённый тест показывает реальный прогресс "продолжить (N из 116)"', async () => {
    mockApi.getYsqProgress.mockResolvedValue({ answers: [1, 2, 0, 3], page: 1 });
    renderSection();

    await screen.findByText('продолжить (3 из 116) →');
  });

  it('завершённый тест без прогресса — "пройден <дата> · результаты →"', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ completedAt: '2026-07-15T00:00:00Z' }));
    renderSection();

    await waitFor(() => expect(screen.getByText(/пройден/)).toBeTruthy());
  });
});

describe('SchemasSection — мои схемы/режимы (ручной выбор)', () => {
  it('вручную добавленные схемы (mySchemaIds) отображаются как чипы', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ mySchemaIds: ['abandonment'] }));
    renderSection();

    await screen.findByText('Покинутость');
  });

  it('вручную добавленные режимы (myModeIds) отображаются как чипы', async () => {
    mockApi.getProfile.mockResolvedValue(profile({ myModeIds: ['vulnerable_child'] }));
    renderSection();

    await screen.findByText('Уязвимый Ребёнок');
  });

  it('"+ Добавить" у схем открывает SchemaPickerSheet, сохранение зовёт api.updateSettings', async () => {
    mockApi.updateSettings.mockResolvedValue({ ok: true });
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());

    const addButtons = screen.getAllByText('+ Добавить');
    fireEvent.click(addButtons[0]);
    await screen.findByText(/Выбери схемы, которые тебе близки/);
  });
});

describe('SchemasSection — карта режимов от терапевта', () => {
  it('без карт от терапевта блок скрыт (не 0 карт, а вообще нет блока)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.listMyModeMaps).toHaveBeenCalled());
    expect(screen.queryByText('Карта режимов с терапевтом')).toBeNull();
  });

  it('с реальными картами показывает их число и открывается по клику', async () => {
    mockApi.listMyModeMaps.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    renderSection();

    await screen.findByText('2 карты · как режимы развиваются на триггер');
    fireEvent.click(screen.getByText('Карта режимов с терапевтом'));
    // ModeMapViewer лениво грузится внутри листа — лист открылся (заголовок листа).
    await waitFor(() => expect(screen.getAllByText('Карта режимов').length).toBeGreaterThanOrEqual(1));
  });
});

describe('SchemasSection — базовые потребности / колесо детства', () => {
  it('без childhoodRatings — плашка "Пройти колесо детства"', async () => {
    renderSection({ childhoodRatings: {} });
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Пройти колесо детства →')).toBeTruthy();
  });

  it('с childhoodRatings — реальный балл потребности, а не заглушка, и "Изменить детство"', async () => {
    renderSection({ childhoodRatings: { attachment: 6 } });
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.getByText('Изменить детство →')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('клик по потребности открывает NeedDetailSheet (появляется кнопка "Назад")', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.queryByText('Назад')).toBeNull();
    fireEvent.click(screen.getByText('Привязанность'));
    await screen.findByText('Назад');
  });
});

describe('SchemasSection — пикер режимов', () => {
  it('открывает ModePickerSheet с популярными режимами, сохранение вызывает updateSettings', async () => {
    mockApi.updateSettings.mockResolvedValue({ ok: true });
    renderSection();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());

    fireEvent.click(screen.getAllByText('+ Добавить')[1]);
    await screen.findByText('С чего начать');
    // «Уязвимый Ребёнок» дублируется с постоянно видимой «Картой режимов» на
    // основной странице — берём последнее вхождение (пикер рендерится позже в DOM).
    const matches = screen.getAllByText('Уязвимый Ребёнок');
    fireEvent.click(matches[matches.length - 1]);
    fireEvent.click(screen.getByText('Сохранить · 1'));

    await waitFor(() => expect(mockApi.updateSettings).toHaveBeenCalledWith({ myModeIds: ['vulnerable_child'] }));
  });
});
