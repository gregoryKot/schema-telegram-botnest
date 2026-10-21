// @vitest-environment jsdom
// Карточка «Мои тёплые слова» в профиле: пусто — карточки нет (не выдуманная
// фраза), с данными — самая свежая фраза и счётчик, тап открывает полный список.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WarmWordsCard } from './WarmWordsCard';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';

vi.mock('../../components/exercises/WarmWordsEx', () => ({
  WarmWordsEx: (p: { onBack: () => void }) => <div data-testid="warm-list"><button onClick={p.onBack}>назад</button></div>,
}));

afterEach(cleanup);

const item = (text: string): WarmWordsItem => ({ text, modeId: 'healthy_adult', at: '2026-08-10T00:00:00.000Z' } as unknown as WarmWordsItem);

describe('WarmWordsCard', () => {
  it('пусто — ничего не рисует', () => {
    const { container } = render(<WarmWordsCard items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('показывает первую (самую свежую) фразу и склонённый счётчик', () => {
    render(<WarmWordsCard items={[item('Ты справляешься'), item('Старое'), item('Ещё')]} />);
    expect(screen.getByText('«Ты справляешься»')).toBeTruthy();
    expect(screen.getByText('3 фразы')).toBeTruthy();
    expect(screen.queryByText('«Старое»')).toBeNull();
  });

  it('тап открывает полный список, «назад» закрывает', async () => {
    render(<WarmWordsCard items={[item('Одно')]} />);
    expect(screen.getByText('1 фраза')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Мои тёплые слова'));
    expect(await screen.findByTestId('warm-list')).toBeTruthy();
    fireEvent.click(screen.getByText('назад'));
    expect(screen.queryByTestId('warm-list')).toBeNull();
  });
});
