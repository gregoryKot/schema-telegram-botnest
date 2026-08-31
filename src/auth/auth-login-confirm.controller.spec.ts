// Подтверждение входа по билету в браузере — с человеком в цикле.
//
// Регрессия на дыру device-code phishing (разбор 2026-08-31): раньше вход по
// билету на путях OAuth/письма сервер одобрял молча, за того, кто прошёл вход,
// — а код в `?ticket=` мог подставить кто угодно. Здесь проверяется главное
// свойство фикса: одобрить билет можно ТОЛЬКО явным авторизованным действием,
// и хозяином становится ИМЕННО та сессия, что жмёт кнопку, а не выписавший
// билет.
import { UnauthorizedException } from '@nestjs/common';
import { AuthLoginConfirmController } from './auth-login-confirm.controller';
import type { LoginTicketService } from './login-ticket/login-ticket.service';
import type { SecurityLogService } from './security-log.service';
import type { Request } from 'express';

function make(over: { approve?: boolean } = {}) {
  const tickets = {
    approveLoginIfPossible: jest.fn().mockResolvedValue(over.approve ?? true),
    deny: jest.fn().mockResolvedValue(undefined),
  };
  const securityLog = { log: jest.fn() };
  const controller = new AuthLoginConfirmController(
    tickets as unknown as LoginTicketService,
    securityLog as unknown as SecurityLogService,
  );
  return { controller, tickets, securityLog };
}

// CSRF проходит либо по x-requested-with, либо по application/json.
const req = (userId: bigint | null) =>
  ({
    headers: { 'x-requested-with': 'webapp' },
    webUser: userId === null ? undefined : { userId },
    ip: '1.2.3.4',
  }) as unknown as Request;

const reqNoCsrf = (userId: bigint) =>
  ({ headers: {}, webUser: { userId }, ip: '1.2.3.4' }) as unknown as Request;

describe('confirm-login', () => {
  it('одобряет билет ИМЕННО той сессией, что подтверждает', async () => {
    const { controller, tickets } = make();

    const out = await controller.confirmLogin({ code: 'K7M2QX94' }, req(555n));

    expect(out).toEqual({ ok: true });
    // Хозяин — вошедший (555), не тот, кто выписал билет.
    expect(tickets.approveLoginIfPossible).toHaveBeenCalledWith(
      'K7M2QX94',
      555n,
    );
  });

  it('мёртвый/чужой код — ok:false, а не 400 в браузер', async () => {
    const { controller } = make({ approve: false });
    const out = await controller.confirmLogin({ code: 'ZZZZZZZZ' }, req(555n));
    expect(out).toEqual({ ok: false });
  });

  it('без CSRF-заголовка не одобряет вовсе', async () => {
    const { controller, tickets } = make();
    await expect(
      controller.confirmLogin({ code: 'K7M2QX94' }, reqNoCsrf(555n)),
    ).rejects.toThrow(UnauthorizedException);
    expect(tickets.approveLoginIfPossible).not.toHaveBeenCalled();
  });
});

describe('deny-login', () => {
  it('гасит билет, чтобы ждущий контейнер получил отказ', async () => {
    const { controller, tickets } = make();
    const out = await controller.denyLogin({ code: 'K7M2QX94' }, req(555n));
    expect(out).toEqual({ ok: true });
    expect(tickets.deny).toHaveBeenCalledWith('K7M2QX94');
  });

  it('мёртвый код — deny бросает (Nest ответит 400), молча не глотаем', async () => {
    // Гасить уже мёртвый билет нечего; экран всё равно покажет отказ, а тихого
    // catch в контроллере не осталось (правило тихих catch).
    const { controller, tickets } = make();
    (tickets.deny as jest.Mock).mockRejectedValue(new Error('нет такого'));
    await expect(
      controller.denyLogin({ code: 'ZZZZZZZZ' }, req(555n)),
    ).rejects.toThrow('нет такого');
  });

  it('без CSRF-заголовка не гасит', async () => {
    const { controller, tickets } = make();
    await expect(
      controller.denyLogin({ code: 'K7M2QX94' }, reqNoCsrf(555n)),
    ).rejects.toThrow(UnauthorizedException);
    expect(tickets.deny).not.toHaveBeenCalled();
  });
});
