// Привязка аккаунта мессенджера к существующему (`intent: 'link'`).
//
// Перенесено с device-link.service.spec.ts — механизм тот же, изменилось имя.
// Главное, что держится тестами: порядок в approve (хозяин строки меняется ДО
// merge, иначе merge унесёт её вместе с исчезающим аккаунтом и забирать сессию
// будет неоткуда, хотя данные уже переехали).
import { BadRequestException } from '@nestjs/common';
import {
  makeDeps,
  startLink,
  startLogin,
  MAX_USER,
  WEB_USER,
} from './login-ticket.harness.spec';

describe('preview — что человек видит до подтверждения', () => {
  it('показывает имя из мессенджера и сводку переезжающих данных', async () => {
    const { links, tickets } = makeDeps();
    const { userCode } = await startLink(tickets);

    expect(await links.preview(userCode, WEB_USER)).toEqual({
      provider: 'max',
      displayName: 'Гриша',
      sameAccount: false,
      summary: { Rating: 12 },
    });
  });

  it('подтверждающий вошёл под тем же аккаунтом — переносить нечего', async () => {
    const { links, tickets } = makeDeps();
    const { userCode } = await startLink(tickets);

    const preview = await links.preview(userCode, MAX_USER);
    expect(preview.sameAccount).toBe(true);
    expect(preview.summary).toEqual({});
  });

  it('чужой код → отказ, ничего не подсказывая', async () => {
    const { links, tickets } = makeDeps();
    await startLink(tickets);
    await expect(links.preview('ZZZZZZZZ', WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('код просрочен → отказ', async () => {
    const { links, tickets, rows } = makeDeps();
    const { userCode } = await startLink(tickets);
    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(links.preview(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('approve — подтверждение привязки', () => {
  it('хозяин строки меняется ДО merge, иначе забирать сессию будет неоткуда', async () => {
    const { links, tickets, rows, merge } = makeDeps();
    const { userCode } = await startLink(tickets);

    let ownerAtMergeTime: bigint | null = null;
    (merge.merge as jest.Mock).mockImplementation(() => {
      ownerAtMergeTime = rows[0].userId;
      return Promise.resolve(undefined);
    });

    await links.approve(userCode, WEB_USER);
    expect(ownerAtMergeTime).toBe(WEB_USER);
  });

  it('привязывает провайдера мессенджера к целевому аккаунту и пишет аудит', async () => {
    const { links, tickets, auth, merge, securityLog } = makeDeps();
    const { userCode } = await startLink(tickets);

    expect(await links.approve(userCode, WEB_USER, '9.9.9.9')).toEqual({
      merged: true,
    });
    expect(merge.merge).toHaveBeenCalledWith(MAX_USER, WEB_USER);
    expect(auth.linkProviderToUser).toHaveBeenCalledWith(
      WEB_USER,
      'max',
      '777',
    );
    expect(securityLog.log).toHaveBeenCalledWith('merge_confirmed', {
      target: WEB_USER,
      source: MAX_USER,
      provider: 'max',
      ip: '9.9.9.9',
    });
  });

  it('тот же аккаунт — merge не запускается', async () => {
    const { links, tickets, merge } = makeDeps();
    const { userCode } = await startLink(tickets);

    expect(await links.approve(userCode, MAX_USER)).toEqual({ merged: false });
    expect(merge.merge).not.toHaveBeenCalled();
  });

  it('merge упал — билет уничтожен, повторно подтвердить нечего', async () => {
    const { links, tickets, rows, merge } = makeDeps();
    const { userCode } = await startLink(tickets);
    (merge.merge as jest.Mock).mockRejectedValue(new Error('таймаут'));

    await expect(links.approve(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
    expect(rows).toHaveLength(0);
  });

  it('второе подтверждение того же кода — отказ', async () => {
    const { links, tickets } = makeDeps();
    const { userCode } = await startLink(tickets);

    await links.approve(userCode, WEB_USER);
    await expect(links.approve(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('билетом ВХОДА привязку не подтвердить — намерения не подменяются', async () => {
    const { links, tickets } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await expect(links.approve(userCode, WEB_USER)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('связка привязки целиком', () => {
  it('начал в мини-аппе → подтвердил в браузере → забрал сессию ЦЕЛЕВОГО аккаунта', async () => {
    const { links, tickets, auth } = makeDeps();
    const { deviceCode, userCode } = await startLink(tickets);

    await links.approve(userCode, WEB_USER);
    const result = await tickets.poll(deviceCode);

    expect(result.status).toBe('linked');
    expect(auth.issueTokens).toHaveBeenCalledWith(
      WEB_USER,
      undefined,
      undefined,
    );
  });
});
