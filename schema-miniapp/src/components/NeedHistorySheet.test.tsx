// @vitest-environment jsdom
// NeedHistorySheet — карточка истории одной потребности (0% покрытия):
// вычисление тренда за неделю из реальных ratings (не заглушка), сравнение
// с детской оценкой (только когда она реально передана), случайный совет —
// детерминируем через мок Math.random, открытие пояснения по клику на «?».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedHistorySheet } from './NeedHistorySheet';
import type { Need, DayHistory } from '../types';

vi.mock('./NeedDisclaimerSheet', () => ({
  NeedDisclaimerSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="need-disclaimer">
      <button onClick={onClose}>disclaimer-close</button>
    </div>
  ),
}));

const NEED: Need = {
  id: 'attachment',
  emoji: '🤝',
  title: 'Привязанность',
  chartLabel: 'Привязанность',
};

function day(daysAgo: number, score: number): DayHistory {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { date, ratings: { attachment: score } };
}

afterEach(cleanup);

describe('NeedHistorySheet — тренд считается из реальных данных истории', () => {
  it('рост оценок за неделю показывает «Растёт», а не выдуманную метку', () => {
    const history = [
      day(0, 9),
      day(1, 8),
      day(2, 8),
      day(3, 3),
      day(4, 2),
      day(5, 2),
    ];
    render(
      <NeedHistorySheet
        need={NEED}
        value={9}
        history={history}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Растёт')).toBeTruthy();
  });

  it('падение оценок показывает «Падает»', () => {
    const history = [
      day(0, 2),
      day(1, 2),
      day(2, 3),
      day(3, 8),
      day(4, 9),
      day(5, 8),
    ];
    render(
      <NeedHistorySheet
        need={NEED}
        value={2}
        history={history}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Падает')).toBeTruthy();
  });

  it('без истории (пустой массив) не падает и не рисует выдуманный тренд-рост', () => {
    render(
      <NeedHistorySheet
        need={NEED}
        value={5}
        history={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Стабильно')).toBeTruthy();
  });
});

describe('NeedHistorySheet — сравнение с детской оценкой (только если реально передана)', () => {
  it('без childhoodValue блок сравнения с детством не рендерится', () => {
    render(
      <NeedHistorySheet
        need={NEED}
        value={5}
        history={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/^Детство:/)).toBeNull();
  });

  it('с реальным childhoodValue показывает именно его, а не подставное число', () => {
    render(
      <NeedHistorySheet
        need={NEED}
        value={5}
        history={[]}
        childhoodValue={3}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Детство: 3\/10/)).toBeTruthy();
  });
});

describe('NeedHistorySheet — совет дня детерминирован', () => {
  it('Math.random фиксирует конкретный совет из пула — тот же индекс даёт тот же текст', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { unmount } = render(
      <NeedHistorySheet
        need={NEED}
        value={8}
        history={[]}
        onClose={() => {}}
      />,
    );
    const firstRenderText = document.body.textContent;
    unmount();
    render(
      <NeedHistorySheet
        need={NEED}
        value={8}
        history={[]}
        onClose={() => {}}
      />,
    );
    expect(document.body.textContent).toBe(firstRenderText);
    spy.mockRestore();
  });
});

describe('NeedHistorySheet — пояснение к совету', () => {
  it('клик по «?» открывает NeedDisclaimerSheet', () => {
    render(
      <NeedHistorySheet
        need={NEED}
        value={5}
        history={[]}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(screen.getByTestId('need-disclaimer')).toBeTruthy();
  });
});

describe('NeedHistorySheet — закрытие листа', () => {
  it('вызывает onClose', () => {
    const onClose = vi.fn();
    render(
      <NeedHistorySheet need={NEED} value={5} history={[]} onClose={onClose} />,
    );
    // BottomSheet рисует и свой backdrop с тем же aria-label — кликаем по
    // первому найденному (крестик в шапке NeedSheetHeader), а не гадаем.
    fireEvent.click(screen.getAllByLabelText('Закрыть')[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
