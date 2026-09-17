// Общий хвост «это не я» для обеих карточек сверки.
import { Logger } from '@nestjs/common';
import { handleTicketDeny } from './ticket-actions';

function makeDeps() {
  const tickets = { deny: jest.fn().mockResolvedValue(undefined) } as any;
  const securityLog = { log: jest.fn() } as any;
  const logger = { error: jest.fn() } as unknown as Logger;
  return { tickets, securityLog, logger };
}

const makeCtx = () =>
  ({
    from: { id: 42 },
    editMessageText: jest.fn().mockResolvedValue(undefined),
  }) as any;

describe('handleTicketDeny', () => {
  it('гасит билет, пишет причину в аудит и отвечает человеку', async () => {
    const deps = makeDeps();
    const ctx = makeCtx();

    await handleTicketDeny(deps, ctx, 'K7M2QX94', 'user_denied', 'Отклонено');

    expect(deps.tickets.deny).toHaveBeenCalledWith('K7M2QX94');
    expect(deps.securityLog.log).toHaveBeenCalledWith('login_ticket_denied', {
      telegramId: 42,
      reason: 'user_denied',
    });
    expect(ctx.editMessageText).toHaveBeenCalledWith('Отклонено');
  });

  it('провал отказа НЕ говорит «отклонено» — иначе человек решит, что защитился', async () => {
    const deps = makeDeps();
    deps.tickets.deny.mockRejectedValue(new Error('БД легла'));
    const ctx = makeCtx();

    await handleTicketDeny(deps, ctx, 'K7M2QX94', 'user_denied', 'Отклонено');

    expect(ctx.editMessageText).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('БД легла'),
      expect.any(String),
    );
  });

  it('не роняет хендлер, если сообщение уже нельзя отредактировать', async () => {
    const deps = makeDeps();
    const ctx = makeCtx();
    ctx.editMessageText.mockRejectedValue(new Error('message is not modified'));

    await expect(
      handleTicketDeny(deps, ctx, 'K7M2QX94', 'user_denied_link', 'Отклонено'),
    ).resolves.toBeUndefined();
    expect(deps.tickets.deny).toHaveBeenCalled();
  });
});
