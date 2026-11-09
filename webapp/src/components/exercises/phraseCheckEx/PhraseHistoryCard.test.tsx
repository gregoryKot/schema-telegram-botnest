// @vitest-environment jsdom
// Карточка прошлого разбора: шаринг прямо из «Прошлых разборов» (паритет с
// HistoryCard мини-аппа). Главное: делиться можно ТЕКУЩИМ текстом ответа, а
// пустой ответ не создаёт краткую карточку «было и стало». Удаление разбора —
// с подтверждением, сбой виден и не закрывает лист.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockCanvas2d } from '../../../test-support/mockCanvas2d';
import { PhraseHistoryCard } from './PhraseHistoryCard';
import { api, type PhraseCheckEntry } from '../../../api';

vi.mock('../../../api', () => ({
  api: { trackEvent: vi.fn(), updatePhraseCheck: vi.fn(), deletePhraseCheck: vi.fn() },
}));
const deletePhraseCheck = api.deletePhraseCheck as unknown as ReturnType<typeof vi.fn>;
const trackEvent = api.trackEvent as unknown as ReturnType<typeof vi.fn>;

mockCanvas2d();

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const tr = (ty: string) => ty;
const entry = (rewrite: string | null): PhraseCheckEntry => ({
  id: 1,
  phrase: 'я всё порчу',
  marks: ['worth'],
  rewrite,
  inWarmWords: false,
  createdAt: '2026-10-01T10:00:00.000Z',
});

function renderCard(rewrite: string | null, handlers: { onClose?: () => void; onDeleted?: (id: number) => void } = {}) {
  return render(
    <MemoryRouter>
      <PhraseHistoryCard entry={entry(rewrite)} onClose={handlers.onClose ?? vi.fn()} onUpdated={vi.fn()} onDeleted={handlers.onDeleted ?? vi.fn()} tr={tr} />
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

// backend.md, «Роуты без вызова с сайта»: DELETE /api/phrase-checks/:id был,
// а кнопки не было — удалить свой разбор человек не мог.
describe('PhraseHistoryCard — удаление разбора', () => {
  it('«Удалить» → «Удалить навсегда»: DELETE по id, лист закрывается, строка уходит из списка', async () => {
    deletePhraseCheck.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderCard('бывает', { onClose, onDeleted });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }));
    expect(deletePhraseCheck).toHaveBeenCalledWith(1);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(1));
    expect(onClose).toHaveBeenCalled();
    // Правило №8: удаление видно в /stats («Удаление своих записей»).
    expect(trackEvent).toHaveBeenCalledWith('entry_deleted', { type: 'phrase_check' });
  });

  it('«Отмена» после «Удалить» ничего не удаляет', () => {
    const onDeleted = vi.fn();
    renderCard('бывает', { onDeleted });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(deletePhraseCheck).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeTruthy();
  });

  it('сбой DELETE виден строкой, разбор на месте, лист не закрывается', async () => {
    deletePhraseCheck.mockRejectedValue(new Error('500'));
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderCard('бывает', { onClose, onDeleted });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить навсегда' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Не\sудалось\sудалить\s—\sзапись\sна\sместе/);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('«я всё порчу»')).toBeTruthy();
    expect(trackEvent).not.toHaveBeenCalledWith('entry_deleted', expect.anything());
  });
});
