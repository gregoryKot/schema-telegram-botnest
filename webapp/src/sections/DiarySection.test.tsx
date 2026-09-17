// @vitest-environment jsdom
// Компонентные тесты DiarySection (архив дневников): реальные записи из api
// (без хардкод-заглушек), пустое онбординг-объяснение на чистом аккаунте,
// фильтры, удаление с подтверждением, стрик/дни-с-записью из реальных дат,
// ошибки API не роняют экран.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiarySection } from './DiarySection';
import { saveDraft, clearDraft } from '../utils/drafts';

// SchemaEntrySheet/ModeEntrySheet/GratitudeEntrySheet используют
// useHistorySheet (нужен Router) — оборачиваем все рендеры.
function renderSection() {
  return render(
    <MemoryRouter>
      <DiarySection />
    </MemoryRouter>,
  );
}

// Листы создания записи — тяжёлые формы (не в скоупе этого файла).
// Мокаем кнопочницей, чтобы проверить только то, что решает сам
// DiarySection: onSave добавляет запись в список и закрывает лист.
vi.mock('../components/diary/SchemaEntrySheet', () => ({
  SchemaEntrySheet: (p: { onClose: () => void; onSave: (d: { trigger: string; emotions: string[]; schemaIds: string[] }) => Promise<void> }) => (
    <div data-testid="schema-entry-sheet">
      <button onClick={() => p.onSave({ trigger: 'Новый триггер', emotions: [], schemaIds: [] })}>Сохранить схему</button>
      <button onClick={p.onClose}>Закрыть лист схемы</button>
    </div>
  ),
}));
vi.mock('../components/diary/ModeEntrySheet', () => ({
  ModeEntrySheet: (p: { onClose: () => void; onSave: (d: { situation: string; modeId: string }) => Promise<void> }) => (
    <div data-testid="mode-entry-sheet">
      <button onClick={() => p.onSave({ situation: 'Новая ситуация', modeId: 'critic' })}>Сохранить режим</button>
      <button onClick={p.onClose}>Закрыть лист режима</button>
    </div>
  ),
}));
vi.mock('../components/diary/GratitudeEntrySheet', () => ({
  GratitudeEntrySheet: (p: { onClose: () => void; date: string; existingItems?: string[]; onSave: (date: string, items: string[]) => Promise<void> }) => (
    <div data-testid="gratitude-entry-sheet">
      <div data-testid="gratitude-existing">{JSON.stringify(p.existingItems ?? null)}</div>
      <button onClick={() => p.onSave(p.date, ['Новый пункт'])}>Сохранить благодарность</button>
      <button onClick={p.onClose}>Закрыть лист благодарности</button>
    </div>
  ),
}));

vi.mock('../api', () => ({
  api: {
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
    getGratitudeDiary: vi.fn(),
    getProfile: vi.fn(),
    deleteSchemaDiary: vi.fn(),
    deleteModeDiary: vi.fn(),
    deleteGratitudeDiary: vi.fn(),
    createSchemaDiary: vi.fn(),
    createModeDiary: vi.fn(),
    createGratitudeDiary: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function schemaEntry(overrides: Partial<{ id: number; createdAt: string; trigger: string; schemaIds: string[] }> = {}) {
  return {
    id: 1, createdAt: '2026-08-01T10:00:00Z', trigger: 'Коллега не ответил на сообщение',
    emotions: [], schemaIds: [],
    ...overrides,
  };
}
function modeEntry(overrides: Partial<{ id: number; createdAt: string; situation: string; modeId: string }> = {}) {
  return { id: 1, createdAt: '2026-08-01T11:00:00Z', situation: 'Критика на работе', modeId: 'vulnerable_child', ...overrides };
}
function gratitudeEntry(overrides: Partial<{ id: number; date: string; items: string[] }> = {}) {
  return { id: 1, date: '2026-08-01', items: ['Хорошая погода'], createdAt: '2026-08-01T20:00:00Z', ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getGratitudeDiary.mockResolvedValue([]);
  mockApi.getProfile.mockResolvedValue({ ysq: { activeSchemaIds: [] } });
});

afterEach(() => {
  cleanup();
});

describe('DiarySection — пустой аккаунт (без хардкод-заглушек)', () => {
  it('без записей показывает объясняющий пустое состояние, а не "0 записей"', async () => {
    renderSection();
    await waitFor(() => expect(screen.getByText('Пока ни одной записи')).toBeTruthy());
    expect(screen.queryByText(/Архив ·/)).toBeNull();
  });

  it('ошибка getSchemaDiary не роняет экран — остаётся пустое состояние', async () => {
    mockApi.getSchemaDiary.mockRejectedValue(new Error('network down'));
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());
    expect(screen.getByText('Пока ни одной записи')).toBeTruthy();
  });
});

describe('DiarySection — сбой загрузки (сбой ≠ пусто)', () => {
  // Регрессия: раньше отказ Promise.all([getSchemaDiary, getModeDiary,
  // getGratitudeDiary]) оставлял entries [] без объяснения — дневник
  // выглядел стёртым, хотя записи (терапевтические данные) целы на сервере
  // (CLAUDE.md «сбой ≠ пусто»; пара к miniapp DiarySection).
  it('провал загрузки показывает НЕблокирующий баннер поверх пустого состояния, а не тихую пустоту', async () => {
    mockApi.getSchemaDiary.mockRejectedValue(new Error('network down'));
    renderSection();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Не удалось загрузить записи дневника/);
    // Баннер не блокирует остальной UI — кнопка новой записи доступна.
    expect(screen.getByText('+ Новая запись')).toBeTruthy();
  });

  it('«Обновить» перезапрашивает записи и убирает баннер при успехе', async () => {
    mockApi.getSchemaDiary.mockRejectedValueOnce(new Error('network down'));
    renderSection();
    await screen.findByRole('alert');

    mockApi.getSchemaDiary.mockResolvedValueOnce([schemaEntry({ trigger: 'Загрузилось после повтора' })]);
    fireEvent.click(screen.getByText('Обновить'));

    await screen.findByText('Загрузилось после повтора');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('DiarySection — реальные записи из api', () => {
  it('показывает реальный триггер записи схемы, а не выдуманный текст', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Реальный триггер из API' })]);
    renderSection();
    await screen.findByText('Реальный триггер из API');
  });

  it('счётчик "Архив · N" считает реальные записи всех трёх типов', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    mockApi.getModeDiary.mockResolvedValue([modeEntry()]);
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry()]);
    renderSection();

    await screen.findByText('Архив · 3');
    expect(screen.getByText(/3 записи · ведётся непрерывно/)).toBeTruthy();
  });

  it('запись благодарности показывает реальные пункты, а не заглушку', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ items: ['Утренний кофе', 'Звонок другу'] })]);
    renderSection();
    await screen.findByText('Утренний кофе');
    expect(screen.getByText('Звонок другу')).toBeTruthy();
  });
});

