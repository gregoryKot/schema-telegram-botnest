// @vitest-environment jsdom
// Кнопка шаринга дневника (webapp ↔ miniapp, правило №3) — логика и разметка
// общие, кнопка и ShareCardSheet приходят инъекцией. Тут — сам компонент с
// поддельными ShareCardSheet/renderButton, площадочные обёртки
// (webapp/schema-miniapp share/DiaryShareButton.tsx) проверяют свою инъекцию.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DiaryShareButton } from './DiaryShareButton';
import type { ShareCardSheetProps } from './shareCardSheetProps';

// jsdom не реализует canvas 2D-контекст — рисование покрыто
// cards/diaryCard.test.ts, здесь только проверяем что draw() вызывается.
const drawDiaryCard = vi.fn();
vi.mock('./cards/diaryCard', async () => {
  const actual =
    await vi.importActual<typeof import('./cards/diaryCard')>(
      './cards/diaryCard',
    );
  return {
    ...actual,
    drawDiaryCard: (...args: unknown[]) => drawDiaryCard(...args),
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

function renderButton(entries: Array<{ createdAt: string }>) {
  return render(
    <DiaryShareButton
      emoji="📓"
      title="Дневник схем"
      color="#fff"
      entries={entries}
      botShortUrl="https://t.me/bot"
      ShareCardSheet={FakeSheet}
      renderButton={(onClick) => <button onClick={onClick}>share</button>}
    />,
  );
}

describe('DiaryShareButton — пустой дневник', () => {
  it('0 записей — кнопки нет вовсе', () => {
    const { container } = renderButton([]);
    expect(container.firstChild).toBeNull();
  });
});

describe('DiaryShareButton — есть записи', () => {
  it('клик по кнопке открывает ShareCardSheet «Поделиться дневником», draw() рисует', () => {
    renderButton([{ createdAt: '2026-08-01T00:00:00.000Z' }]);
    expect(screen.queryByTestId('sheet')).toBeNull();
    fireEvent.click(screen.getByText('share'));
    expect(screen.getByTestId('sheet')).toBeTruthy();
    expect(screen.getByText('Поделиться дневником')).toBeTruthy();
    fireEvent.click(screen.getByText('draw'));
    expect(drawDiaryCard).toHaveBeenCalled();
  });

  it('onClose из ShareCardSheet закрывает его обратно', () => {
    renderButton([{ createdAt: '2026-08-01T00:00:00.000Z' }]);
    fireEvent.click(screen.getByText('share'));
    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByTestId('sheet')).toBeNull();
  });
});
