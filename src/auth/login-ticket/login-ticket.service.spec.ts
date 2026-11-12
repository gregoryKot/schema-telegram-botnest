// Билет входа: вход в контейнер, у которого своей банки кук ещё нет.
//
// Главное, что держится тестами:
//   1. связка целиком — контейнер выписал билет, подтвердил КТО-ТО ДРУГОЙ
//      (бот, внешний браузер), сессию забрал исходный контейнер. Это и есть
//      суть механизма: писать и читать в разных местах — там и живут баги
//      (правило про read-after-write);
//   2. одноразовость — второй опрос второй сессии не даёт;
//   3. отказ («это не я») отличим от истечения — экран обязан сказать разное.
import { BadRequestException, Logger } from '@nestjs/common';
import {
  makeDeps,
  startLogin,
  startLink,
  TG_USER,
  WEB_USER,
} from './login-ticket.harness.spec';

describe('start — контейнер просит билет', () => {
  it('выдаёт два РАЗНЫХ кода: длинный для опроса и короткий для сверки', async () => {
    const { tickets } = makeDeps();
    const a = await startLogin(tickets);

    expect(a.deviceCode).toHaveLength(64);
    expect(a.userCode).toHaveLength(8);
    expect(a.deviceCode).not.toBe(a.userCode);
    expect(a.expiresIn).toBeGreaterThan(0);
    expect(a.interval).toBeGreaterThan(0);
  });

  it('короткий код без похожих начертаний — его сверяют глазами', async () => {
    const { tickets } = makeDeps();
    for (let i = 0; i < 30; i++) {
      const { userCode } = await startLogin(tickets);
      expect(userCode).not.toMatch(/[01OIL]/);
    }
  });

  it('в БД лежат хэши, а не сами коды — строка из дампа не даёт войти', async () => {
    const { tickets, rows } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);

    const dump = JSON.stringify(rows, (_k, v) =>
      typeof v === 'bigint' ? String(v) : (v as unknown),
    );
    expect(dump).not.toContain(deviceCode);
    expect(dump).not.toContain(userCode);
  });

  it('билет входа рождается без хозяина — брать его неоткуда', async () => {
    const { tickets, rows } = makeDeps();
    await startLogin(tickets);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].intent).toBe('login');
  });

  it('прежний билет ТОГО ЖЕ аккаунта гасится — годным остаётся один', async () => {
    const { tickets, rows } = makeDeps();
    await startLink(tickets);
    await startLink(tickets);
    expect(rows).toHaveLength(1);
  });

  it('анонимные билеты входа НЕ гасят друг друга — иначе двое с разных телефонов выбивали бы друг друга', async () => {
    const { tickets, rows } = makeDeps();
    await startLogin(tickets);
    await startLogin(tickets);
    expect(rows).toHaveLength(2);
  });

  it('подпись устройства сохраняется — её показывает карточка сверки', async () => {
    const { tickets, rows } = makeDeps();
    await startLogin(tickets);
    expect(rows[0].deviceLabel).toBe('iPhone · Safari');
  });
});

describe('forConfirm — что бот покажет человеку', () => {
  it('отдаёт подпись устройства и намерение, но не хеши и не чужой userId', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLink(tickets);

    const card = await tickets.forConfirm(userCode);
    expect(card).toEqual({
      userCode,
      intent: 'link',
      deviceLabel: '',
      hostId: 'max',
    });
  });

  it('код набран строчными и с пробелами — принимается', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLink(tickets);
    expect(
      await tickets.forConfirm(`  ${userCode.toLowerCase()} `),
    ).not.toBeNull();
  });

  // Вход бот не подтверждает (site-login.ts): билет входа ему не виден, как
  // будто кода нет, и за нажавшим не закрепляется.
  it('билет ВХОДА боту не показывается и за увидевшим не закрепляется', async () => {
    const { tickets, rows, report } = makeDeps();
    const { userCode } = await startLogin(tickets);
    (report.step as jest.Mock).mockClear();
    expect(await tickets.forConfirm(userCode, TG_USER)).toBeNull();
    expect(rows[0].shownToTelegramId).toBeNull();
    expect(report.step).not.toHaveBeenCalled();
  });

  it('чужой код — null, ничего не подсказывая о том, чего нет', async () => {
    const { tickets } = makeDeps();
    await startLink(tickets);
    expect(await tickets.forConfirm('ZZZZZZZZ')).toBeNull();
  });

  it('просроченный билет не показывается', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLink(tickets);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    expect(await tickets.forConfirm(userCode)).toBeNull();
  });

  it('уже отклонённый билет не показывается второй раз', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLink(tickets);
    await tickets.deny(userCode);
    expect(await tickets.forConfirm(userCode)).toBeNull();
  });
});

