// @vitest-environment jsdom
// Админ-вкладка «Статьи»: список + удаление (ConfirmDialog, Ж4). Экран редактирования
// (ArticleEditor, TipTap) не рендерим здесь — WYSIWYG-редактор не работает в
// jsdom без отдельной настройки, это осознанная граница теста.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import { ArticlesSection } from './ArticlesSection';

vi.mock('../../api', () => ({
  api: {
    adminListArticles: vi.fn(),
    adminDeleteArticle: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

// Ж4 (аудит 2026-08): нативный confirm() больше не зовётся — шпион ловит
// возврат к нему; подтверждение идёт через ConfirmDialog.
const confirmSpy = vi.fn(() => true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', confirmSpy);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ARTICLE = { id: 1, title: 'Тревога и тело', slug: 'trevoga-i-telo', readMin: 6, date: '2026-01-10' };
const dialog = () => screen.getByRole('dialog', { name: 'Удалить статью?' });

describe('ArticlesSection — на чистом контенте пусто, не выдумка', () => {
  it('без статей в API — «Пока нет статей.»', async () => {
    // Начальный список пуст, «Пока нет статей.» стоит и до ответа: ждём сам
    // ответ (как renderSettled в PhotoSection.test.tsx), потом проверяем.
    const response = Promise.resolve([]);
    mockApi.adminListArticles.mockReturnValue(response);
    render(<ArticlesSection adminKey="k" />);
    await act(async () => { await response; });
    expect(mockApi.adminListArticles).toHaveBeenCalledWith('k');
    expect(screen.getByText('Пока нет статей.')).toBeTruthy();
  });
});

describe('ArticlesSection — сбой ≠ пусто', () => {
  it('отказ загрузки (неверный ключ/сеть) показывает ошибку, а не «Пока нет статей.»', async () => {
    mockApi.adminListArticles.mockRejectedValue(new Error('API error: 403'));
    render(<ArticlesSection adminKey="wrong" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Не удалось загрузить статьи/)).toBeTruthy();
    expect(screen.queryByText('Пока нет статей.')).toBeNull();
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

  it('«Отмена» в диалоге статью НЕ удаляет', async () => {
    mockApi.adminListArticles.mockResolvedValue([ARTICLE]);
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Тревога и тело');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить статью' }));
    expect(within(dialog()).getByText(/«Тревога и тело» пропадёт/)).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Отмена' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockApi.adminDeleteArticle).not.toHaveBeenCalled();
    expect(screen.getByText('Тревога и тело')).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('подтверждение в диалоге удаляет статью и перечитывает список (read-after-write)', async () => {
    mockApi.adminListArticles.mockResolvedValueOnce([ARTICLE]).mockResolvedValue([]);
    mockApi.adminDeleteArticle.mockResolvedValue(undefined);
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Тревога и тело');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить статью' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Удалить' }));

    await screen.findByText('Пока нет статей.');
    expect(mockApi.adminDeleteArticle).toHaveBeenCalledWith('k', 1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('сбой удаления виден в диалоге, статья остаётся', async () => {
    mockApi.adminListArticles.mockResolvedValue([ARTICLE]);
    mockApi.adminDeleteArticle.mockRejectedValue(new Error('API error: 403'));
    render(<ArticlesSection adminKey="k" />);
    await screen.findByText('Тревога и тело');
    fireEvent.click(screen.getByRole('button', { name: 'Удалить статью' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Удалить' }));

    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(/Не удалось удалить — статья на месте/);
    expect(screen.getByText('Тревога и тело')).toBeTruthy();
  });
});