describe('DiarySection — фильтры', () => {
  it('фильтр "Схемы" скрывает записи режимов и благодарности', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Запись-схема' })]);
    mockApi.getModeDiary.mockResolvedValue([modeEntry({ situation: 'Запись-режим' })]);
    renderSection();

    await screen.findByText('Запись-схема');
    fireEvent.click(screen.getByText('Схемы'));

    expect(screen.getByText('Запись-схема')).toBeTruthy();
    expect(screen.queryByText('Запись-режим')).toBeNull();
  });

  it('фильтр без записей своего типа показывает "Нет записей этого типа"', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Режимы'));
    await screen.findByText('Нет записей этого типа');
  });
});

describe('DiarySection — удаление записи (с подтверждением)', () => {
  it('удаление требует подтверждения и вызывает api.deleteSchemaDiary только после второго клика', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ id: 42 })]);
    mockApi.deleteSchemaDiary.mockResolvedValue(undefined);
    renderSection();

    const entry = await screen.findByText('Коллега не ответил на сообщение');
    fireEvent.click(entry); // раскрыть карточку
    fireEvent.click(screen.getByText('Удалить'));
    expect(mockApi.deleteSchemaDiary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Удалить навсегда'));
    await waitFor(() => expect(mockApi.deleteSchemaDiary).toHaveBeenCalledWith(42));
    await waitFor(() => expect(screen.queryByText('Коллега не ответил на сообщение')).toBeNull());
  });

  it('"Отмена" в подтверждении удаления не вызывает api', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry()]);
    renderSection();

    const entry = await screen.findByText('Коллега не ответил на сообщение');
    fireEvent.click(entry);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Отмена'));

    expect(mockApi.deleteSchemaDiary).not.toHaveBeenCalled();
    expect(screen.getByText('Коллега не ответил на сообщение')).toBeTruthy();
  });
});