describe('approveLogin — подтверждение входа', () => {
  it('билетом привязки войти нельзя — намерения не подменяются', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLink(tickets);
    await expect(tickets.approveLogin(userCode, TG_USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('подтверждение ЧУЖИМ после уже подтверждённого — отказ', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    await expect(tickets.approveLogin(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('повторный тап «это я» тем же человеком — тихо ок, без ложного провала', async () => {
    // Разбор 2026-08-31: до опроса билет ещё жив, второй тап падал в «Код уже
    // подтверждён» и бот показывал карточку провала после успеха. Теперь
    // идемпотентно: тот же хозяин подтверждает повторно без ошибки, и
    // «confirmed» не задваивается.
    const { tickets, report } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    await expect(
      tickets.approveLogin(userCode, TG_USER),
    ).resolves.toBeUndefined();
    const confirms = (report.step as jest.Mock).mock.calls.filter(
      ([s]) => s === 'confirmed',
    );
    expect(confirms).toHaveLength(1);
  });

  it('подтвердить отклонённый билет нельзя', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.deny(userCode);
    await expect(tickets.approveLogin(userCode, TG_USER)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('poll — контейнер забирает сессию', () => {
  it('до подтверждения — ждём', async () => {
    const { tickets } = makeDeps();
    const { deviceCode } = await startLogin(tickets);
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'pending' });
  });

  it('связка целиком: выписал контейнер → подтвердил бот → сессию получил КОНТЕЙНЕР', async () => {
    const { tickets, auth } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);

    await tickets.approveLogin(userCode, TG_USER);
    const result = await tickets.poll(deviceCode, '1.2.3.4', 'UA');

    expect(result).toEqual({
      status: 'linked',
      tokens: {
        accessToken: 'access-for-target',
        refreshToken: 'refresh-for-target',
        expiresIn: 900,
      },
    });
    // Сессия именно того аккаунта, который подтвердил в мессенджере.
    expect(auth.issueTokens).toHaveBeenCalledWith(TG_USER, '1.2.3.4', 'UA');
  });

  it('билет одноразовый: второй опрос второй сессии не даёт', async () => {
    const { tickets, auth } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);

    await tickets.poll(deviceCode);
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'expired' });
    expect(auth.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('короткий код в опрос не годится — опрашивают только длинным', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    expect(await tickets.poll(userCode)).toEqual({ status: 'expired' });
  });

  it('просроченный билет сессии не выдаёт, даже если подтверждён', async () => {
    const { tickets, rows } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'expired' });
  });

  it('«это не я» — отдельный исход, не молчаливое истечение', async () => {
    const { tickets, auth } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);

    await tickets.deny(userCode);

    expect(await tickets.poll(deviceCode)).toEqual({ status: 'denied' });
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });

  it('несуществующий длинный код — expired, без намёка на то, что бывает иначе', async () => {
    const { tickets } = makeDeps();
    expect(await tickets.poll('f'.repeat(64))).toEqual({ status: 'expired' });
  });
});

describe('approveLoginIfPossible — подтверждение, не роняющее чужой поток', () => {
  it('успех — true, билет подтверждён', async () => {
    const { tickets } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);

    expect(await tickets.approveLoginIfPossible(userCode, TG_USER)).toBe(true);
    expect((await tickets.poll(deviceCode)).status).toBe('linked');
  });

  it('билет истёк — false, и это НЕ роняет вход, который уже состоялся', async () => {
    const { tickets } = makeDeps();
    // OAuth-callback и второй фактор зовут это после того, как человек вошёл в
    // браузере: провал билета там не повод отдавать ему ошибку.
    await expect(
      tickets.approveLoginIfPossible('ZZZZZZZZ', TG_USER),
    ).resolves.toBe(false);
  });
});

describe('forConfirm — сбой чтения', () => {
  it('упавший запрос к БД — null, а не выброшенное исключение в чат бота', async () => {
    const { tickets, prisma } = makeDeps();
    const { userCode } = await startLogin(tickets);
    (
      prisma as unknown as {
        loginTicket: { findUnique: () => Promise<never> };
      }
    ).loginTicket.findUnique = () => Promise.reject(new Error('БД недоступна'));

    await expect(tickets.forConfirm(userCode)).resolves.toBeNull();
  });
});

// Воронка входа (правило №8: фича без события непроверяема). Тесты держат две
// вещи, на которых отчёт легко начал бы врать: считается только ВХОД — шаги
// привязки в ту же воронку не попадают; и «не успел» считается там, где он
// реально случается, — на открытии мёртвой ссылки, а не только на нажатии.
describe('события пути входа', () => {
  it('выписка билета входа — шаг «просили код» с площадкой контейнера', async () => {
    const { tickets, report } = makeDeps();
    await startLogin(tickets);
    expect(report.step).toHaveBeenCalledWith('issued', 'web');
  });

  it('привязка аккаунтов в воронку входа не попадает', async () => {
    // Иначе «просили код» считало бы два разных действия, и доля успеха
    // проваливалась бы ровно тогда, когда привязкой пользуются активнее.
    const { tickets, report, rows } = makeDeps();
    const ticket = await startLink(tickets);

    expect(ticket.userCode).toHaveLength(8);
    expect(rows[0].intent).toBe('link');
    expect((report.step as jest.Mock).mock.calls).toEqual([]);
  });

  it('связка целиком: просили код → подтвердили в браузере → приложение впустило', async () => {
    const { tickets, report } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);

    await tickets.approveLogin(userCode, TG_USER);
    await tickets.poll(deviceCode);

    const steps = (report.step as jest.Mock).mock.calls.map(([s]) => s);
    expect(steps).toEqual(['issued', 'confirmed', 'taken']);
  });

  it('«это не я» пишется отказом, а не молчанием', async () => {
    const { tickets, report } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.deny(userCode);
    expect(report.step).toHaveBeenCalledWith('denied', 'web');
  });

  // Шаги «открыли в боте» и «не успели» писал только телеграм-путь входа,
  // убранный в 2026-11: новые строки не пишутся, отчёт читает историю.
  it('бот шагов воронки входа больше не пишет — ни на живом коде, ни на мёртвом', async () => {
    const { tickets, rows, report } = makeDeps();
    const { userCode } = await startLogin(tickets);
    (report.step as jest.Mock).mockClear();

    await tickets.forConfirm(userCode, TG_USER);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(tickets.forConfirm(userCode, TG_USER)).resolves.toBeNull();

    expect(report.step).not.toHaveBeenCalled();
  });

  it('несуществующий код не считается вовсе — перебор не рисует статистику', async () => {
    const { tickets, report } = makeDeps();

    await expect(tickets.forConfirm('ZZZZZZZZ')).resolves.toBeNull();
    expect((report.step as jest.Mock).mock.calls).toEqual([]);
  });

  it('повторный опрос не задваивает «впустило»', async () => {
    const { tickets, report } = makeDeps();
    const { deviceCode, userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);

    await tickets.poll(deviceCode);
    await tickets.poll(deviceCode);

    const taken = (report.step as jest.Mock).mock.calls.filter(
      ([s]) => s === 'taken',
    );
    expect(taken).toHaveLength(1);
  });

  it('ожидание сессии само по себе ничего не пишет', async () => {
    const { tickets, report } = makeDeps();
    const { deviceCode } = await startLogin(tickets);
    (report.step as jest.Mock).mockClear();

    expect((await tickets.poll(deviceCode)).status).toBe('pending');
    expect((report.step as jest.Mock).mock.calls).toEqual([]);
  });
});

// Ночной мутационный замер (stryker.golden-auth.config.json): границы срока,
// гонка одноразовости, шаги воронки только у входа и следы провалов в логе.
describe('LoginTicketService — границы под мутационным замером', () => {
  const T = new Date('2026-11-09T12:00:00.000Z');
  const steps = (report: { step: unknown }) =>
    (report.step as jest.Mock).mock.calls.map(([s]) => s as string);

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('expiresAt ровно «сейчас» — билет ещё жив во всех трёх входах (<, не <=)', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode, deviceCode } = await startLink(tickets);
    jest.useFakeTimers({ now: T, doNotFake: ['nextTick', 'queueMicrotask'] });
    rows[0].expiresAt = new Date(T);
    expect(await tickets.forConfirm(userCode)).not.toBeNull();
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'pending' });
    await tickets.deny(userCode);
    expect(rows[0].deniedAt).not.toBeNull();
  });

  it('код с пробелами и в нижнем регистре: карточка отдаёт его нормализованным', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLink(tickets);
    const card = await tickets.forConfirm(` ${userCode.toLowerCase()}  `);
    expect(card?.userCode).toBe(userCode);
    await tickets.deny(`  ${userCode.toLowerCase()} `);
    expect(rows[0].deniedAt).not.toBeNull();
  });

  it('гонка опроса: строку забрал другой опрос между чтением и claim — expired, токенов нет', async () => {
    const { tickets, prisma, auth } = makeDeps();
    const { userCode, deviceCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    jest
      .spyOn(prisma.loginTicket, 'updateMany')
      .mockResolvedValueOnce({ count: 0 });
    expect(await tickets.poll(deviceCode)).toEqual({ status: 'expired' });
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });

  it('claim гасит только свою строку — соседний билет остаётся живым', async () => {
    const { tickets, rows } = makeDeps();
    const mine = await startLogin(tickets);
    await startLogin(tickets);
    await tickets.approveLogin(mine.userCode, TG_USER);
    expect((await tickets.poll(mine.deviceCode)).status).toBe('linked');
    expect(rows[1].consumedAt).toBeNull();
  });

  it('у привязки (не входа) шагов воронки нет: ни too_late, ни bot_opened, ни denied', async () => {
    const { tickets, rows, report } = makeDeps();
    const link = await startLink(tickets);
    (report.step as jest.Mock).mockClear();
    expect(await tickets.forConfirm(link.userCode, TG_USER)).not.toBeNull();
    await tickets.deny(link.userCode, TG_USER);
    rows[0].deniedAt = null;
    rows[0].expiresAt = new Date(Date.now() - 1000);
    expect(await tickets.forConfirm(link.userCode, TG_USER)).toBeNull();
    expect(steps(report)).toEqual([]);
  });

  it('сбой чтения билета — null и error в лог с причиной', async () => {
    const { tickets, prisma } = makeDeps();
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(prisma.loginTicket, 'findUnique')
      .mockRejectedValueOnce(new Error('db down'));
    expect(await tickets.forConfirm('ABCDEFGH')).toBeNull();
    expect(error).toHaveBeenCalledWith(
      'ticket lookup failed: db down',
      expect.any(String),
    );
  });

  it('approveLoginIfPossible: провал — false и warn с причиной', async () => {
    const { tickets } = makeDeps();
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    expect(await tickets.approveLoginIfPossible('ZZZZZZZZ', TG_USER)).toBe(
      false,
    );
    expect(warn).toHaveBeenCalledWith(
      'ticket approve skipped: Код не найден или истёк',
    );
  });
});

