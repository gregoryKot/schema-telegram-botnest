// @vitest-environment jsdom
// Карточка прошлого разбора: шаринг прямо из «Прошлых разборов» (паритет с
// HistoryCard мини-аппа). Главное: делиться можно ТЕКУЩИМ текстом ответа, а
// пустой ответ не создаёт краткую карточку «было и стало».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockCanvas2d } from '../../../test-support/mockCanvas2d';
import { PhraseHistoryCard } from './PhraseHistoryCard';
import type { PhraseCheckEntry } from '../../../api';

vi.mock('../../../api', () => ({
  api: { trackEvent: vi.fn(), updatePhraseCheck: vi.fn() },
}));

mockCanvas2d();

afterEach(cleanup);

const tr = (ty: string) => ty;
const entry = (rewrite: string | null): PhraseCheckEntry => ({
  id: 1,
  phrase: 'я всё порчу',
  marks: ['worth'],
  rewrite,
  inWarmWords: false,
  createdAt: '2026-10-01T10:00:00.000Z',
});

function renderCard(rewrite: string | null) {
  return render(
    <MemoryRouter>
      <PhraseHistoryCard entry={entry(rewrite)} onClose={vi.fn()} onUpdated={vi.fn()} tr={tr} />
    </MemoryRouter>,
  );
}

describe('PhraseHistoryCard — шаринг из истории', () => {
  it('с сохранённым ответом — обе опции, карточка «было и стало» открывает лист', () => {
    renderCard('бывает, поправимо');
    expect(screen.getByText('Поделиться карточкой')).toBeTruthy();
    expect(screen.getByText('Поделиться всем разбором')).toBeTruthy();
    fireEvent.click(screen.getByText('Поделиться карточкой'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });

  it('без ответа краткой карточки нет, полный разбор остаётся', () => {
    renderCard(null);
    expect(screen.queryByText('Поделиться карточкой')).toBeNull();
    expect(screen.getByText('Поделиться всем разбором')).toBeTruthy();
  });

  it('набранный в карточке ответ сразу даёт краткую карточку (без сохранения)', () => {
    renderCard(null);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ошибка – не приговор' } });
    expect(screen.getByText('Поделиться карточкой')).toBeTruthy();
  });
});
