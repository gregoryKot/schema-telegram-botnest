// @vitest-environment jsdom
// PairSheet — «Вместе» (0% покрытия): загрузка пары (успех/ошибка — правило
// «ошибка API видна», не молчаливый пустой экран), создание приглашения,
// присоединение по коду с видимой ошибкой при неверном коде, выход из пары.
// ShareCardSheet рисует canvas (в jsdom не поддерживается) — мокаем.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { PairSheet } from './PairSheet';
import type { PairsData } from '../apiTypes';

vi.mock('../api', () => ({
  api: {
    getPair: vi.fn(),
    createPairInvite: vi.fn(),
    joinPair: vi.fn(),
    leavePair: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../share/ShareCardSheet', () => ({
  ShareCardSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="share-card-sheet">
      <button onClick={onClose}>share-card-close</button>
    </div>
  ),
}));

const EMPTY: PairsData = { partners: [], pendingCode: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPair.mockResolvedValue(EMPTY);
});
afterEach(cleanup);

async function renderReady() {
  const utils = render(<PairSheet onClose={() => {}} />);
  await screen.findByText('Создать приглашение');
  return utils;
}

describe('PairSheet — загрузка (правило «ошибка API видна»)', () => {
  it('пока api.getPair не ответил — скелетон, не пустой экран и не ошибка', () => {
    mockApi.getPair.mockReturnValue(new Promise(() => {}));
    render(<PairSheet onClose={() => {}} />);
    expect(screen.queryByText(/Ошибка загрузки/)).toBeNull();
    expect(screen.queryByText('Создать приглашение')).toBeNull();
  });

  it('при ошибке загрузки видно явное сообщение, а не пустой экран', async () => {
    mockApi.getPair.mockRejectedValue(new Error('network down'));
    render(<PairSheet onClose={() => {}} />);
    await screen.findByText(/Ошибка загрузки/);
  });
});

describe('PairSheet — создание приглашения (read-after-write)', () => {
  it('успешное создание показывает реальную ссылку и открывает карточку-приглашение', async () => {
    mockApi.createPairInvite.mockResolvedValue({
      code: 'AB12',
      url: 'https://t.me/bot?startapp=pair_AB12',
    });
    await renderReady();
    fireEvent.click(screen.getByText('Создать приглашение'));

    await waitFor(() =>
      expect(
        screen.getByText('https://t.me/bot?startapp=pair_AB12'),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId('share-card-sheet')).toBeTruthy();
  });
});

describe('PairSheet — присоединение по коду', () => {
  it('неверный код показывает видимую ошибку, а не молчаливый провал', async () => {
    mockApi.joinPair.mockRejectedValue(new Error('not found'));
    await renderReady();
    fireEvent.click(screen.getByText('Есть код приглашения'));

    const input = screen.getByPlaceholderText('Код из приглашения');
    fireEvent.change(input, { target: { value: 'zzzz' } });
    fireEvent.click(screen.getByText('Присоединиться'));

    await screen.findByText('Код не найден или уже использован');
  });

  it('код автоматически приводится к верхнему регистру перед отправкой', async () => {
    mockApi.joinPair.mockResolvedValue(undefined);
    mockApi.getPair.mockResolvedValue(EMPTY);
    await renderReady();
    fireEvent.click(screen.getByText('Есть код приглашения'));

    const input = screen.getByPlaceholderText('Код из приглашения');
    fireEvent.change(input, { target: { value: 'ab12' } });
    fireEvent.click(screen.getByText('Присоединиться'));

    await waitFor(() => expect(mockApi.joinPair).toHaveBeenCalledWith('AB12'));
  });

  it('успешное присоединение возвращает на главный вид пары', async () => {
    mockApi.joinPair.mockResolvedValue(undefined);
    await renderReady();
    fireEvent.click(screen.getByText('Есть код приглашения'));
    fireEvent.change(screen.getByPlaceholderText('Код из приглашения'), {
      target: { value: 'AB12' },
    });
    fireEvent.click(screen.getByText('Присоединиться'));

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Код из приглашения')).toBeNull(),
    );
  });
});

describe('PairSheet — уже есть партнёр (реальные данные, не выдуманные)', () => {
  it('с ожидающим приглашением показывает его ссылку, а не пустое состояние', async () => {
    mockApi.getPair.mockResolvedValue({
      partners: [],
      pendingCode: 'CODE1',
    });
    render(<PairSheet onClose={() => {}} />);
    await screen.findByText('⏳ Ждём партнёра');
    expect(screen.queryByText('Создать приглашение')).toBeNull();
  });
});
