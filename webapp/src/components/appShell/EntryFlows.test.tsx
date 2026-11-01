// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let startParam: string | null = null;
vi.mock('../../../../shared/src/host', () => ({
  getHost: () => ({ startParam: () => startParam }),
}));
vi.mock('../../api', () => ({
  api: {
    getDisclaimer: vi.fn(), acceptDisclaimer: vi.fn(), trackEvent: vi.fn(),
    joinPair: vi.fn(), joinTherapy: vi.fn(), getTherapyRelation: vi.fn(), previewTherapyInvite: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('../../utils/addressForm', () => ({ useTr: () => (ty: string) => ty }));
vi.mock('../../utils/therapistContact', () => ({ cacheTherapistContact: vi.fn() }));
import { api } from '../../api';
import { cacheTherapistContact } from '../../utils/therapistContact';
import { EntryFlows } from './EntryFlows';

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function setup() {
  const ov = { setTrackerNeedId: vi.fn(), setShowTrackerOverlay: vi.fn() };
  render(
    <MemoryRouter initialEntries={['/today?startapp=x']}>
      <EntryFlows ov={ov as never} />
    </MemoryRouter>,
  );
  return ov;
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
