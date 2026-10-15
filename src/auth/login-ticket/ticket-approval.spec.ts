// Повторное «Это я» по одному билету — общий контракт входа и привязки
// (аудит 2026-10, backend#22). Параметризовано по намерению: механика одна,
// и обе копии обязаны вести себя одинаково — раньше идемпотентность была
// только у входа, у привязки второй тап падал, а тап после опроса падал у обоих.
//
// Проверяется на настоящих сервисах поверх поддельной Prisma из штатной
// оснастки. Атомарность захвата на живой базе — test/login-ticket.e2e-spec.ts.
import { Logger } from '@nestjs/common';
import {
  makeDeps,
  startLink,
  startLogin,
  TG_USER,
  WEB_USER,
} from './login-ticket.harness.spec';

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

type Deps = ReturnType<typeof makeDeps>;
const STRANGER = 777n;

const INTENTS = [
  {
    intent: 'login',
    start: (d: Deps) => startLogin(d.tickets),
    approve: (d: Deps, code: string, who: bigint, via?: bigint) =>
      d.tickets.approveLogin(code, who, via),
  },
  {
    intent: 'link',
    start: (d: Deps) => startLink(d.tickets),
    approve: (d: Deps, code: string, who: bigint, via?: bigint) =>
      d.links.approve(code, who, undefined, via),
  },
] as const;

/** Что считается «сделано один раз» для каждого намерения. */
function doneTimes(d: Deps, intent: 'login' | 'link'): number {
  return intent === 'link'
    ? (d.merge.merge as jest.Mock).mock.calls.length
    : (d.report.step as jest.Mock).mock.calls.filter(
        ([step]) => step === 'confirmed',
      ).length;
}

describe.each(INTENTS)('повторное подтверждение: $intent', (c) => {
  it('тем же человеком до опроса — не ошибка, работа сделана ровно раз', async () => {
    const d = makeDeps();
    const { userCode } = await c.start(d);

    await c.approve(d, userCode, WEB_USER);
    await expect(c.approve(d, userCode, WEB_USER)).resolves.not.toThrow();

    expect(doneTimes(d, c.intent)).toBe(1);
    expect(d.rows[0].approvedUserId).toBe(WEB_USER);
  });

  it('чужим человеком — по-прежнему отказ, билет остаётся за первым', async () => {
    const d = makeDeps();
    const { userCode } = await c.start(d);
    await c.approve(d, userCode, WEB_USER);

    await expect(c.approve(d, userCode, STRANGER)).rejects.toThrow(
      'Код уже подтверждён',
    );
    expect(d.rows[0].approvedUserId).toBe(WEB_USER);
  });

  it('после того как приложение забрало сессию — тоже не ошибка', async () => {
    const d = makeDeps();
    const { userCode, deviceCode } = await c.start(d);
    await c.approve(d, userCode, WEB_USER);
    expect((await d.tickets.poll(deviceCode)).status).toBe('linked');

    await expect(c.approve(d, userCode, WEB_USER)).resolves.not.toThrow();
    expect(doneTimes(d, c.intent)).toBe(1);
  });

  it('после опроса чужому — «не найден»: повтор не оракул «код подтверждали»', async () => {
    const d = makeDeps();
    const { userCode, deviceCode } = await c.start(d);
    await c.approve(d, userCode, WEB_USER);
    await d.tickets.poll(deviceCode);

    await expect(c.approve(d, userCode, STRANGER)).rejects.toThrow(
      'Код не найден или истёк',
    );
  });

  it('после опроса: карточку показывали ему — ок, другому нажавшему — «не найден»', async () => {
    const d = makeDeps();
    const { userCode, deviceCode } = await c.start(d);
    expect(await d.tickets.forConfirm(userCode, TG_USER)).not.toBeNull();
    await c.approve(d, userCode, WEB_USER, TG_USER);
    await d.tickets.poll(deviceCode);

    await expect(
      c.approve(d, userCode, WEB_USER, TG_USER),
    ).resolves.not.toThrow();
    await expect(c.approve(d, userCode, WEB_USER, 43n)).rejects.toThrow(
      'Код не найден или истёк',
    );
  });

  it('после опроса, когда билет протух, — «не найден»', async () => {
    const d = makeDeps();
    const { userCode, deviceCode } = await c.start(d);
    await c.approve(d, userCode, WEB_USER);
    await d.tickets.poll(deviceCode);
    d.rows[0].expiresAt = new Date(Date.now() - 1000);

    await expect(c.approve(d, userCode, WEB_USER)).rejects.toThrow(
      'Код не найден или истёк',
    );
  });

  it('билет с другим намерением повтором не считается', async () => {
    const d = makeDeps();
    const other = INTENTS.find((x) => x.intent !== c.intent)!;
    const { userCode, deviceCode } = await other.start(d);
    await other.approve(d, userCode, WEB_USER);
    await d.tickets.poll(deviceCode);

    await expect(c.approve(d, userCode, WEB_USER)).rejects.toThrow(
      'Код не найден или истёк',
    );
  });

  it('два тапа одновременно — работа сделана ровно раз, оба без ошибки', async () => {
    const d = makeDeps();
    const { userCode } = await c.start(d);

    await Promise.all([
      c.approve(d, userCode, WEB_USER),
      c.approve(d, userCode, WEB_USER),
    ]);

    expect(doneTimes(d, c.intent)).toBe(1);
    expect(d.rows[0].approvedUserId).toBe(WEB_USER);
  });
});

describe('привязка: итог для вызывающего', () => {
  it('победитель получает merged=true, проигравший — repeat без merged', async () => {
    const d = makeDeps();
    const { userCode } = await startLink(d.tickets);

    const results = await Promise.all([
      d.links.approve(userCode, WEB_USER),
      d.links.approve(userCode, WEB_USER),
    ]);

    expect(results).toContainEqual({ merged: true });
    expect(results).toContainEqual({ merged: false, repeat: true });
    expect(d.securityLog.log).toHaveBeenCalledTimes(1);
  });

  it('первое подтверждение не несёт поля repeat вовсе', async () => {
    const d = makeDeps();
    const { userCode } = await startLink(d.tickets);

    const res = await d.links.approve(userCode, WEB_USER);

    expect(res).not.toHaveProperty('repeat');
  });

  it('merge упал у победителя — проигравший параллельный тап не переносит заново', async () => {
    const d = makeDeps();
    (d.merge.merge as jest.Mock).mockRejectedValue(new Error('таймаут'));
    const { userCode } = await startLink(d.tickets);

    const settled = await Promise.allSettled([
      d.links.approve(userCode, WEB_USER),
      d.links.approve(userCode, WEB_USER),
    ]);

    expect(d.merge.merge).toHaveBeenCalledTimes(1);
    expect(settled.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(d.rows).toHaveLength(0);
  });
});
