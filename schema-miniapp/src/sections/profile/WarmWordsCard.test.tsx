// @vitest-environment jsdom
// WarmWordsCard — превью «Тёплых слов» на вкладке «Я»: самая свежая фраза,
// счётчик, пусто → ничего не рендерит, тап открывает полный список (свой
// компонент/тест — здесь мокаем, чтобы не задваивать сеть/трекинг).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { WarmWordsCard } from './WarmWordsCard';

vi.mock('../../api', () => ({
  api: {
    getModeNotes: vi.fn(),
    getModeDiary: vi.fn(),
    getPhraseChecks: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../../components/WarmWords', () => ({
  WarmWords: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="warm-words-sheet">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WarmWordsCard — пусто', () => {
  it('нет ни одной тёплой фразы — карточка не рендерится', async () => {
    mockApi.getModeNotes.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([]);
    const { container } = render(<WarmWordsCard />);
    await waitFor(() => expect(mockApi.getModeNotes).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});

describe('WarmWordsCard — превью', () => {
  it('показывает самую свежую фразу и счётчик, тап открывает WarmWords', async () => {
    mockApi.getModeNotes.mockResolvedValue([
      {
        modeId: 'vulnerable_child',
        healthyView: 'Старое слово',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mockApi.getModeDiary.mockResolvedValue([
      {
        id: 1,
        modeId: 'vulnerable_child',
        healthyResponse: 'Свежее тёплое слово',
        createdAt: '2026-08-10T00:00:00.000Z',
      },
    ]);
    mockApi.getPhraseChecks.mockResolvedValue([]);

    render(<WarmWordsCard />);
    expect(await screen.findByText(/Свежее тёплое слово/)).toBeTruthy();
    expect(screen.getByText(/2 фразы/)).toBeTruthy();

    expect(screen.queryByTestId('warm-words-sheet')).toBeNull();
    fireEvent.click(screen.getByText('Мои тёплые слова'));
    expect(screen.getByTestId('warm-words-sheet')).toBeTruthy();
  });
});

describe('WarmWordsCard — сеть упала', () => {
  it('запрос падает — карточка не рендерится (не «зависший» скелетон навсегда, не выдумка)', async () => {
    mockApi.getModeNotes.mockRejectedValue(new Error('network'));
    mockApi.getModeDiary.mockResolvedValue([]);
    mockApi.getPhraseChecks.mockResolvedValue([]);
    const { container } = render(<WarmWordsCard />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
