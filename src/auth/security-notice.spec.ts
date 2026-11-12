// Уведомление владельцу о событии безопасности (S11/S12, аудит 2026-11):
// существующими каналами — письмо (если есть вход по почте) и очередь бота
// (если есть вход через Telegram). Тексты — в обеих формах обращения, и
// сообщение бота рендерится тем же путём, что и в очереди (renderTemplate).
import { renderTemplate } from '../notification/notification.templates';
import { SecurityNoticeService } from './security-notice.service';
import { securityNoticeText } from './security-notice.texts';

function makeService(opts: {
  form?: 'ty' | 'vy' | null;
  email?: string | null;
  telegramId?: string | null;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ addressForm: opts.form }),
    },
    authProvider: {
      findMany: jest.fn(() =>
        Promise.resolve(opts.email ? [{ providerId: opts.email }] : []),
      ),
      findFirst: jest.fn(({ where }: { where: { provider: string } }) => {
        if (where.provider === 'email' && opts.email)
          return Promise.resolve({ providerId: opts.email });
        if (where.provider === 'telegram' && opts.telegramId)
          return Promise.resolve({ providerId: opts.telegramId });
        return Promise.resolve(null);
      }),
    },
  };
  const email = { send: jest.fn().mockResolvedValue(true) };
  const notifications = { schedule: jest.fn().mockResolvedValue(undefined) };
  const svc = new SecurityNoticeService(
    prisma as never,
    email as never,
    notifications as never,
  );
  return { svc, email, notifications, prisma };
}

describe('SecurityNoticeService.deliver', () => {
  it('есть почта и Telegram → письмо на адрес входа и строка в очереди бота', async () => {
    const { svc, email, notifications } = makeService({
      form: 'vy',
      email: 'me@example.com',
      telegramId: '123456',
    });
    await svc.deliver(7n, { kind: 'provider_linked', provider: 'google' });
    expect(email.send).toHaveBeenCalledWith(
      'me@example.com',
      'Новый способ входа во «Всё по схеме»',
      expect.stringContaining('К вашему аккаунту'),
    );
    expect(notifications.schedule).toHaveBeenCalledWith(
      7n,
      'security_notice',
      expect.any(Date),
      { kind: 'provider_linked', provider: 'google' },
    );
  });

  it('нет ни почты, ни Telegram → никуда не шлёт (след — в журнале у вызывающего)', async () => {
    const { svc, email, notifications } = makeService({});
    await expect(
      svc.deliver(7n, { kind: 'totp_locked' }),
    ).resolves.toBeUndefined();
    expect(email.send).not.toHaveBeenCalled();
    expect(notifications.schedule).not.toHaveBeenCalled();
  });

  // Хвост S12: письмо об отвязке почты уходило только в оставшиеся каналы —
  // хозяин снятого адреса, которого отвязал не он, не узнавал ничего.
  it('отвязка почты: письмо уходит и на снятый адрес, которого у аккаунта уже нет', async () => {
    const { svc, email } = makeService({ form: 'ty' });
    await svc.deliver(7n, { kind: 'provider_unlinked', provider: 'email' }, [
      'old@example.com',
    ]);
    expect(email.send).toHaveBeenCalledWith(
      'old@example.com',
      'Способ входа отвязан от «Всё по схеме»',
      expect.stringContaining('отвязан способ входа: вход по почте'),
    );
  });

  it('адрес и в аккаунте, и в alsoTo — одно письмо, не два', async () => {
    const { svc, email } = makeService({ email: 'me@example.com' });
    await svc.deliver(7n, { kind: 'provider_unlinked', provider: 'google' }, [
      'me@example.com',
    ]);
    expect(email.send.mock.calls.map((c) => c[0])).toEqual(['me@example.com']);
  });

  it('emailAddresses: адреса почтового входа; сбой чтения — пусто, не бросает', async () => {
    const { svc, prisma } = makeService({ email: 'me@example.com' });
    await expect(svc.emailAddresses(7n)).resolves.toEqual(['me@example.com']);
    prisma.authProvider.findMany.mockImplementationOnce(() =>
      Promise.reject(new Error('db down')),
    );
    await expect(svc.emailAddresses(7n)).resolves.toEqual([]);
  });

  it('notify не бросает и не ждёт: сбой почты уходит в warn', async () => {
    const { svc, email } = makeService({ email: 'me@example.com' });
    email.send.mockRejectedValue(new Error('postbox down'));
    expect(() => svc.linked(7n, 'vk')).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(email.send).toHaveBeenCalled();
  });
});

describe('тексты уведомлений', () => {
  const kinds = [
    { kind: 'provider_linked', provider: 'telegram' },
    { kind: 'provider_unlinked', provider: 'email' },
    { kind: 'totp_locked' },
  ] as const;

  it.each(kinds)('%o: ты-форма без «вы», вы-форма без «ты»', (notice) => {
    const ty = securityNoticeText(notice, 'ty').body;
    const vy = securityNoticeText(notice, 'vy').body;
    expect(ty).toMatch(/твоем|твоего|твоему|твоей|ты\b/i);
    expect(vy).toMatch(/вашем|вашего|вашему|вашей|вы\b/i);
    expect(vy).not.toMatch(/\bты\b|\bтвой|\bтвоем|\bтвоему|\bтвоей/i);
    expect(ty).not.toMatch(/\bвы\b|\bваш/i);
  });

  it('имя площадки — человеческое, не id', () => {
    const t = securityNoticeText(
      { kind: 'provider_linked', provider: 'vk' },
      'ty',
    );
    expect(t.body).toContain('VK ID');
  });

  it('сообщение бота собирается через renderTemplate очереди', () => {
    const msg = renderTemplate(
      'security_notice',
      { kind: 'provider_unlinked', provider: 'google' },
      'vy',
    );
    expect(msg?.text).toContain('🔐 Способ входа отвязан');
    expect(msg?.text).toContain('Google');
    expect(msg?.text).toContain('откройте «Аккаунт»');
  });

  it('битый payload в очереди → null (строка снимается, а не падает)', () => {
    expect(
      renderTemplate('security_notice', { kind: 'nope' }, 'ty'),
    ).toBeNull();
  });
});
