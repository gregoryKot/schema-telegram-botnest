// Привязка почты кодом из письма (email-link-code.ts): путь «запросил в
// приложении внутри Telegram → открыл письмо в другой программе → ввёл код
// там же, где запросил». Сквозной сценарий: настоящий sendMagicLink пишет
// токен, настоящее письмо несёт код, настоящий сервис по нему привязывает.
import { createHash } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from './auth.service';
import {
  emailLinkCode,
  emailLinkCodeForLink,
  emailLinkCodeMatches,
} from './email-link-code';
import { EmailLinkCodeService } from './email-link-code.service';
import { linkEmailLetter } from './email-link.letter';
import { sendMagicLink } from './magic-link';

const OWNER = 42n;
const OTHER = 43n;

interface TokenRow {
  id: string;
  userId: bigint | null;
  tokenHash: string;
  email: string;
  purpose: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

function build() {
  const rows: TokenRow[] = [];
  const letters: { email: string; body: string }[] = [];
  const prisma = {
    emailToken: {
      create: ({ data }: { data: TokenRow }) => {
        rows.push({ ...data, usedAt: null, createdAt: new Date() });
        return Promise.resolve(data);
      },
      findMany: ({ where }: { where: { userId: bigint; purpose: string } }) =>
        Promise.resolve(
          rows.filter(
            (r) =>
              r.userId === where.userId &&
              r.purpose === where.purpose &&
              !r.usedAt &&
              r.expiresAt > new Date(),
          ),
        ),
      updateMany: ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id && !r.usedAt);
        if (row) row.usedAt = new Date();
        return Promise.resolve({ count: row ? 1 : 0 });
      },
    },
  } as unknown as PrismaService;
  const auth = {
    linkProviderToUser: jest.fn().mockResolvedValue({ ok: true }),
  };
  const service = new EmailLinkCodeService(
    prisma,
    auth as unknown as AuthService,
  );
  /** Запрос письма привязки; возвращает код так, как его прочтёт человек. */
  const request = async (userId: bigint, email: string) => {
    await sendMagicLink(
      {
        prisma,
        webappUrl: 'https://schemehappens.ru',
        encryptEmail: (e) => e,
        addressForm: () => Promise.resolve('ty'),
        send: () => Promise.reject(new Error('это не письмо входа')),
        sendLink: (to, link, form) => {
          letters.push({ email: to, body: linkEmailLetter(form, link).body });
          return Promise.resolve();
        },
        onSendError: (m) => {
          throw new Error(m);
        },
      },
      userId,
      email,
      'link_email_auth',
    );
    const body = letters[letters.length - 1].body;
    return /: ([A-Z2-9]{4}-[A-Z2-9]{4})\n/.exec(body)![1];
  };
  return { rows, auth, service, request };
}

describe('emailLinkCode', () => {
  const hash = createHash('sha256').update('raw-token').digest('hex');

  it('8 знаков из алфавита без похожих начертаний, один и тот же для одного токена', () => {
    const code = emailLinkCode(hash);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(emailLinkCode(hash)).toBe(code);
    expect(emailLinkCode(`${hash}0`)).not.toBe(code);
  });

  it('код из ссылки письма совпадает с кодом по хешу из БД', () => {
    const link =
      'https://schemehappens.ru/api/auth/email/callback?token=raw-token';
    expect(emailLinkCodeForLink(link)).toBe(emailLinkCode(hash));
  });

  it('сверка терпит регистр и пробелы, чужой и короткий код не проходят', () => {
    const code = emailLinkCode(hash);
    expect(emailLinkCodeMatches(hash, ` ${code.toLowerCase()} `)).toBe(true);
    expect(emailLinkCodeMatches(hash, 'AAAAAAAA')).toBe(false);
    expect(emailLinkCodeMatches(hash, code.slice(0, 7))).toBe(false);
  });
});

describe('EmailLinkCodeService.confirm — запросил → получил письмо → ввёл код', () => {
  it('код из письма привязывает адрес к аккаунту, который его запросил', async () => {
    const { service, request, auth, rows } = build();
    const shown = await request(OWNER, 'me@example.com');

    await service.confirm(OWNER, shown.replace('-', ''));

    expect(auth.linkProviderToUser).toHaveBeenCalledWith(
      OWNER,
      'email',
      'me@example.com',
      'me@example.com',
      'me@example.com',
    );
    expect(rows[0].usedAt).not.toBeNull();
  });

  it('чужой сессии верный код не годится: адрес не привязан, токен жив', async () => {
    const { service, request, auth, rows } = build();
    const shown = await request(OWNER, 'me@example.com');

    await expect(
      service.confirm(OTHER, shown.replace('-', '')),
    ).rejects.toThrow('Код не подошёл или истёк');
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
    expect(rows[0].usedAt).toBeNull();
  });

  it('неверный код — отказ, токен жив', async () => {
    const { service, request, auth, rows } = build();
    await request(OWNER, 'me@example.com');
    await expect(service.confirm(OWNER, 'ZZZZZZZZ')).rejects.toThrow(
      'Код не подошёл или истёк',
    );
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
    expect(rows[0].usedAt).toBeNull();
  });

  it('код одноразовый и не переживает срок письма', async () => {
    const { service, request, auth, rows } = build();
    const first = (await request(OWNER, 'me@example.com')).replace('-', '');
    await service.confirm(OWNER, first);
    await expect(service.confirm(OWNER, first)).rejects.toThrow(
      'Код не подошёл или истёк',
    );

    const second = (await request(OWNER, 'me2@example.com')).replace('-', '');
    rows[1].expiresAt = new Date(Date.now() - 1000);
    await expect(service.confirm(OWNER, second)).rejects.toThrow(
      'Код не подошёл или истёк',
    );
    expect(auth.linkProviderToUser).toHaveBeenCalledTimes(1);
  });

  it('токен ВХОДА кодом не гасится: код — только для привязки', async () => {
    const { service, rows, auth } = build();
    const hash = createHash('sha256').update('login-raw').digest('hex');
    rows.push({
      id: 't-login',
      userId: OWNER,
      tokenHash: hash,
      email: 'me@example.com',
      purpose: 'login',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      createdAt: new Date(),
    });
    await expect(service.confirm(OWNER, emailLinkCode(hash))).rejects.toThrow(
      'Код не подошёл или истёк',
    );
    expect(auth.linkProviderToUser).not.toHaveBeenCalled();
  });

  it('адрес успели занять другим аккаунтом — 409 email_taken', async () => {
    const { service, request, auth } = build();
    const shown = await request(OWNER, 'me@example.com');
    auth.linkProviderToUser.mockResolvedValue({
      ok: false,
      conflictUserId: '43',
    });
    await expect(
      service.confirm(OWNER, shown.replace('-', '')),
    ).rejects.toMatchObject({ response: { reason: 'email_taken' } });
  });
});
