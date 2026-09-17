// @vitest-environment jsdom
// PhraseShareCard — «Фраза для себя» на экране «Здесь и сейчас» (0% покрытия).
// Проверяем: скелетон ПОКА грузится (правило «скелетоны по форме контента»),
// пустой пул → блок не рендерится вовсе (не пустой прямоугольник — тоже
// правило дизайна), кнопка «Другая» перезагружает фразу.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import { PhraseShareCard } from './PhraseShareCard';
import { api } from '../api';

vi.mock('../api', () => ({ api: { getHealthyPhrase: vi.fn() } }));
vi.mock('../../../shared/src/share/cards/phraseCard', () => ({
  drawPhraseCard: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PhraseShareCard — загрузка', () => {
  it('пока грузится — показывает скелетон (SkeletonLines), не спиннер', async () => {
    let resolvePromise!: (v: { text: string | null }) => void;
    vi.mocked(api.getHealthyPhrase).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const { container } = render(<PhraseShareCard />);
    expect(screen.getByText('Фраза для себя')).toBeTruthy();
    expect(container.querySelectorAll('[aria-hidden]').length).toBeGreaterThan(
      0,
    );
    await act(async () => resolvePromise({ text: 'Ты справишься' }));
  });

  it('пустой пул фраз (text=null) — компонент не рендерится вовсе (не пустой блок)', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({ text: null });
    const { container } = render(<PhraseShareCard />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('api.getHealthyPhrase падает — трактуется как «нет фразы», блок скрывается', async () => {
    vi.mocked(api.getHealthyPhrase).mockRejectedValue(new Error('network'));
    const { container } = render(<PhraseShareCard />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('PhraseShareCard — есть фраза', () => {
  it('показывает фразу в кавычках', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({
      text: 'Ты справишься',
    });
    render(<PhraseShareCard />);
    expect(await screen.findByText('«Ты справишься»')).toBeTruthy();
  });

  it('«Другая ↻» перезапрашивает фразу', async () => {
    vi.mocked(api.getHealthyPhrase)
      .mockResolvedValueOnce({ text: 'Первая фраза' })
      .mockResolvedValueOnce({ text: 'Вторая фраза' });
    render(<PhraseShareCard />);
    await screen.findByText('«Первая фраза»');
    fireEvent.click(screen.getByText('Другая ↻'));
    expect(await screen.findByText('«Вторая фраза»')).toBeTruthy();
    expect(api.getHealthyPhrase).toHaveBeenCalledTimes(2);
  });

  it('SharePill открывает ShareCardSheet с заголовком «Фраза для себя»', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({
      text: 'Ты справишься',
    });
    render(<PhraseShareCard />);
    await screen.findByText('«Ты справишься»');
    expect(screen.queryByText('Картинка уйдёт вместе со ссылкой')).toBeNull();
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });
});
