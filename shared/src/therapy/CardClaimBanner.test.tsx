// @vitest-environment jsdom
// Сверка «Это тот же человек?» в кабинете (аудит 2026-11, S8): аккаунт,
// которому попал код офлайн-карточки, получает её записи только после «Да».
// Плашка обязана назвать обе стороны, объяснить последствия обеих кнопок и
// убрать себя после ответа; сбой — строка ошибки, а не тишина.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  renderHook,
  act,
  waitFor,
} from '@testing-library/react';
import { CardClaimBanner, cardClaimQuestion } from './CardClaimBanner';
import {
  afterResolve,
  useCardClaims,
  type CardClaim,
  type CardClaimsApi,
} from './cardClaims';

afterEach(() => cleanup());

const boris: CardClaim = {
  clientId: 4410000000003,
  clientName: 'Борис',
  cardId: 9,
  cardName: 'Мария К.',
};
const vera: CardClaim = { ...boris, clientId: 77, clientName: 'Вера' };
const other: CardClaim = { ...boris, cardId: 10, cardName: 'Пётр' };

function makeApi(list: CardClaim[] = [boris]) {
  return {
    getCardClaims: vi.fn().mockResolvedValue(list),
    resolveCardClaim: vi.fn().mockResolvedValue(undefined),
  } satisfies CardClaimsApi;
}

function Harness({
  api,
  onMerged,
}: {
  api: CardClaimsApi;
  onMerged?: () => void;
}) {
  const claims = useCardClaims(api, onMerged);
  return <CardClaimBanner claims={claims} />;
}

describe('cardClaimQuestion', () => {
  it('обе стороны по имени, без рода читателя', () => {
    expect(cardClaimQuestion(boris)).toBe(
      'Код приглашения для карточки «Мария К.» использовал аккаунт «Борис». Это тот же человек?',
    );
  });

  it('пропавшее имя — словами, без «null»', () => {
    const q = cardClaimQuestion({ ...boris, clientName: null, cardName: null });
    expect(q).toBe(
      'Код приглашения для офлайн-карточки использовал аккаунт без имени. Это тот же человек?',
    );
  });
});

describe('afterResolve', () => {
  it('«Нет» убирает только отвеченную плашку', () => {
    expect(afterResolve([boris, vera, other], boris, false)).toEqual([
      vera,
      other,
    ]);
  });

  it('«Да» убирает все плашки этой карточки: её больше нет', () => {
    expect(afterResolve([boris, vera, other], boris, true)).toEqual([other]);
  });

  it('id аккаунта числом и строкой — одна плашка', () => {
    const asString = { ...boris, clientId: String(boris.clientId) };
    expect(afterResolve([asString], boris, false)).toEqual([]);
  });
});

describe('CardClaimBanner', () => {
  it('сверок нет или грузится — блока нет', async () => {
    const api = makeApi([]);
    const { container } = render(<Harness api={api} />);
    expect(container.textContent).toBe('');
    await waitFor(() => expect(api.getCardClaims).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('плашка: вопрос, последствия обеих кнопок, две кнопки', async () => {
    render(<Harness api={makeApi()} />);
    expect(await screen.findByText(cardClaimQuestion(boris))).toBeTruthy();
    expect(
      screen.getByText(/записи карточки этому аккаунту не видны/),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Да, объединить' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Нет' })).toBeTruthy();
  });

  it('«Да» → ответ с id аккаунта и карточки, плашка уходит, список клиентов перечитан', async () => {
    const api = makeApi();
    const onMerged = vi.fn();
    render(<Harness api={api} onMerged={onMerged} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Да, объединить' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Нет' })).toBeNull(),
    );
    expect(api.resolveCardClaim).toHaveBeenCalledWith(boris.clientId, 9, true);
    expect(onMerged).toHaveBeenCalledTimes(1);
  });

  it('«Нет» → карточка не сливается, список клиентов не трогаем', async () => {
    const api = makeApi();
    const onMerged = vi.fn();
    render(<Harness api={api} onMerged={onMerged} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Нет' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Нет' })).toBeNull(),
    );
    expect(api.resolveCardClaim).toHaveBeenCalledWith(boris.clientId, 9, false);
    expect(onMerged).not.toHaveBeenCalled();
  });

  it('ответ не прошёл — ошибка у плашки, список перечитан', async () => {
    const api = makeApi();
    api.resolveCardClaim.mockRejectedValue(new Error('500'));
    render(<Harness api={api} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Да, объединить' }),
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Не удалось сохранить ответ/,
    );
    expect(api.getCardClaims).toHaveBeenCalledTimes(2);
  });

  it('сбой загрузки — ошибка, а не тишина', async () => {
    const api = makeApi();
    api.getCardClaims.mockRejectedValue(new Error('offline'));
    render(<Harness api={api} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Не удалось проверить, кто ввёл коды/,
    );
  });

  it('пока ответ в пути, кнопки неактивны (двойной тап не шлёт два ответа)', async () => {
    let finish: () => void = () => undefined;
    const api = makeApi();
    api.resolveCardClaim.mockImplementation(
      () => new Promise<void>((r) => (finish = r)),
    );
    const { result } = renderHook(() => useCardClaims(api));
    await waitFor(() => expect(result.current.claims).toEqual([boris]));
    act(() => void result.current.resolve(boris, true));
    expect(result.current.busy).toBe(`${boris.clientId}:9`);
    await act(async () => finish());
    expect(result.current.busy).toBeNull();
    expect(result.current.claims).toEqual([]);
  });
});
