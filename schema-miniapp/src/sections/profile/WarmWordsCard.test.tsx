// @vitest-environment jsdom
// WarmWordsCard — превью «Тёплых слов» на вкладке «Я»: чисто презентационная
// карточка, данные приходят готовыми через props (useAboutMe грузит их сама,
// одной волной с остальными полями «Я» — см. useAboutMe.ts и
// ProfileSection.test.tsx про «вторую волну», замер 2026-08-22).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WarmWordsCard } from './WarmWordsCard';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';

vi.mock('../../components/WarmWords', () => ({
  WarmWords: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="warm-words-sheet">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

function item(text: string, at: string): WarmWordsItem {
  return {
    key: text,
    source: 'diary',
    modeId: 'vulnerable_child',
    text,
    at: new Date(at),
  };
}

describe('WarmWordsCard — пусто', () => {
  it('items=[] — карточка не рендерится', () => {
    const { container } = render(<WarmWordsCard items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('WarmWordsCard — превью', () => {
  it('показывает первую (самую свежую по collectWarmWords) фразу и счётчик, тап открывает WarmWords', () => {
    const items = [
      item('Свежее тёплое слово', '2026-08-10T00:00:00.000Z'),
      item('Старое слово', '2026-01-01T00:00:00.000Z'),
    ];
    render(<WarmWordsCard items={items} />);
    expect(screen.getByText(/Свежее тёплое слово/)).toBeTruthy();
    expect(screen.getByText(/2 фразы/)).toBeTruthy();

    expect(screen.queryByTestId('warm-words-sheet')).toBeNull();
    fireEvent.click(screen.getByText('Мои тёплые слова'));
    expect(screen.getByTestId('warm-words-sheet')).toBeTruthy();
  });
});
