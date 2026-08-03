// @vitest-environment jsdom
// Компонентные тесты DiarySection (архив дневников): реальные записи из api
// (без хардкод-заглушек), пустое онбординг-объяснение на чистом аккаунте,
// фильтры, удаление с подтверждением, стрик/дни-с-записью из реальных дат,
// ошибки API не роняют экран.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiarySection } from './DiarySection';

// SchemaEntrySheet/ModeEntrySheet/GratitudeEntrySheet используют
// useHistorySheet (нужен Router) — оборачиваем все рендеры.
function renderSection() {
  return render(
    <MemoryRouter>
      <DiarySection />
    </MemoryRouter>,
  );
}

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
    // Собственный eyebrow SchemaEntrySheet ("· новая запись") отличает его от
    // одноимённой карточки быстрого добавления на хабе.
    await screen.findByText('Дневник схем · новая запись');
  });

  it('карточка "Три вещи" открывает лист благодарности', async () => {
    renderSection();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());

    fireEvent.click(screen.getByText('Три вещи'));
    await screen.findByText(/за которые сегодня/);
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
