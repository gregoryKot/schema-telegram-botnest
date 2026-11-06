// @vitest-environment jsdom
// «Схема случая» у клиента: строка в карточке «Терапевт» видна, только когда терапевт
// показал схему (relation.conceptSharedAt); лист рисует схему только для чтения (та же
// диаграмма, что у терапевта) с первой строкой «откуда и зачем»; терапевт успел
// выключить показ (404) — спокойная строка, а не падение; сбой сети — отчёт наверх.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TherapyRelationInfo } from '../../api';

const { getMyConcept, trackEvent, reportClientError, FakeApiError } = vi.hoisted(() => {
  class FakeApiError extends Error {
    constructor(readonly status: number) {
      super(`HTTP ${status}`);
    }
  }
  return { getMyConcept: vi.fn(), trackEvent: vi.fn(), reportClientError: vi.fn(), FakeApiError };
});
vi.mock('../../api', () => ({
  api: { getMyConcept, trackEvent, getFormerTherapist: vi.fn() },
  ApiError: FakeApiError,
  reportClientError,
}));

import { TherapistCard } from './TherapistCard';
import { CLIENT_CONCEPT_OPENED_EVENT } from '../../../../shared/src/share/analytics';
import { myConceptDates } from './myConceptModel';

const relation = (conceptSharedAt: string | null): TherapyRelationInfo => ({
  role: 'client', status: 'active', partnerName: 'Мария', partnerId: 9, code: 'ABC',
  nextSession: null, conceptSharedAt,
});
const shared = {
  schemaIds: ['abandonment'],
  modeIds: ['vulnerable_child'],
  modeTransitions: 'Страх → Отстранённый Защитник',
  modeLinks: [{ modeId: 'vulnerable_child', alias: 'Маленькая Аня', schemaIds: ['abandonment'], needIds: [], manifest: 'Страшно остаться одной' }],
  schemaLinks: [{ schemaId: 'abandonment', belief: 'Меня бросят', needIds: ['attachment'] }],
  sharedWithClientAt: '2026-11-06T10:00:00.000Z',
  updatedAt: '2026-11-07T10:00:00.000Z',
};

const mount = (r: TherapyRelationInfo) => render(<MemoryRouter><TherapistCard relation={r} /></MemoryRouter>);
const row = () => screen.queryByRole('button', { name: /Схема случая/ });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('TherapistCard → «Схема случая»', () => {
  it('терапевт не показал схему — строки нет, запроса нет', () => {
    mount(relation(null));
    expect(screen.getByText('Мария')).toBeTruthy();
    expect(row()).toBeNull();
    expect(getMyConcept).not.toHaveBeenCalled();
  });

  it('показал — строка открывает лист: «откуда и зачем», схема только для чтения, событие открытия', async () => {
    getMyConcept.mockResolvedValue(shared);
    mount(relation(shared.sharedWithClientAt));
    fireEvent.click(row()!);
    const dialog = screen.getByRole('dialog', { name: 'Схема случая' });
    expect(dialog.textContent).toMatch(/Схема, которую ты собираешь с терапевтом/);
    expect(await screen.findByText('Маленькая Аня')).toBeTruthy();
    expect(screen.getByText('Меня бросят')).toBeTruthy();
    expect(screen.getByText(/Страх → Отстранённый Защитник/)).toBeTruthy();
    // только чтение: ни «+ режим», ни полей ввода
    expect(screen.queryByRole('button', { name: /^\+ / })).toBeNull();
    expect(dialog.querySelector('textarea, input')).toBeNull();
    expect(CLIENT_CONCEPT_OPENED_EVENT).toBe('client_concept_opened');
    expect(trackEvent).toHaveBeenCalledWith(CLIENT_CONCEPT_OPENED_EVENT);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('терапевт успел выключить показ (404) — спокойная строка, без отчёта о сбое и без события', async () => {
    getMyConcept.mockRejectedValue(new FakeApiError(404));
    mount(relation(shared.sharedWithClientAt));
    fireEvent.click(row()!);
    expect(await screen.findByText(/Терапевт сейчас её не показывает/)).toBeTruthy();
    expect(reportClientError).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('сбой сети — сообщение и отчёт наверх', async () => {
    getMyConcept.mockRejectedValue(new FakeApiError(500));
    mount(relation(shared.sharedWithClientAt));
    fireEvent.click(row()!);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ section: 'profile.myConcept' }));
  });
});

describe('myConceptDates', () => {
  it('день показа и день обновления — в зоне читателя; тот же день — без «обновлена»', () => {
    // fmtDate дописывает год, если он не текущий у смотрящего, — «сегодня» фиксируем.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T12:00:00.000Z'));
    expect(myConceptDates('2026-11-06T10:00:00.000Z', '2026-11-07T10:00:00.000Z')).toBe('Открыта с 6 ноя · обновлена 7 ноя');
    expect(myConceptDates('2026-11-06T10:00:00.000Z', '2026-11-06T12:00:00.000Z')).toBe('Открыта с 6 ноя');
    expect(myConceptDates('мусор', 'мусор')).toBe('');
    vi.useRealTimers();
  });
});
