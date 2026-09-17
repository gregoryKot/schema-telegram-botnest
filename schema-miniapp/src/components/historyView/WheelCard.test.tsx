// @vitest-environment jsdom
// WheelCard — карточка колеса потребностей + ссылки «детство»/«что за этим
// стоит». Проверяет три состояния ссылки на колесо детства (нет данных без
// колбэка → пусто; нет данных с колбэком → приглашение оценить; есть данные
// → ссылка «детство») и обе клавиатурные ветки (Enter/Space) на всех трёх
// интерактивных ссылках — их легко перепутать местами при правке условия.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WheelCard } from './WheelCard';
import type { Need } from '../../types';

afterEach(cleanup);

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '💙',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
  { id: 'autonomy', emoji: '🔑', title: 'Автономия', chartLabel: 'Автономия' },
];

const BASE_PROPS = {
  needs: NEEDS,
  ratings: { attachment: 6, autonomy: 4 },
  prevRatings: {},
  selectedDate: '2026-08-03',
  onClickNeed: () => {},
  onClickCenter: () => {},
};

describe('WheelCard — ссылка на колесо детства', () => {
  it('нет childhoodRatings и нет onOpenChildhoodWheel — ссылки нет вовсе', () => {
    render(<WheelCard {...BASE_PROPS} childhoodRatings={{}} />);
    expect(screen.queryByText(/детство/)).toBeNull();
    expect(screen.queryByText(/Оценить детство/)).toBeNull();
  });

  it('нет данных, но есть колбэк — приглашение «Оценить детство»', () => {
    const onOpenChildhoodWheel = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{}}
        onOpenChildhoodWheel={onOpenChildhoodWheel}
      />,
    );
    const link = screen.getByText(/Оценить детство/);
    fireEvent.click(link);
    expect(onOpenChildhoodWheel).toHaveBeenCalled();
  });

  it('приглашение «Оценить детство» реагирует и на клавиатуру (пробел)', () => {
    const onOpenChildhoodWheel = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{}}
        onOpenChildhoodWheel={onOpenChildhoodWheel}
      />,
    );
    fireEvent.keyDown(screen.getByText(/Оценить детство/), { key: ' ' });
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  it('есть данные детства — показывает пунктирную ссылку «детство»', () => {
    const onOpenChildhoodWheel = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{ attachment: 5 }}
        onOpenChildhoodWheel={onOpenChildhoodWheel}
      />,
    );
    const link = screen.getByText('детство');
    expect(link).toBeTruthy();
    expect(screen.queryByText(/Оценить детство/)).toBeNull();

    fireEvent.click(link);
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });

  it('ссылка «детство» реагирует на Enter и на пробел', () => {
    const onOpenChildhoodWheel = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{ attachment: 5 }}
        onOpenChildhoodWheel={onOpenChildhoodWheel}
      />,
    );
    const link = screen.getByText('детство');
    fireEvent.keyDown(link, { key: 'Enter' });
    fireEvent.keyDown(link, { key: ' ' });
    expect(onOpenChildhoodWheel).toHaveBeenCalledTimes(2);
  });

  it('ссылка «детство» игнорирует прочие клавиши', () => {
    const onOpenChildhoodWheel = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{ attachment: 5 }}
        onOpenChildhoodWheel={onOpenChildhoodWheel}
      />,
    );
    fireEvent.keyDown(screen.getByText('детство'), { key: 'Tab' });
    expect(onOpenChildhoodWheel).not.toHaveBeenCalled();
  });
});

describe('WheelCard — «что за этим стоит»', () => {
  it('без onOpenSchemas ссылки нет', () => {
    render(<WheelCard {...BASE_PROPS} childhoodRatings={{}} />);
    expect(screen.queryByText(/Что за этим стоит/)).toBeNull();
  });

  it('клик по «Что за этим стоит» зовёт onOpenSchemas', () => {
    const onOpenSchemas = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{}}
        onOpenSchemas={onOpenSchemas}
      />,
    );
    fireEvent.click(screen.getByText(/Что за этим стоит/));
    expect(onOpenSchemas).toHaveBeenCalled();
  });

  it('клавиатурная активация (Enter) тоже зовёт onOpenSchemas', () => {
    const onOpenSchemas = vi.fn();
    render(
      <WheelCard
        {...BASE_PROPS}
        childhoodRatings={{}}
        onOpenSchemas={onOpenSchemas}
      />,
    );
    fireEvent.keyDown(screen.getByText(/Что за этим стоит/), {
      key: 'Enter',
    });
    expect(onOpenSchemas).toHaveBeenCalledTimes(1);
  });
});
