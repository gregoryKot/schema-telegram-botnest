// @vitest-environment jsdom
// «Тёплые слова»: загрузка обоих источников → список; пустой ответ →
// честное пустое состояние (правило «никаких заглушек»); событие открытия.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WarmWordsEx } from './WarmWordsEx';

vi.mock('../../api', () => ({
  api: {
    getModeNotes: vi.fn(),
    getModeDiary: vi.fn(),
    getPhraseChecks: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <WarmWordsEx onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('WarmWordsEx', () => {
  it('рисует элементы из обоих источников и шлёт событие открытия со счётчиком', async () => {
    mockApi.getModeNotes.mockResolvedValue([
      {
        modeId: 'critic',
        healthyView: 'Ты справишься, у тебя получалось раньше',
        updatedAt: '2026-01-10T00:00:00.000Z',
      },
    ]);
    mockApi.getPhraseChecks.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([
      {
        id: 1,
        modeId: 'child',
        healthyResponse: 'Я в безопасности прямо сейчас',
        createdAt: '2026-01-15T00:00:00.000Z',
      },
    ]);

    renderSheet();
    await act(async () => {});

    expect(
      screen.getByText('Ты справишься, у тебя получалось раньше'),
    ).toBeTruthy();
    expect(screen.getByText('Я в безопасности прямо сейчас')).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('warm_words_open', {
      count: 2,
    });
  });

  it('пустой ответ обоих источников — честное пустое состояние, не выдумка', async () => {
    mockApi.getModeNotes.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);

    renderSheet();
    await act(async () => {});

    expect(screen.getByText(/Здесь пока пусто/)).toBeTruthy();
    expect(mockApi.trackEvent).toHaveBeenCalledWith('warm_words_open', {
      count: 0,
    });
  });

  // QA клиента 2026-11, М7: переписанная фраза из «Критик или забота?» была
  // подписана «Режим · карточка режима».
  it('переписанная фраза подписана своим источником, а не карточкой режима', async () => {
    mockApi.getModeNotes.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([
      {
        id: 3,
        rewrite: 'Мне можно ошибаться',
        inWarmWords: true,
        createdAt: '2026-01-20T00:00:00.000Z',
      },
    ]);

    renderSheet();
    await act(async () => {});

    expect(screen.getByText('Мне можно ошибаться')).toBeTruthy();
    expect(screen.getByText('Переписанная фраза')).toBeTruthy();
    expect(screen.getByText(/· разбор фразы$/)).toBeTruthy();
    expect(screen.queryByText(/карточка режима$/)).toBeNull();
    expect(screen.queryByText('Режим')).toBeNull();
  });
});