describe('DiarySection — новая запись', () => {
  it('клик "+ Новая запись" открывает лист схемы (SchemaEntrySheet)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ Новая запись'));
    await screen.findByTestId('schema-entry-sheet');
  });

  it('карточка "Три вещи" открывает лист благодарности', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Три вещи'));
    await screen.findByTestId('gratitude-entry-sheet');
  });

  it('сохранение записи схемы добавляет её в список и закрывает лист (read-after-write)', async () => {
    mockApi.createSchemaDiary.mockResolvedValue(schemaEntry({ id: 99, trigger: 'Новый триггер' }));
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ Новая запись'));
    fireEvent.click(await screen.findByText('Сохранить схему'));

    await waitFor(() => expect(screen.queryByTestId('schema-entry-sheet')).toBeNull());
    await screen.findByText('Новый триггер');
  });

  it('карточка "Записать режим" открывает лист режима, сохранение добавляет запись', async () => {
    mockApi.createModeDiary.mockResolvedValue(modeEntry({ id: 98, situation: 'Новая ситуация' }));
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Записать режим'));
    await screen.findByTestId('mode-entry-sheet');
    fireEvent.click(screen.getByText('Сохранить режим'));

    await waitFor(() => expect(screen.queryByTestId('mode-entry-sheet')).toBeNull());
    await screen.findByText('Новая ситуация');
  });

  it('сохранение благодарности добавляет её в архив, existingItems пусты на чистый день', async () => {
    mockApi.createGratitudeDiary.mockResolvedValue(gratitudeEntry({ id: 97, items: ['Новый пункт'] }));
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Три вещи'));
    expect((await screen.findByTestId('gratitude-existing')).textContent).toBe('null');
    fireEvent.click(screen.getByText('Сохранить благодарность'));

    await waitFor(() => expect(screen.queryByTestId('gratitude-entry-sheet')).toBeNull());
    await screen.findByText('Новый пункт');
  });

  it('уже есть запись благодарности за сегодня — лист открывается с её пунктами (existingItems)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ date: today, items: ['Уже записано'] })]);
    renderSection();
    await screen.findByText('Уже записано');

    fireEvent.click(screen.getByText('Три вещи'));
    expect((await screen.findByTestId('gratitude-existing')).textContent).toBe(JSON.stringify(['Уже записано']));
  });

  it('закрытие листа без сохранения возвращает на хаб (архив не меняется)', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('+ Новая запись'));
    fireEvent.click(await screen.findByText('Закрыть лист схемы'));

    await waitFor(() => expect(screen.queryByTestId('schema-entry-sheet')).toBeNull());
    expect(mockApi.createSchemaDiary).not.toHaveBeenCalled();
  });
});

describe('DiarySection — профиль недоступен при загрузке (не роняет экран)', () => {
  it('ошибка getProfile — записи схем всё равно загружаются', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('network down'));
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ trigger: 'Видно несмотря на сбой профиля' })]);
    renderSection();
    await screen.findByText('Видно несмотря на сбой профиля');
  });
});

describe('DiarySection — удаление записей режима и благодарности', () => {
  it('удаление записи режима убирает её из списка', async () => {
    mockApi.getModeDiary.mockResolvedValue([modeEntry({ id: 55, situation: 'Критика на работе' })]);
    mockApi.deleteModeDiary.mockResolvedValue(undefined);
    renderSection();

    const entry = await screen.findByText('Критика на работе');
    fireEvent.click(entry);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Удалить навсегда'));

    await waitFor(() => expect(mockApi.deleteModeDiary).toHaveBeenCalledWith(55));
    await waitFor(() => expect(screen.queryByText('Критика на работе')).toBeNull());
  });

  it('удаление записи благодарности убирает её из списка', async () => {
    mockApi.getGratitudeDiary.mockResolvedValue([gratitudeEntry({ id: 33, items: ['Удаляемый пункт'] })]);
    mockApi.deleteGratitudeDiary.mockResolvedValue(undefined);
    renderSection();

    const entry = await screen.findByText('Удаляемый пункт');
    fireEvent.click(entry);
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Удалить навсегда'));

    await waitFor(() => expect(mockApi.deleteGratitudeDiary).toHaveBeenCalledWith(33));
    await waitFor(() => expect(screen.queryByText('Удаляемый пункт')).toBeNull());
  });
});

describe('DiarySection — черновики: продолжить/удалить', () => {
  it('черновик схемы: «Продолжить →» открывает лист схемы', async () => {
    saveDraft('schema', { trigger: 'Черновик-триггер' });
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    await screen.findByText('Продолжить →');
    fireEvent.click(screen.getByText('Продолжить →'));
    await screen.findByTestId('schema-entry-sheet');
    clearDraft('schema');
  });

  it('черновик схемы: удаление (два клика — × затем подтверждение) убирает баннер', async () => {
    saveDraft('schema', { trigger: 'Черновик-триггер' });
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());
    await screen.findByText('Продолжить →');

    fireEvent.click(screen.getByLabelText('Удалить черновик'));
    fireEvent.click(screen.getByText('удалить'));
    await waitFor(() => expect(screen.queryByText('Продолжить →')).toBeNull());
    clearDraft('schema');
  });
});

describe('DiarySection — группировка по дате', () => {
  it('группа сегодняшних записей помечена "сегодня"', async () => {
    const today = new Date().toISOString();
    mockApi.getSchemaDiary.mockResolvedValue([schemaEntry({ createdAt: today })]);
    renderSection();

    // «сегодня · понедельник» рендерится как два соседних текстовых узла —
    // ищем по содержимому родителя, а не по одному узлу.
    await waitFor(() => {
      const rel = document.querySelector('.date-group-rel');
      expect(rel?.textContent).toContain('сегодня');
    });
  });
});
