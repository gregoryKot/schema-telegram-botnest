// @vitest-environment jsdom
// Обложки статей (articleCoverModel.ts — бумага, articleCoverScenes.ts — сцены, ArticleCover.tsx —
// рамка с ленивым чанком): сверка с сидом статей — у каждой статьи из src/articles/articles.seed.ts
// своя сцена (новая статья в сиде без сцены краснит тест, а не тихо получает листы веером);
// у таблиц бумаги и сцен одни ключи; сцены не повторяются; три соседние по дате статьи —
// разной бумаги; сцена — декор языка знаков (скрыта от чтения, тень слоем, без фильтров и
// растра, цвета только токенами); своя сцена приезжает в рамку, у чужого slug — листы сразу.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ARTICLE_SEED } from '../../../../src/articles/articles.seed';
import { ARTICLE_COVER_HUE, articleCoverHue, hasOwnCover } from './articleCoverModel';
import { ARTICLE_SCENES, articleCoverScene } from './articleCoverScenes';
import { ArticleCover } from './ArticleCover';

afterEach(() => cleanup());

const SLUGS = Object.keys(ARTICLE_COVER_HUE);
/** Статьи, заведённые в админке (их нет в сиде): сцена есть, дата — только в базе. */
const ADMIN_ONLY = ['schematerapia-vda', 'zdoroviy-vzrosliy-bez-terapii'];

describe('обложки статей: сверка с сидом и двух таблиц', () => {
  it('у таблицы бумаги и таблицы сцен одни и те же slug в одном порядке', () => {
    expect(Object.keys(ARTICLE_SCENES)).toEqual(SLUGS);
  });

  it('у каждой статьи сида своя сцена', () => {
    const missing = ARTICLE_SEED.map((a) => a.slug).filter((slug) => !hasOwnCover(slug) || !articleCoverScene(slug));
    expect(missing).toEqual([]);
  });

  it('в модели нет лишних slug: только сид и две статьи из админки', () => {
    const seed = new Set(ARTICLE_SEED.map((a) => a.slug));
    expect(SLUGS.filter((s) => !seed.has(s))).toEqual(ADMIN_ONLY);
  });

  it('сцены не повторяются: у каждой статьи своя картинка', () => {
    expect(new Set(Object.values(ARTICLE_SCENES)).size).toBe(SLUGS.length);
  });

  it('модель идёт от новых статей к старым, как список, — и три соседние разной бумаги', () => {
    const date = new Map(ARTICLE_SEED.map((a) => [a.slug, a.date]));
    const seedOrder = SLUGS.filter((s) => date.has(s));
    const byDate = [...seedOrder].sort((a, b) => date.get(b)!.localeCompare(date.get(a)!));
    expect(seedOrder).toEqual(byDate);
    const hues = SLUGS.map((s) => ARTICLE_COVER_HUE[s]);
    hues.forEach((h, i) => {
      expect(h, SLUGS[i]).not.toBe(hues[i + 1]);
      expect(h, SLUGS[i]).not.toBe(hues[i + 2]);
    });
  });
});

describe('рамка обложки', () => {
  it('своя сцена приезжает в рамку бумаги своего оттенка (ленивый чанк)', async () => {
    const { container } = render(<ArticleCover slug="schema-terapiya-vs-kpt" className="ac-cover" />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.classList.contains('light-lock')).toBe(true);
    expect(box.style.getPropertyValue('--h')).toBe(String(ARTICLE_COVER_HUE['schema-terapiya-vs-kpt']));
    await waitFor(() => expect(box.querySelector('svg.scn')).not.toBeNull());
  });

  it('незнакомый slug — листы веером сразу, бумага по порядку карточки, соседние разные', () => {
    expect(hasOwnCover('novaya-statya')).toBe(false);
    const hues = [0, 1, 2, 3].map((i) => articleCoverHue('novaya-statya', i));
    expect(new Set(hues.slice(0, 3)).size).toBe(3);
    expect(hues[3]).toBe(hues[0]);
    const { container } = render(<ArticleCover slug="novaya-statya" className="ac-cover" />);
    expect(container.querySelector('svg.scn')).not.toBeNull();
  });

  it('slug из админки не достаёт свойства объекта (constructor, toString)', () => {
    for (const slug of ['constructor', 'toString']) {
      expect(hasOwnCover(slug), slug).toBe(false);
      expect(articleCoverScene(slug), slug).toBeUndefined();
    }
    const { container } = render(<ArticleCover slug="constructor" className="ac-cover" />);
    expect(container.querySelector('svg.scn')).not.toBeNull();
  });
});

describe('сцена обложки — декор языка знаков', () => {
  it.each(SLUGS)('%s', (slug) => {
    const Scene = ARTICLE_SCENES[slug];
    const hue = ARTICLE_COVER_HUE[slug];
    const { container } = render(<Scene hue={hue} />);
    const svg = container.querySelector('svg.scn') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.style.getPropertyValue('--h')).toBe(String(hue));
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
