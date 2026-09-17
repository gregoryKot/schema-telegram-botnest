// @vitest-environment jsdom
// PhraseShareCard (webapp) — «Фраза для себя», паритет с мини-аппом
// (правило №16, GET /api/healthy-phrase был доступен только мини-аппу).
// Те же проверки, что и у миниаппа: скелетон пока грузится, пустой пул —
// блок не рендерится вовсе, «Другая ↻» перезапрашивает.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhraseShareCard } from './PhraseShareCard';
import { api } from '../api';

vi.mock('../api', () => ({ api: { getHealthyPhrase: vi.fn(), trackEvent: vi.fn() } }));
vi.mock('../../../shared/src/share/cards/phraseCard', () => ({ drawPhraseCard: vi.fn() }));

function renderCard() {
  return render(
    <MemoryRouter>
      <PhraseShareCard />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PhraseShareCard (webapp) — загрузка', () => {
  it('пока грузится — показывает скелетон, не спиннер', async () => {
    let resolvePromise!: (v: { text: string | null }) => void;
    vi.mocked(api.getHealthyPhrase).mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; }),
    );
    const { container } = renderCard();
    expect(screen.getByText('Фраза для себя')).toBeTruthy();
    expect(container.querySelectorAll('.skel').length).toBeGreaterThan(0);
    await act(async () => resolvePromise({ text: 'Ты справишься' }));
  });

  it('пустой пул фраз (text=null) — компонент не рендерится вовсе', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({ text: null });
    const { container } = renderCard();
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('api.getHealthyPhrase падает — трактуется как «нет фразы», блок скрывается', async () => {
    vi.mocked(api.getHealthyPhrase).mockRejectedValue(new Error('network'));
    const { container } = renderCard();
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('PhraseShareCard (webapp) — есть фраза', () => {
  it('показывает фразу в кавычках', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({ text: 'Ты справишься' });
    renderCard();
    expect(await screen.findByText('«Ты справишься»')).toBeTruthy();
  });

  it('«Другая ↻» перезапрашивает фразу', async () => {
    vi.mocked(api.getHealthyPhrase)
      .mockResolvedValueOnce({ text: 'Первая фраза' })
      .mockResolvedValueOnce({ text: 'Вторая фраза' });
    renderCard();
    await screen.findByText('«Первая фраза»');
    fireEvent.click(screen.getByText('Другая ↻'));
    expect(await screen.findByText('«Вторая фраза»')).toBeTruthy();
    expect(api.getHealthyPhrase).toHaveBeenCalledTimes(2);
  });

  it('кнопка «Поделиться фразой» открывает ShareCardSheet с заголовком «Фраза для себя»', async () => {
    vi.mocked(api.getHealthyPhrase).mockResolvedValue({ text: 'Ты справишься' });
    renderCard();
    await screen.findByText('«Ты справишься»');
    expect(screen.queryByText('Картинка уйдёт вместе со ссылкой')).toBeNull();
    fireEvent.click(screen.getByLabelText('Поделиться фразой'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });
});
