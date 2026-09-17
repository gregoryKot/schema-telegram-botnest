// @vitest-environment jsdom
// SchemaFlashcard — экран заземления и история карточек (0% покрытия).
// Полный путь заполнения — в SchemaFlashcard.flow.test.tsx (лимит ~300
// строк/файл). Здесь: маппинг api.getFlashcards → отображаемые карточки
// (реальные данные, не выдуманные), просмотр карточки истории, закрытие.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { SchemaFlashcard } from './SchemaFlashcard';
import { STORAGE_KEY } from './schemaFlashcard/constants';
import { api } from '../api';

vi.mock('../api', () => ({
  api: { getFlashcards: vi.fn(), createFlashcard: vi.fn() },
}));
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getFlashcards.mockResolvedValue([]);
  mockApi.createFlashcard.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('SchemaFlashcard — экран заземления', () => {
  it('открывается с текстом заземления и дыхательной инструкцией', () => {
    render(<SchemaFlashcard onClose={() => {}} />);
    expect(screen.getByText('Всё правильно')).toBeTruthy();
    expect(screen.getByText('Три вдоха прямо сейчас')).toBeTruthy();
  });

  it('без карточек в истории кнопка «История карточек» не показывается', async () => {
    render(<SchemaFlashcard onClose={() => {}} />);
    await waitFor(() => expect(mockApi.getFlashcards).toHaveBeenCalled());
    expect(screen.queryByText(/История карточек/)).toBeNull();
  });

  it('«Просто закрыть» зовёт onClose', () => {
    const onClose = vi.fn();
    render(<SchemaFlashcard onClose={onClose} />);
    fireEvent.click(screen.getByText('Просто закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SchemaFlashcard — история карточек из api.getFlashcards', () => {
  it('реальные карточки с сервера показываются в истории с режимом и потребностью', async () => {
    mockApi.getFlashcards.mockResolvedValue([
      {
        id: 5,
        modeId: 'angry_child',
        needId: 'limits',
        reflection: 'Разозлился на несправедливость',
        action: 'Сказал прямо, что не согласен',
        createdAt: '2026-01-15T10:00:00.000Z',
      },
    ]);
    render(<SchemaFlashcard onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('История карточек (1)')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('История карточек (1)'));
    expect(screen.getByText('История карточек')).toBeTruthy();
    expect(screen.getByText(/Злой Ребёнок.*Границы/)).toBeTruthy();
    expect(screen.getByText('→ Сказал прямо, что не согласен')).toBeTruthy();
  });

  it('клик по карточке истории открывает её детали', async () => {
    mockApi.getFlashcards.mockResolvedValue([
      {
        id: 6,
        modeId: 'detached',
        needId: 'play',
        reflection: null,
        action: null,
        createdAt: '2026-02-01T10:00:00.000Z',
      },
    ]);
    render(<SchemaFlashcard onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('История карточек (1)')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('История карточек (1)'));
    fireEvent.click(screen.getByText(/Отстранённый Защитник/));
    expect(screen.getByText('Режим')).toBeTruthy();
    expect(screen.getByText('Отстранённый Защитник')).toBeTruthy();
  });

  it('закрытие истории без просмотра карточки возвращает на заземление', async () => {
    mockApi.getFlashcards.mockResolvedValue([
      {
        id: 7,
        modeId: 'critic',
        needId: 'expression',
        reflection: null,
        action: null,
        createdAt: '2026-02-01T10:00:00.000Z',
      },
    ]);
    render(<SchemaFlashcard onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('История карточек (1)')).toBeTruthy(),
    );
    fireEvent.click(screen.getByText('История карточек (1)'));
    // Заголовок листа истории — жмём подсказку закрытия шита (Escape эквивалент)
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getByText('Всё правильно')).toBeTruthy());
  });

  it('пустая история с сервера — «Пока нет сохранённых карточек»', async () => {
    // localStorage не пуст, но сервер вернул [] — источник правды сервер.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'local-1',
          date: '1 янв',
          mode: 'critic',
          reflection: '',
          needId: 'expression',
          action: '',
        },
      ]),
    );
    mockApi.getFlashcards.mockResolvedValue([]);
    render(<SchemaFlashcard onClose={() => {}} />);
    await waitFor(() => expect(mockApi.getFlashcards).toHaveBeenCalled());
    expect(screen.queryByText(/История карточек \(/)).toBeNull();
  });

  it('сбой api.getFlashcards — история молча остаётся из localStorage, не крашится', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: 'local-1',
          date: '1 янв',
          mode: 'critic',
          reflection: '',
          needId: 'expression',
          action: '',
        },
      ]),
    );
    mockApi.getFlashcards.mockRejectedValue(new Error('network'));
    render(<SchemaFlashcard onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText('История карточек (1)')).toBeTruthy(),
    );
  });
});
