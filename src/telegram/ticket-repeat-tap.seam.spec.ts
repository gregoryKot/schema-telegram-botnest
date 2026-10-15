// Двойной тап «Это я» на карточках бота — на шве (аудит 2026-10, backend#22).
//
// Настоящие хендлеры tglink:yes / tglogin:yes на фейковом боте + настоящие
// LoginTicketService / TicketLinkService поверх поддельной Prisma из штатной
// оснастки. Юнит с замоканным `links.approve` проверяет только то, что хендлер
// его позвал: ложная карточка «Не получилось объединить» поверх удавшегося
// слияния рождалась именно на стыке сервиса и хендлера.
import { Logger } from '@nestjs/common';
import {
  makeDeps,
  startLink,
  startLogin,
  WEB_USER,
} from '../auth/login-ticket/login-ticket.harness.spec';
import { TelegramLinkService } from './telegram.link.service';
import { TelegramLoginService } from './telegram.login.service';
import { makeFakeBot, runAction } from './telegram.test-helpers.spec';

const TG_RAW = 42; // сырой telegramId нажавшего
const FROM = { from: { id: TG_RAW, first_name: 'Т' } };
const DONE = /✅ Готово/;

function build() {
  const deps = makeDeps();
  const fakeBot = makeFakeBot();
  const botService: any = {
    getUserSettings: jest.fn().mockResolvedValue({ addressForm: 'ty' }),
  };
  // Нажавший — канонический WEB_USER: сюда достаётся сессия и данные.
  const accountService: any = {
    canonicalUserId: jest.fn(async () => WEB_USER),
    registerUser: jest.fn().mockResolvedValue(undefined),
  };
  const analytics: any = { track: jest.fn().mockResolvedValue(undefined) };
  new TelegramLinkService(
    fakeBot.bot,
    deps.tickets,
    deps.links,
    botService,
    accountService,
    deps.securityLog,
    analytics,
  ).onModuleInit();
  new TelegramLoginService(
    fakeBot.bot,
    deps.tickets,
    botService,
    accountService,
    deps.securityLog,
  ).onModuleInit();
  return { ...deps, fakeBot, analytics };
}

