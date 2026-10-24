// @vitest-environment jsdom
// Кнопка «Поделиться месяцем» (webapp ↔ miniapp, правило №3) — логика и
// разметка общие, кнопка и ShareCardSheet приходят инъекцией. Тут — сам
// компонент с поддельными ShareCardSheet/renderButton, площадочные обёртки
// (webapp/schema-miniapp heatmapShare.tsx) проверяют только свою инъекцию.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MonthShareButton } from './MonthShareButton';
import type { ShareCardSheetProps } from './shareCardSheetProps';

// jsdom не реализует canvas 2D-контекст — рисование покрыто
// cards/monthCard.test.ts, здесь только проверяем что draw() вызывается.
const drawMonthCard = vi.fn();
vi.mock('./cards/monthCard', async () => {
  const actual =
    await vi.importActual<typeof import('./cards/monthCard')>(
      './cards/monthCard',
    );
  return {
    ...actual,
    drawMonthCard: (...args: unknown[]) => drawMonthCard(...args),
  };
});

afterEach(cleanup);

function FakeSheet(props: ShareCardSheetProps) {
  return (
    <div data-testid="sheet">
      {props.title}
      <button onClick={() => props.draw(document.createElement('canvas'))}>
        draw
      </button>
      <button onClick={props.onClose}>close</button>
    </div>
  );
}

describe('MonthShareButton — нет активных дней', () => {
  it('кнопка не рендерится вовсе', () => {
    const { container } = render(
      <MonthShareButton
        activeDates={new Set()}
        totalDays={0}
        botShortUrl="https://t.me/bot"
        ShareCardSheet={FakeSheet}
        renderButton={(onClick) => <button onClick={onClick}>share</button>}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('MonthShareButton — есть активные дни', () => {
  it('клик по кнопке открывает ShareCardSheet «Мой месяц»', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(
      <MonthShareButton
        activeDates={new Set([today])}
        totalDays={5}
        botShortUrl="https://t.me/bot"
        ShareCardSheet={FakeSheet}
        renderButton={(onClick) => <button onClick={onClick}>share</button>}
      />,
    );
    expect(screen.queryByTestId('sheet')).toBeNull();
    fireEvent.click(screen.getByText('share'));
    expect(screen.getByTestId('sheet')).toBeTruthy();
    expect(screen.getByText('Мой месяц')).toBeTruthy();
    fireEvent.click(screen.getByText('draw'));
    expect(drawMonthCard).toHaveBeenCalled();
  });

  it('onClose из ShareCardSheet закрывает его обратно', () => {
    const today = new Date().toISOString().slice(0, 10);
    render(
      <MonthShareButton
        activeDates={new Set([today])}
        totalDays={5}
        botShortUrl="https://t.me/bot"
        ShareCardSheet={FakeSheet}
        renderButton={(onClick) => <button onClick={onClick}>share</button>}
      />,
    );
    fireEvent.click(screen.getByText('share'));
    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByTestId('sheet')).toBeNull();
  });
});
