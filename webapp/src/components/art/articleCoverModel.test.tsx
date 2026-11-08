// @vitest-environment jsdom
// Обложки статей (articleCoverModel.ts, ArticleScenes*.tsx, ArticleCover.tsx): сверка с сидом
// статей — у каждой статьи из src/articles/articles.seed.ts своя сцена (новая статья в сиде
// без сцены краснит тест, а не тихо получает листы веером); сцены не повторяются; три соседние
// по дате статьи — разной бумаги; сцена — декор языка знаков (скрыта от чтения, тень слоем,
// без фильтров и растра, цвета только токенами).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ARTICLE_SEED } from '../../../../src/articles/articles.seed';
import { ARTICLE_COVERS, articleCoverHue, articleCoverLook } from './articleCoverModel';
import { ArticleCover } from './ArticleCover';

afterEach(() => cleanup());

const SLUGS = Object.keys(ARTICLE_COVERS);
/** Статьи, заведённые в админке (их нет в сиде): сцена есть, дата — только в базе. */
const ADMIN_ONLY = ['schematerapia-vda', 'zdoroviy-vzrosliy-bez-terapii'];

describe('обложки статей: сверка с сидом', () => {
  it('у каждой статьи сида своя сцена', () => {
    const missing = ARTICLE_SEED.map((a) => a.slug).filter((slug) => !articleCoverLook(slug));
    expect(missing).toEqual([]);
  });

  it('в модели нет лишних slug: только сид и две статьи из админки', () => {
    const seed = new Set(ARTICLE_SEED.map((a) => a.slug));
    expect(SLUGS.filter((s) => !seed.has(s))).toEqual(ADMIN_ONLY);
  });

  it('сцены не повторяются: у каждой статьи своя картинка', () => {
    const scenes = SLUGS.map((s) => ARTICLE_COVERS[s].Scene);
    expect(new Set(scenes).size).toBe(SLUGS.length);
  });

  it('модель идёт от новых статей к старым, как список, — и три соседние разной бумаги', () => {
    const date = new Map(ARTICLE_SEED.map((a) => [a.slug, a.date]));
    const seedOrder = SLUGS.filter((s) => date.has(s));
    const byDate = [...seedOrder].sort((a, b) => date.get(b)!.localeCompare(date.get(a)!));
    expect(seedOrder).toEqual(byDate);
    const hues = SLUGS.map((s) => ARTICLE_COVERS[s].hue);
    hues.forEach((h, i) => {
      expect(h, SLUGS[i]).not.toBe(hues[i + 1]);
      expect(h, SLUGS[i]).not.toBe(hues[i + 2]);
    });
  });
});

describe('обложка без своей сцены', () => {
  it('незнакомый slug — листы веером, бумага по порядку карточки, соседние разные', () => {
    expect(articleCoverLook('novaya-statya')).toBeUndefined();
    const hues = [0, 1, 2, 3].map((i) => articleCoverHue('novaya-statya', i));
    expect(new Set(hues.slice(0, 3)).size).toBe(3);
    expect(hues[3]).toBe(hues[0]);
  });

  it('slug из админки не достаёт свойства объекта (constructor, toString)', () => {
    expect(articleCoverLook('constructor')).toBeUndefined();
    expect(articleCoverLook('toString')).toBeUndefined();
    const { container } = render(<ArticleCover slug="constructor" className="ac-cover" />);
    expect(container.querySelector('svg.scn')).not.toBeNull();
  });
});

describe('сцена обложки — декор языка знаков', () => {
  it.each(SLUGS)('%s', (slug) => {
    const { container } = render(<ArticleCover slug={slug} className="ac-cover" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.classList.contains('light-lock')).toBe(true);
    expect(box.style.getPropertyValue('--h')).toBe(String(ARTICLE_COVERS[slug].hue));
    const svg = box.querySelector('svg.scn') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.style.getPropertyValue('--h')).toBe(String(ARTICLE_COVERS[slug].hue));
    expect(svg.querySelector('filter, [filter], image, img')).toBeNull();
    expect(svg.querySelector('.scn-shade')?.children.length).toBeGreaterThan(0);
    for (const el of svg.querySelectorAll('[fill], [stroke]')) {
      for (const attr of ['fill', 'stroke']) {
        const value = el.getAttribute(attr);
        if (value === null || value === 'none') continue;
        expect(value, `${slug} ${attr}`).toMatch(/^(var\(--|color-mix\(in srgb, var\(--)/);
      }
    }
  });
});
