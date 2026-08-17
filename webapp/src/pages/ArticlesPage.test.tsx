// @vitest-environment jsdom
// ArticlesPage.tsx — список статей (ArticlesListPage) и страница отдельной
// статьи (ArticlePage), 0% покрытия. Проверяем: список из реального API
// (не заглушки), 404 на несуществующий slug, санитизацию HTML содержимого
// (DOMPurify — XSS-защита свободного контента) и CTA на запись.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ArticlesListPage, ArticlePage } from './ArticlesPage';
import { ApiError } from '../api';
import type { ArticleSummary, Article } from '../api';

const listArticles = vi.fn();
const getArticle = vi.fn();
// importOriginal: класс ApiError должен остаться НАСТОЯЩИМ — ArticlePage
// ветвится по instanceof, подделка класса в моке сделала бы тест тавтологией.
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  api: {
    listArticles: (...a: unknown[]) => listArticles(...a),
    getArticle: (...a: unknown[]) => getArticle(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

const SUMMARY: ArticleSummary = {
  id: 1, slug: 'schemas-101', title: 'Что такое схемы', description: 'Введение',
  date: '2026-01-10', readMin: 5, heroImage: null, diagramKey: null,
};

describe('ArticlesListPage', () => {
  it('пока список не пришёл — показывает «Загрузка…», не пустой экран', () => {
    listArticles.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><ArticlesListPage /></MemoryRouter>);
    expect(screen.getByText('Загрузка…')).toBeTruthy();
  });

  it('рендерит реальные статьи из API со ссылкой на конкретную статью', async () => {
    listArticles.mockResolvedValue([SUMMARY]);
    render(<MemoryRouter><ArticlesListPage /></MemoryRouter>);
    const link = await screen.findByText('Что такое схемы');
    expect(link.closest('a')?.getAttribute('href')).toBe('/articles/schemas-101');
  });

  it('сбой ≠ пусто: провал загрузки показывает «не удалось», а не пустую сетку статей', async () => {
    listArticles.mockRejectedValue(new Error('network'));
    render(<MemoryRouter><ArticlesListPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Не удалось загрузить статьи/)).toBeTruthy();
    expect(screen.queryByText('Загрузка…')).toBeNull();
  });

  it('«Попробовать ещё раз» перезапрашивает список и рисует статьи', async () => {
    listArticles
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([SUMMARY]);
    render(<MemoryRouter><ArticlesListPage /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Попробовать ещё раз'));
    expect(await screen.findByText('Что такое схемы')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(listArticles).toHaveBeenCalledTimes(2);
  });
});

function renderArticle(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/articles/${slug}`]}>
      <Routes>
        <Route path="/articles/:slug" element={<ArticlePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ArticlePage', () => {
  it('незнакомый slug (серверный 404) после загрузки показывает 404 со ссылкой назад', async () => {
    getArticle.mockRejectedValue(new ApiError(404, 'Cannot GET /api/articles/unknown'));
    renderArticle('unknown');
    expect(await screen.findByText('404')).toBeTruthy();
    expect(screen.getByText('← К статьям')).toBeTruthy();
  });

  it('ApiError с НЕ-404 статусом (5xx) — это сбой, не «статьи нет»', async () => {
    getArticle.mockRejectedValue(new ApiError(500, 'Internal server error'));
    renderArticle('schemas-101');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
  });

  it('сбой ≠ 404: обрыв сети на существующей статье показывает «не удалось», а не 404', async () => {
    getArticle.mockRejectedValue(new TypeError('Failed to fetch'));
    renderArticle('schemas-101');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Не удалось загрузить статью/)).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
  });

  it('«Попробовать ещё раз» после сбоя перезапрашивает и рендерит статью', async () => {
    getArticle
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ...SUMMARY, content: '<p>Текст статьи</p>' });
    renderArticle('schemas-101');
    fireEvent.click(await screen.findByText('Попробовать ещё раз'));
    expect(await screen.findByText('Что такое схемы')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getArticle).toHaveBeenCalledTimes(2);
  });

  it('рендерит заголовок, дату и очищенный HTML-контент статьи', async () => {
    const article: Article = {
      ...SUMMARY,
      content: '<p>Текст статьи</p><script>alert(1)</script>',
    };
    getArticle.mockResolvedValue(article);
    const { container } = renderArticle('schemas-101');

    expect(await screen.findByText('Что такое схемы')).toBeTruthy();
    expect(screen.getByText('5 минут чтения')).toBeTruthy();
    expect(screen.getByText('Текст статьи')).toBeTruthy();
    // DOMPurify обязан вырезать script — иначе контент статьи это XSS.
    expect(container.querySelector('script')).toBeNull();
  });

  it('CTA «Записаться» на странице статьи ведёт на реальный урл записи', async () => {
    getArticle.mockResolvedValue({ ...SUMMARY, content: '<p>Текст</p>' });
    renderArticle('schemas-101');
    const cta = await screen.findAllByText('Записаться →');
    expect((cta[0] as HTMLAnchorElement).getAttribute('href')).toMatch(/^https?:\/\//);
  });
});
