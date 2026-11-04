// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let startParam: string | null = null;
vi.mock('../../../../shared/src/host', () => ({
  getHost: () => ({ startParam: () => startParam }),
}));
vi.mock('../../api', () => ({
  api: {
    getDisclaimer: vi.fn(), acceptDisclaimer: vi.fn(), trackEvent: vi.fn(),
    joinPair: vi.fn(), joinTherapy: vi.fn(), getTherapyRelation: vi.fn(), previewTherapyInvite: vi.fn(),
    getSettings: vi.fn(), updateSettings: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('../../utils/addressForm', () => ({ useTr: () => (ty: string) => ty, useSetAddressForm: () => vi.fn() }));
vi.mock('../../utils/therapistContact', () => ({ cacheTherapistContact: vi.fn() }));
import { api, reportClientError } from '../../api';
import { cacheTherapistContact } from '../../utils/therapistContact';
import { EntryFlows } from './EntryFlows';

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function setup(onDone = vi.fn()) {
  const ov = { setTrackerNeedId: vi.fn(), setShowTrackerOverlay: vi.fn() };
  render(
    <MemoryRouter initialEntries={['/today?startapp=x']}>
      <EntryFlows ov={ov as never} onDone={onDone} />
    </MemoryRouter>,
  );
  return Object.assign(ov, { onDone });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  startParam = null;
  m.getDisclaimer.mockResolvedValue({ accepted: true });
  m.acceptDisclaimer.mockResolvedValue(undefined);
  m.joinTherapy.mockResolvedValue(undefined);
  m.getTherapyRelation.mockResolvedValue({ partnerId: '7', partnerName: 'Т' });
  m.previewTherapyInvite.mockResolvedValue({ therapistName: 'Анна' });
  m.getSettings.mockResolvedValue({ addressForm: 'ty' });
  m.updateSettings.mockResolvedValue({});
});
afterEach(cleanup);

describe('EntryFlows', () => {
  it('therapy_ из ссылки: экран согласия, вызова нет до кнопки; после — joinTherapy и обновление связи', async () => {
    startParam = 'therapy_ABC';
    setup();
    await screen.findByText('Открыть доступ терапевту?');
    expect(m.joinTherapy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Присоединиться'));
    await waitFor(() => expect(m.joinTherapy).toHaveBeenCalledWith('ABC'));
    await waitFor(() => expect(cacheTherapistContact).toHaveBeenCalledTimes(1));
    // Инцидент 2026-10-26: окно молча закрывалось — теперь «Доступ открыт»
    // с именем терапевта, закрывается по «Понятно».
    expect(await screen.findByText(/Терапевт Анна видит/)).toBeTruthy();
    fireEvent.click(screen.getByText('Понятно'));
    await waitFor(() => expect(screen.queryByText('Доступ открыт')).toBeNull());
  });

  it('tracker открывает трекер', async () => {
    startParam = 'tracker';
    const ov = setup();
    await waitFor(() => expect(ov.setShowTrackerOverlay).toHaveBeenCalledWith(true));
  });

  it('ссылка ждёт согласий: пока экран согласий открыт, присоединения нет', async () => {
    startParam = 'pair_Z';
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    setup();
    // Экран согласий открывается приветствием: ссылка ждёт и на нём.
    await screen.findByText('БЕТА-ВЕРСИЯ');
    expect(screen.queryByText('Присоединиться к паре?')).toBeNull();
    expect(m.joinPair).not.toHaveBeenCalled();
  });
});

// QA 2026-11: вопрос «Как удобнее общаться?» открывался под согласиями, потом —
// после них, и согласия звучали на «ты» до выбора формы (A-З7). Теперь очередь как
// в мини-аппе: вопрос → согласия → ссылка-приглашение → конец очереди (onDone).
describe('EntryFlows — очередь: вопрос «ты/вы» первым, один слой за раз', () => {
  const PICKER = 'Как удобнее общаться?';
  // Вопрос открыт и его запись в истории легла (useHistorySheet пушит в эффекте).
  async function pickerShown() {
    expect(await screen.findByText(PICKER)).toBeTruthy();
    await act(async () => {});
  }

  it('вопрос «ты/вы» до согласий: пока он открыт, согласий нет; после ответа — согласия', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    m.getSettings.mockResolvedValue({ addressForm: null });
    const ov = setup();
    await pickerShown();
    expect(screen.queryByText('БЕТА-ВЕРСИЯ')).toBeNull();

    fireEvent.click(screen.getByText('На «вы»'));
    expect(await screen.findByText('БЕТА-ВЕРСИЯ')).toBeTruthy();
    expect(screen.queryByText(PICKER)).toBeNull();
    expect(m.updateSettings).toHaveBeenCalledWith({ addressForm: 'vy' });
    expect(ov.onDone).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Далее'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Далее'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Начать'));
    await waitFor(() => expect(ov.onDone).toHaveBeenCalledWith(true));
    expect(screen.queryByText('Важно знать')).toBeNull();
  });

  it('«Позже» тоже пропускает к согласиям', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    m.getSettings.mockResolvedValue({ addressForm: null });
    setup();
    await pickerShown();
    fireEvent.click(screen.getByText('Позже'));
    expect(await screen.findByText('БЕТА-ВЕРСИЯ')).toBeTruthy();
  });

  it('настройки не загрузились — вопрос не запирает вход: сразу согласия, сбой в отчёт', async () => {
    m.getDisclaimer.mockResolvedValue({ accepted: false });
    m.getSettings.mockRejectedValue(new Error('offline'));
    setup();
    expect(await screen.findByText('БЕТА-ВЕРСИЯ')).toBeTruthy();
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('address picker') }));
  });

  it('ссылка-приглашение ждёт вопроса и согласий; конец очереди — только после неё', async () => {
    startParam = 'pair_Z';
    m.getSettings.mockResolvedValue({ addressForm: null });
    const ov = setup();
    await pickerShown();
    expect(screen.queryByText('Присоединиться к паре?')).toBeNull();
    fireEvent.click(screen.getByText('Позже'));
    expect(await screen.findByText('Присоединиться к паре?')).toBeTruthy();
    expect(ov.onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Не сейчас'));
    await waitFor(() => expect(ov.onDone).toHaveBeenCalledWith(true));
  });

  it('спрашивать нечего (форма выбрана, согласия есть, ссылки нет) — конец очереди сразу, слоёв нет', async () => {
    const ov = setup();
    await waitFor(() => expect(ov.onDone).toHaveBeenCalledWith(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