type Built = ReturnType<typeof build>;
const said = (ctx: any): string => ctx.editMessageText.mock.calls[0][0];
const tap = (b: Built, data: string) => runAction(b.fakeBot, data, FROM);
const trackedNames = (b: Built): string[] =>
  b.analytics.track.mock.calls.map((c: unknown[]) => c[1]);

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('tglink:yes — повторный тап', () => {
  async function shownLink(b: Built) {
    const started = await startLink(b.tickets);
    // Карточку показали этому человеку (/start link_<код>).
    expect(
      await b.tickets.forConfirm(started.userCode, BigInt(TG_RAW)),
    ).not.toBeNull();
    return started;
  }

  it('второй тап подряд: карточка остаётся «Готово», слияние и событие — по разу', async () => {
    const b = build();
    const { userCode } = await shownLink(b);

    const first = await tap(b, `tglink:yes:${userCode}`);
    const second = await tap(b, `tglink:yes:${userCode}`);

    expect(said(first)).toMatch(DONE);
    expect(said(second)).toMatch(DONE);
    expect(b.merge.merge).toHaveBeenCalledTimes(1);
    expect(trackedNames(b)).toEqual(['account_link_confirmed']);
  });

  it('тап после того, как сайт забрал сессию: не «не получилось», событие не задваивается', async () => {
    const b = build();
    const { userCode, deviceCode } = await shownLink(b);
    await tap(b, `tglink:yes:${userCode}`);
    expect((await b.tickets.poll(deviceCode)).status).toBe('linked');

    const late = await tap(b, `tglink:yes:${userCode}`);

    expect(said(late)).toMatch(DONE);
    expect(b.merge.merge).toHaveBeenCalledTimes(1);
    expect(trackedNames(b)).toEqual(['account_link_confirmed']);
  });

  it('два тапа из одной пачки обновлений: слияние один раз, оба тапа без провала', async () => {
    const b = build();
    const { userCode } = await shownLink(b);

    const [c1, c2] = await Promise.all([
      tap(b, `tglink:yes:${userCode}`),
      tap(b, `tglink:yes:${userCode}`),
    ]);

    expect(said(c1)).toMatch(DONE);
    expect(said(c2)).toMatch(DONE);
    expect(b.merge.merge).toHaveBeenCalledTimes(1);
    expect(trackedNames(b)).toEqual(['account_link_confirmed']);
  });

  it('настоящий провал (код протух) по-прежнему «Не получилось» и уходит в отчёт причиной expired', async () => {
    const b = build();
    const { userCode } = await shownLink(b);
    b.rows[0].expiresAt = new Date(Date.now() - 1000);

    const ctx = await tap(b, `tglink:yes:${userCode}`);

    expect(said(ctx)).toContain('Не получилось объединить');
    expect(b.analytics.track).toHaveBeenCalledWith(
      null,
      'account_link_failed',
      {
        host: 'web',
        reason: 'expired',
      },
    );
  });

  it('слияние упало у победителя: его карточка «Не получилось», причина error, слияние не повторялось', async () => {
    const b = build();
    (b.merge.merge as jest.Mock).mockRejectedValue(new Error('таймаут'));
    const { userCode } = await shownLink(b);

    const [c1, c2] = await Promise.all([
      tap(b, `tglink:yes:${userCode}`),
      tap(b, `tglink:yes:${userCode}`),
    ]);

    // Проигравший тап успел нарисовать «Готово», победитель перепишет карточку
    // на провал — итог в чате верный.
    expect(
      [said(c1), said(c2)].filter((x) => /Не получилось/.test(x)),
    ).toHaveLength(1);
    expect(b.merge.merge).toHaveBeenCalledTimes(1);
    expect(b.analytics.track).toHaveBeenCalledWith(
      null,
      'account_link_failed',
      {
        host: 'web',
        reason: 'error',
      },
    );
  });

  it('чужое нажатие по карточке — как и раньше провал, ничего не подтверждено', async () => {
    const b = build();
    const { userCode } = await shownLink(b);

    const ctx = await runAction(b.fakeBot, `tglink:yes:${userCode}`, {
      from: { id: 43, first_name: 'Ч' },
    });

    expect(said(ctx)).toContain('Не получилось объединить');
    expect(b.merge.merge).not.toHaveBeenCalled();
    expect(b.rows[0].approvedUserId).toBeNull();
    expect(trackedNames(b)).toEqual(['account_link_failed']);
  });
});

describe('tglogin:yes — повторный тап', () => {
  async function shownLogin(b: Built) {
    const started = await startLogin(b.tickets);
    expect(
      await b.tickets.forConfirm(started.userCode, BigInt(TG_RAW)),
    ).not.toBeNull();
    return started;
  }

  it('второй тап подряд: «Готово», воронка получает «подтвердил» один раз', async () => {
    const b = build();
    const { userCode } = await shownLogin(b);

    const first = await tap(b, `tglogin:yes:${userCode}`);
    const second = await tap(b, `tglogin:yes:${userCode}`);

    expect(said(first)).toMatch(DONE);
    expect(said(second)).toMatch(DONE);
    expect(
      (b.report.step as jest.Mock).mock.calls.filter(
        ([s]) => s === 'confirmed',
      ),
    ).toHaveLength(1);
  });

  it('тап после того, как приложение забрало сессию: «Готово», а не ложный провал', async () => {
    const b = build();
    const { userCode, deviceCode } = await shownLogin(b);
    await tap(b, `tglogin:yes:${userCode}`);
    expect((await b.tickets.poll(deviceCode)).status).toBe('linked');

    const late = await tap(b, `tglogin:yes:${userCode}`);

    expect(said(late)).toMatch(DONE);
    expect(b.auth.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('настоящий провал (код протух) по-прежнему «Не получилось подтвердить»', async () => {
    const b = build();
    const { userCode } = await shownLogin(b);
    b.rows[0].expiresAt = new Date(Date.now() - 1000);

    const ctx = await tap(b, `tglogin:yes:${userCode}`);

    expect(said(ctx)).toContain('Не получилось подтвердить');
  });
});
