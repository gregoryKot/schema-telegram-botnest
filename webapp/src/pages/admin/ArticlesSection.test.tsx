// @vitest-environment jsdom
// Админ-вкладка «Статьи»: список + удаление. Экран редактирования
// (ArticleEditor, TipTap) не рендерим здесь — WYSIWYG-редактор не работает в
// jsdom без отдельной настройки, это осознанная граница теста.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ArticlesSection } from './ArticlesSection';

vi.mock('../../api', () => ({
  api: {
    adminListArticles: vi.fn(),
    adminDeleteArticle: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const confirmSpy = vi.fn(() => true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
  confirmSpy.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ArticlesSection — на чистом контенте пусто, не выдумка', () => {
  it('без статей в API — «Пока нет статей.»', async () => {
    mockApi.adminListArticles.mockResolvedValue([]);
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Пока нет статей.');
  });
});

describe('ArticlesSection — список статей', () => {
  it('показывает реальные статьи из API', async () => {
    mockApi.adminListArticles.mockResolvedValue([
      { id: 1, title: 'Тревога и тело', slug: 'trevoga-i-telo', readMin: 6, date: '2026-01-10' },
    ]);
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Тревога и тело');
    expect(screen.getByText(/\/trevoga-i-telo · 6 мин/)).toBeTruthy();
  });

  it('удаление без подтверждения (confirm=false) статью НЕ убирает', async () => {
    confirmSpy.mockReturnValue(false);
    mockApi.adminListArticles.mockResolvedValue([
      { id: 1, title: 'Тревога и тело', slug: 'trevoga-i-telo', readMin: 6, date: '2026-01-10' },
    ]);
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Тревога и тело');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить статью' }));

    expect(mockApi.adminDeleteArticle).not.toHaveBeenCalled();
    expect(screen.getByText('Тревога и тело')).toBeTruthy();
  });

  it('удаление с подтверждением убирает статью из списка (read-after-write)', async () => {
    mockApi.adminListArticles
      .mockResolvedValueOnce([{ id: 1, title: 'Тревога и тело', slug: 'trevoga-i-telo', readMin: 6, date: '2026-01-10' }])
      .mockResolvedValue([]);
    mockApi.adminDeleteArticle.mockResolvedValue(undefined);
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Тревога и тело');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить статью' }));

    await screen.findByText('Пока нет статей.');
    expect(mockApi.adminDeleteArticle).toHaveBeenCalledWith('k', 1);
  });
});