// Запрос Роскомнадзора 2026-11: на сайт через Telegram не входят. Одобрить
// билет входа (экран сверки в браузере) может только аккаунт, у которого есть
// способ входа кроме Telegram, — иначе личность из Telegram уехала бы в браузер.
describe('approveLogin — аккаунт только с Telegram на сайт не впускает', () => {
  it('отказ: билет не подтверждён, опрос сессию не выдаёт', async () => {
    const { tickets, rows, telegramOnly, auth } = makeDeps();
    telegramOnly.add(TG_USER);
    const { userCode, deviceCode } = await startLogin(tickets);

    await expect(tickets.approveLogin(userCode, TG_USER)).rejects.toThrow(
      'Этот аккаунт открывается в Telegram',
    );
    expect(await tickets.approveLoginIfPossible(userCode, TG_USER)).toBe(false);
    expect(rows[0].approvedUserId).toBeNull();
    expect((await tickets.poll(deviceCode)).status).toBe('pending');
    expect(auth.issueTokens).not.toHaveBeenCalled();
  });

  it('контроль: тот же аккаунт с почтой или VK ID — подтверждает', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode, deviceCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    expect(rows[0].approvedUserId).toBe(TG_USER);
    expect((await tickets.poll(deviceCode)).status).toBe('linked');
  });
});
