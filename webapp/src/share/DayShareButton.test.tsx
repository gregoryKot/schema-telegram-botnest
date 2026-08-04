// @vitest-environment jsdom
// DayShareButton — кнопка «Поделиться днём» + открытие ShareCardSheet.
// Файл был на 0% покрытия. draw() рисует на canvas внутри useShareCard,
// обёрнут там в try/catch — canvas можно не мокать отдельно.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DayShareButton } from './DayShareButton';
import type { Need } from '../types';

afterEach(() => {
  cleanup();
});

const NEEDS: Need[] = [
  { id: 'safety', emoji: '🛡️', title: 'Безопасность', chartLabel: 'Безопасность' },
];

function renderButton() {
  return render(
    <MemoryRouter>
      <DayShareButton needs={NEEDS} ratings={{ safety: 7 }} date="2026-08-01" />
    </MemoryRouter>,
  );
}

describe('DayShareButton', () => {
  it('по умолчанию шит закрыт — виден только вход-кнопка', () => {
    renderButton();
    expect(screen.getByText('Поделиться днём')).toBeTruthy();
    expect(screen.queryByText('Скопировать текст')).toBeNull();
  });

  it('клик по кнопке открывает шит карточки дня', () => {
    renderButton();
    fireEvent.click(screen.getByText('Поделиться днём'));
    expect(screen.getByText('Карточка дня')).toBeTruthy();
    expect(screen.getByText('Скопировать текст')).toBeTruthy();
  });

  it('клик по фону шита закрывает его (goBack), не оставляя карточку открытой', () => {
    renderButton();
    fireEvent.click(screen.getByText('Поделиться днём'));
    expect(screen.getByText('Карточка дня')).toBeTruthy();
    // Первый role="presentation" — затемнённый фон-оверлей.
    fireEvent.click(screen.getAllByRole('presentation')[0]);
    expect(screen.queryByText('Карточка дня')).toBeNull();
  });
});
