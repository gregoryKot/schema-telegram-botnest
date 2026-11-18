// @vitest-environment jsdom
// Карточка-ответ над выдачей поиска «Справочника» на настоящих текстах: вопрос о схеме показывает карточку,
// ссылка открывает лист; без распознанного листа экран прежний. События — без листа и текста запроса.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuideReference } from './GuideReference';
import { CABINET_GUIDE_ANSWER_EVENTS, CABINET_GUIDE_SHEET_EVENTS } from '../../../../shared/src/share/analytics';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';

const trackEvent = api.trackEvent as unknown as ReturnType<typeof vi.fn>;
const tracked = () => trackEvent.mock.calls.map((c) => c[0]);

beforeEach(() => vi.clearAllMocks());

async function ask(query: string) {
  render(<MemoryRouter><GuideReference onRetry={() => {}} /></MemoryRouter>);
  fireEvent.change(await screen.findByRole('searchbox', {}, { timeout: 5000 }), { target: { value: query } });
}
const card = () => screen.queryByRole('region', { name: 'Ответ из справочника' });

describe('GuideAnswerCard', () => {
  it('«как работать со схемой покинутости» — карточка схемы с текстом про работу, ниже обычная выдача', async () => {
    await ask('как работать со схемой покинутости');
    const answer = within(card()!);
    expect(answer.getByRole('heading', { name: 'Покинутость / Нестабильность' })).toBeTruthy();
    expect(answer.getByText(/как работать/)).toBeTruthy();
    expect(answer.getByRole('button', { name: 'Открыть лист схемы' })).toBeTruthy();
    expect(within(answer.getByRole('group', { name: 'Связанные техники' })).getAllByRole('button').length).toBeGreaterThan(0);
    expect(within(answer.getByRole('group', { name: 'Связанные режимы' })).getAllByRole('button').length).toBeGreaterThan(0);
    // выдача под карточкой — та же строка схемы в списке
    expect(screen.getAllByRole('button', { name: /Покинутость \/ Нестабильность/ }).length).toBeGreaterThan(0);
    await waitFor(() => expect(tracked()).toContain(CABINET_GUIDE_ANSWER_EVENTS.show), { timeout: 3000 });
    expect(trackEvent.mock.calls.every((c) => c.length === 1)).toBe(true); // без меты: ни листа, ни запроса
  });

  it('ссылка на связанную технику открывает её лист и шлёт событие перехода', async () => {
    await ask('как работать со схемой покинутости');
    const links = within(card()!).getByRole('group', { name: 'Связанные техники' });
    fireEvent.click(within(links).getByRole('button', { name: 'Работа со стульями' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(tracked()).toEqual(expect.arrayContaining([CABINET_GUIDE_ANSWER_EVENTS.link, CABINET_GUIDE_SHEET_EVENTS.technique]));
  });

  it('«Открыть лист схемы» открывает лист самой схемы', async () => {
    await ask('покинутость');
    expect(within(card()!).getByText(/суть/)).toBeTruthy();
    fireEvent.click(within(card()!).getByRole('button', { name: 'Открыть лист схемы' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(tracked()).toEqual(expect.arrayContaining([CABINET_GUIDE_ANSWER_EVENTS.link, CABINET_GUIDE_SHEET_EVENTS.schema]));
  });

  it('лист не распознан или у названий ничья — карточки нет, выдача как раньше', async () => {
    await ask('ребёнок');
    expect(card()).toBeNull();
    expect(screen.getAllByRole('button', { name: /Ребёнок/ }).length).toBeGreaterThan(1);
    expect(tracked()).not.toContain(CABINET_GUIDE_ANSWER_EVENTS.show);
  });
});
