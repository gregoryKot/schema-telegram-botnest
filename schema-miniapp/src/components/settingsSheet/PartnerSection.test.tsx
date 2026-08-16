// @vitest-environment jsdom
// PartnerSection — «партнёр» в настройках. Логика/состояние теперь общие с
// PairSheet.tsx (usePairMechanics + PairPanel, правило №11 CLAUDE.md —
// «одна механика — один компонент»): здесь проверяем только то, что
// специфично этой поверхности — заголовок секции, обёртку-карточку и
// клик по «?» (onInfo). Загрузка/создание/вступление/отвязка покрыты
// в pairSheet/usePairMechanics.test.ts и PairSheet.test.tsx (общий рендер).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { PartnerSection } from './PartnerSection';
import type { PairsData } from '../../apiTypes';

vi.mock('../../api', () => ({
  api: {
    getPair: vi.fn(),
    createPairInvite: vi.fn(),
    joinPair: vi.fn(),
    leavePair: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const EMPTY: PairsData = { partners: [], pendingCode: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPair.mockResolvedValue(EMPTY);
});
afterEach(cleanup);

describe('PartnerSection — обёртка секции', () => {
  it('показывает заголовок «ПАРТНЁР» и скелетон, пока пара не загрузилась', () => {
    mockApi.getPair.mockReturnValue(new Promise(() => {}));
    render(<PartnerSection onInfo={() => {}} />);
    expect(screen.getByText('ПАРТНЁР')).toBeTruthy();
    expect(screen.queryByText('Создать приглашение')).toBeNull();
  });

  it('после загрузки — пусто, кнопка «Создать приглашение» (общая механика)', async () => {
    render(<PartnerSection onInfo={() => {}} />);
    await screen.findByText('Создать приглашение');
  });

  it('клик по кнопке «?» зовёт onInfo', async () => {
    const onInfo = vi.fn();
    render(<PartnerSection onInfo={onInfo} />);
    await screen.findByText('Создать приглашение');
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(onInfo).toHaveBeenCalled();
  });
});

describe('PartnerSection — приглашение и вступление (та же механика, что PairSheet)', () => {
  it('создание приглашения показывает реальную ссылку', async () => {
    mockApi.createPairInvite.mockResolvedValue({
      code: 'AB12',
      url: 'https://t.me/bot?startapp=pair_AB12',
    });
    render(<PartnerSection onInfo={() => {}} />);
    await screen.findByText('Создать приглашение');
    fireEvent.click(screen.getByText('Создать приглашение'));

    await waitFor(() =>
      expect(
        screen.getByText('https://t.me/bot?startapp=pair_AB12'),
      ).toBeTruthy(),
    );
  });

  it('вступление по неверному коду показывает видимую ошибку', async () => {
    mockApi.joinPair.mockRejectedValue(new Error('not found'));
    render(<PartnerSection onInfo={() => {}} />);
    await screen.findByText('Создать приглашение');
    fireEvent.click(screen.getByText('Есть код приглашения'));

    fireEvent.change(screen.getByPlaceholderText('Код из приглашения'), {
      target: { value: 'zzzz' },
    });
    fireEvent.click(screen.getByText('Присоединиться'));

    await screen.findByText('Код не найден или уже использован');
  });
});

describe('PartnerSection — уже в паре (переиспользует PartnerCard, как PairSheet)', () => {
  it('партнёр заполнил дневник — показывает индекс дня и требует подтверждения перед выходом', async () => {
    mockApi.getPair.mockResolvedValue({
      partners: [
        {
          code: 'ABC123',
          partnerIndex: 7.4,
          partnerTodayDone: true,
          partnerName: 'Оля',
          partnerTelegramId: 1,
          partnerWeekAvgs: [],
        },
      ],
      pendingCode: null,
    });
    render(<PartnerSection onInfo={() => {}} />);
    await screen.findByText('Оля сегодня');
    expect(screen.getByText('7.4')).toBeTruthy();

    // Общий PartnerCard требует подтверждения перед отвязкой.
    fireEvent.click(screen.getByText('Выйти из пары'));
    expect(mockApi.leavePair).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Выйти'));
    await waitFor(() =>
      expect(mockApi.leavePair).toHaveBeenCalledWith('ABC123'),
    );
  });
});
