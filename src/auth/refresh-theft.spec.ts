// Юнит-тесты идемпотентности вердикта «кража» (refresh-theft.ts). Разбор
// 2026-09-03: владелец получал DM refresh_token_reuse десятки раз с одной и
// той же family — мёртвую куку (30 дней жизни) предъявляли снова и снова,
// каждый повтор доходил до revokeFamilyExcept (no-op) и снова слал DM.
import {
  createFakeTable,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import {
  shouldAlertTheft,
  revokeFamilyAndAlert,
  type TheftAlertDeps,
} from './refresh-theft';

describe('shouldAlertTheft', () => {
  it('count > 0 (реально что-то отозвали) → алертить', () => {
    expect(shouldAlertTheft(1)).toBe(true);
    expect(shouldAlertTheft(3)).toBe(true);
  });

  it('count === 0 (семья уже была мертва) → НЕ алертить, это эхо', () => {
    expect(shouldAlertTheft(0)).toBe(false);
  });
});

function makeDeps(rows: Row[]): {
  deps: TheftAlertDeps;
  onAlert: jest.Mock;
  onEcho: jest.Mock;
} {
  const webSession = createFakeTable(rows);
  const prisma = { webSession } as unknown as TheftAlertDeps['prisma'];
  const onAlert = jest.fn();
  const onEcho = jest.fn();
  return { deps: { prisma, onAlert, onEcho }, onAlert, onEcho };
}

const liveRow = (over: Partial<Row> = {}): Row => ({
  id: 'sess-1',
  tokenHash: 'h1',
  userId: 7n,
  family: 'fam-1',
  revokedAt: null,
  ...over,
});

describe('revokeFamilyAndAlert', () => {
  it('первая кража (family ещё жива) → отзывает строки и будит админа', async () => {
    const rows = [liveRow(), liveRow({ id: 'sess-2', tokenHash: 'h2' })];
    const { deps, onAlert, onEcho } = makeDeps(rows);

    await revokeFamilyAndAlert(deps, 'fam-1', 7n);

    expect(rows.every((r) => r.revokedAt instanceof Date)).toBe(true);
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert).toHaveBeenCalledWith(7n, 'fam-1');
    expect(onEcho).not.toHaveBeenCalled();
  });

  it('семья уже мертва (count === 0) → НЕ будит админа, только эхо-warn', async () => {
    const rows = [liveRow({ revokedAt: new Date() })]; // уже отозвана раньше
    const { deps, onAlert, onEcho } = makeDeps(rows);

    await revokeFamilyAndAlert(deps, 'fam-1', 7n);

    expect(onAlert).not.toHaveBeenCalled();
    expect(onEcho).toHaveBeenCalledTimes(1);
    expect(onEcho.mock.calls[0][0]).toEqual(expect.any(String));
  });

  it('exceptHash исключает наследника из отзыва (та же семантика, что старый revokeFamilyExcept)', async () => {
    const rows = [liveRow(), liveRow({ id: 'sess-2', tokenHash: 'keep-me' })];
    const { deps } = makeDeps(rows);

    await revokeFamilyAndAlert(deps, 'fam-1', 7n, 'keep-me');

    expect(rows.find((r) => r.tokenHash === 'h1')!.revokedAt).toBeInstanceOf(
      Date,
    );
    expect(rows.find((r) => r.tokenHash === 'keep-me')!.revokedAt).toBeNull();
  });
});
