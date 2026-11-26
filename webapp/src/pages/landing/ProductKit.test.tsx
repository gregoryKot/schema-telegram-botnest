// @vitest-environment jsdom
// ProductKit: плитка цветной бумаги со знаком. Карточка статьи — ArticleCard.test.tsx.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { InfoCard } from './ProductKit';
import { Heart } from '../../components/art/PaperArtSigns';

afterEach(() => cleanup());

describe('InfoCard', () => {
  it('цветная бумага с оттенком и знаком', () => {
    const { container } = render(<InfoCard Art={Heart} hue={45} title="Бесплатно">текст</InfoCard>);
    const card = container.querySelector('.pp-paper') as HTMLElement;
    expect(card.style.getPropertyValue('--h')).toBe('45');
    expect(card.querySelector('svg')).not.toBeNull();
    expect(card.textContent).toContain('Бесплатно');
  });
});
