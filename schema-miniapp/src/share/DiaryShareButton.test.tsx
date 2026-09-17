// @vitest-environment jsdom
// DiaryShareButton — шеринг сводки дневника из хедера списка записей (0%
// покрытия). Ключевой инвариант: на пустом дневнике (0 записей) кнопки нет
// вовсе — делиться нечем, а пустая карточка выглядела бы как баг «дневник
// пуст» вместо честного отсутствия шеринга.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DiaryShareButton } from './DiaryShareButton';

vi.mock('./ShareCardSheet', () => ({
  ShareCardSheet: ({
    onClose,
    title,
  }: {
    onClose: () => void;
    title: string;
  }) => (
    <div data-testid="share-card-sheet">
      {title}
      <button onClick={onClose}>share-card-close</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('DiaryShareButton — пустой дневник', () => {
  it('0 записей — кнопки нет вовсе', () => {
    const { container } = render(
      <DiaryShareButton
        emoji="📓"
        title="Дневник схем"
        color="#fff"
        entries={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('DiaryShareButton — есть записи', () => {
  it('кнопка видна, клик открывает ShareCardSheet с правильным заголовком', () => {
    render(
      <DiaryShareButton
        emoji="📓"
        title="Дневник схем"
        color="#fff"
        entries={[{ createdAt: '2026-08-01T00:00:00.000Z' }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Поделиться'));
    expect(screen.getByTestId('share-card-sheet')).toBeTruthy();
    expect(screen.getByText('Поделиться дневником')).toBeTruthy();
  });

  it('закрытие листа убирает его из DOM', () => {
    render(
      <DiaryShareButton
        emoji="📓"
        title="Дневник схем"
        color="#fff"
        entries={[{ createdAt: '2026-08-01T00:00:00.000Z' }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Поделиться'));
    fireEvent.click(screen.getByText('share-card-close'));
    expect(screen.queryByTestId('share-card-sheet')).toBeNull();
  });
});
