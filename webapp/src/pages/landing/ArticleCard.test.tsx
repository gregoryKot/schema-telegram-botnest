// @vitest-environment jsdom
// ArticleCard — одна карточка статьи на лендинг и список /articles. Обложка — сцена статьи по
// slug на её бумаге (articleCoverModel.ts), у статьи без своей сцены — листы веером, у соседних
// карточек разной бумаги. Фото-обложек нет: даже если старый ответ API принесёт heroImage,
// картинка не рисуется. Дата — календарный день в любой зоне (E14).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticleCard } from './ArticleCard';
import { ARTICLE_COVERS } from '../../components/art/articleCoverModel';
import type { ArticleSummary } from '../../api';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

afterEach(() => cleanup());

const article = (slug: string): ArticleSummary =>
  ({ id: 1, slug, title: 'Т', description: 'О', date: '2026-10-01T00:00:00Z', readMin: 4 });

const card = (a: ArticleSummary, props: { index?: number; titleAs?: 'h2' | 'p'; withYear?: boolean } = {}) =>
  render(<MemoryRouter><ArticleCard a={a} {...props} /></MemoryRouter>).container;

describe('ArticleCard', () => {
  it('ведёт на страницу статьи', () => {
    const box = card(article('rezhimy-v-schema-terapii'));
    expect(box.querySelector('a')?.getAttribute('href')).toBe('/articles/rezhimy-v-schema-terapii');
  });

  it('статья со своей сценой — её бумага и сцена, без фото, даже если API прислал heroImage', () => {
    const legacy = { ...article('skhemy-yanga-spisok'), heroImage: 'data:image/jpeg;base64,AAA' } as ArticleSummary;
    const cover = card(legacy).querySelector('.ac-cover') as HTMLElement;
    expect(cover.style.getPropertyValue('--h')).toBe(String(ARTICLE_COVERS['skhemy-yanga-spisok'].hue));
    expect(cover.querySelector('svg.scn[aria-hidden="true"]')).not.toBeNull();
    expect(cover.querySelector('img')).toBeNull();
  });

  it('статья без своей сцены — листы на цветной бумаге, у соседей разный оттенок', () => {
    const hue = (i: number) => {
      const cover = card(article('novaya-statya'), { index: i }).querySelector('.ac-cover') as HTMLElement;
      expect(cover.querySelector('svg.scn')).not.toBeNull();
      const h = cover.style.getPropertyValue('--h');
      cleanup();
      return h;
    };
    const hues = [0, 1, 2].map(hue);
    expect(new Set(hues).size).toBe(3);
    expect(hue(3)).toBe(hues[0]);
  });

  it('заголовок — абзац на лендинге и h2 в списке статей', () => {
    expect(card(article('a')).querySelector('p.ac-title')?.textContent).toBe('Т');
    cleanup();
    expect(card(article('a'), { titleAs: 'h2' }).querySelector('h2.ac-title')?.textContent).toBe('Т');
  });

  // E14 (аудит 2026-11): дата — полночь UTC моментом; западнее UTC была 30 сентября.
  it('дата статьи — тот же день в любой зоне; год — только в полном списке', () => {
    forEachTimeZone((tz) => {
      expect(card(article('a')).querySelector('.ac-meta')?.textContent, tz).toBe('1 октября · 4 мин');
      cleanup();
      expect(card(article('a'), { withYear: true }).querySelector('.ac-meta')?.textContent, tz).toBe('1 октября 2026 г. · 4 мин');
      cleanup();
    });
  });
});
