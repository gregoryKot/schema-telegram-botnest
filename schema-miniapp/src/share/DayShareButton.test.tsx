// @vitest-environment jsdom
// DayShareButton — единственная реализация «поделиться заполненным днём»
// (0% покрытия). ShareCardSheet рисует canvas — мокаем, как в других
// share-компонентах. Проверяем гейт видимости листа (open state) и что
// пропсы из useDayShare реально долетают до ShareCardSheet.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DayShareButton } from './DayShareButton';
import type { Need } from '../types';

vi.mock('./ShareCardSheet', () => ({
  ShareCardSheet: ({
    onClose,
    therapyNote,
  }: {
    onClose: () => void;
    therapyNote?: boolean;
  }) => (
    <div data-testid="share-card-sheet">
      {therapyNote ? 'with-therapy-note' : 'no-therapy-note'}
      <button onClick={onClose}>share-card-close</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '💙',
    title: 'Привязанность',
    chartLabel: 'Привязанность',
  },
];

describe('DayShareButton — гейт видимости листа', () => {
  it('изначально лист закрыт', () => {
    render(<DayShareButton needs={NEEDS} ratings={{ attachment: 6 }} />);
    expect(screen.queryByTestId('share-card-sheet')).toBeNull();
  });

  it('клик по кнопке открывает лист с therapyNote=true', () => {
    render(<DayShareButton needs={NEEDS} ratings={{ attachment: 6 }} />);
    fireEvent.click(screen.getByText('Поделиться днём'));
    expect(screen.getByTestId('share-card-sheet')).toBeTruthy();
    expect(screen.getByText('with-therapy-note')).toBeTruthy();
  });

  it('закрытие листа убирает его из DOM', () => {
    render(<DayShareButton needs={NEEDS} ratings={{ attachment: 6 }} />);
    fireEvent.click(screen.getByText('Поделиться днём'));
    fireEvent.click(screen.getByText('share-card-close'));
    expect(screen.queryByTestId('share-card-sheet')).toBeNull();
  });
});
