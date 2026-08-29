// Билет входа: вход в контейнер, у которого своей банки кук ещё нет.
//
// Главное, что держится тестами:
//   1. связка целиком — контейнер выписал билет, подтвердил КТО-ТО ДРУГОЙ
//      (бот, внешний браузер), сессию забрал исходный контейнер. Это и есть
//      суть механизма: писать и читать в разных местах — там и живут баги
//      (правило про read-after-write);
//   2. одноразовость — второй опрос второй сессии не даёт;
//   3. отказ («это не я») отличим от истечения — экран обязан сказать разное.
import { BadRequestException } from '@nestjs/common';
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
    const { userCode } = await startLogin(tickets);

    const card = await tickets.forConfirm(userCode);
    expect(card).toEqual({
      userCode,
      intent: 'login',
      deviceLabel: 'iPhone · Safari',
      hostId: 'web',
    });
  });

  it('код набран строчными и с пробелами — принимается', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
    expect(
      await tickets.forConfirm(`  ${userCode.toLowerCase()} `),
    ).not.toBeNull();
  });

  it('чужой код — null, ничего не подсказывая о том, чего нет', async () => {
    const { tickets } = makeDeps();
    await startLogin(tickets);
    expect(await tickets.forConfirm('ZZZZZZZZ')).toBeNull();
  });

  it('просроченный билет не показывается', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLogin(tickets);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    expect(await tickets.forConfirm(userCode)).toBeNull();
  });

  it('уже отклонённый билет не показывается второй раз', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
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

  it('второе подтверждение того же билета — отказ', async () => {
    const { tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, TG_USER);
    await expect(tickets.approveLogin(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
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
