// @vitest-environment jsdom
// ProductKit: карточка статьи. Обложка из API — картинкой; статьи без обложки (их
// большинство) раньше стояли серой пустой плашкой — теперь листы (Sheets) на цветной
// бумаге, у соседних карточек разной. Выдуманной картинки на месте обложки нет.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ArticleCard, InfoCard } from './ProductKit';
import { Heart } from '../../components/art/PaperArtSigns';
import type { ArticleSummary } from '../../api';

afterEach(() => cleanup());

const article = (heroImage: string | null): ArticleSummary =>
  ({ id: 1, slug: 'a', title: 'Т', description: 'О', date: '2026-10-01T00:00:00Z', readMin: 4, heroImage } as ArticleSummary);

describe('ArticleCard', () => {
  it('с обложкой — картинка обложки, без знака', () => {
    const { container } = render(<ArticleCard a={article('/img/a.webp')} />);
    expect(container.querySelector('.pl2-article-img img')?.getAttribute('src')).toBe('/img/a.webp');
    expect(container.querySelector('.pl2-article-img svg')).toBeNull();
  });

  it('без обложки — листы на цветной бумаге, у соседей разный оттенок', () => {
    const hue = (i: number) => {
      const { container } = render(<ArticleCard a={article(null)} index={i} />);
      const box = container.querySelector('.pl2-article-img') as HTMLElement;
      expect(box.querySelector('img')).toBeNull();
      expect(box.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      const h = box.style.getPropertyValue('--h');
      cleanup();
      return h;
    };
    const hues = [0, 1, 2].map(hue);
    expect(new Set(hues).size).toBe(3);
    expect(hue(3)).toBe(hues[0]);
  });
});

describe('InfoCard', () => {
  it('цветная бумага с оттенком и знаком', () => {
    const { container } = render(<InfoCard Art={Heart} hue={45} title="Бесплатно">текст</InfoCard>);
    const card = container.querySelector('.pp-paper') as HTMLElement;
    expect(card.style.getPropertyValue('--h')).toBe('45');
    expect(card.querySelector('svg')).not.toBeNull();
    expect(card.textContent).toContain('Бесплатно');
  });
});
