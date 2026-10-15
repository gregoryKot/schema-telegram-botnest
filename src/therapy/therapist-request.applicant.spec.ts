import { readFileSync } from 'fs';
import { join } from 'path';

// Адресат решения по заявке терапевта: текст (ты/вы, без рода, оба канала) и
// выбор почты аккаунта. AuthProvider.email лежит в базе шифротекстом
// (encryption-policy.ts) — читать его сырым нельзя, поэтому тест пишет строку
// тем же encryptAuthProviderFields, что и прод, а не подставляет заглушку.
type Mod = typeof import('./therapist-request.applicant');
type ProviderCrypto = typeof import('../utils/auth-provider-crypto');
let mod: Mod;
let authCrypto: ProviderCrypto;

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'ab'.repeat(32);
  process.env.NODE_ENV = 'test';
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  mod = require('./therapist-request.applicant') as Mod;
  authCrypto = require('../utils/auth-provider-crypto') as ProviderCrypto;
  /* eslint-enable @typescript-eslint/no-require-imports */
});

function prismaWith(rows: Array<Record<string, unknown>>, user: object = {}) {
  return {
    user: { findUnique: jest.fn(() => Promise.resolve(user)) },
    authProvider: { findMany: jest.fn(() => Promise.resolve(rows)) },
  } as any;
}

describe('decisionMessage', () => {
  it('«ты» и «вы», Telegram и письмо: форма обращения и канал разведены', () => {
    const tgTy = mod.decisionMessage('ty', 'approved', undefined, 'tg').text;
    const tgVy = mod.decisionMessage('vy', 'approved', undefined, 'tg').text;
    const mailTy = mod.decisionMessage('ty', 'approved', undefined, 'email');
    const mailVy = mod.decisionMessage('vy', 'approved', undefined, 'email');
    expect(tgTy).toContain('Твоя заявка');
    expect(tgVy).toContain('Ваша заявка');
    expect(mailTy.text).toMatch(/^Твоя заявка/);
    expect(mailVy.text).toMatch(/^Ваша заявка/);
    expect(mailVy.text).toContain('https://schemehappens.ru/account');
    expect(mailVy.text).not.toContain('✅');
    expect(mailVy.subject).toBe('Заявка на роль терапевта одобрена');
  });

  it('отказ: причина экранируется только в Telegram; без причины блока нет', () => {
    const reason = 'нужен <диплом>';
    const tg = mod.decisionMessage('ty', 'rejected', reason, 'tg').text;
    const mail = mod.decisionMessage('ty', 'rejected', reason, 'email');
    expect(tg).toBe(
      '❌ Твоя заявка на роль терапевта отклонена.\n\nПричина: нужен &lt;диплом&gt;\n\n' +
        'Подать заявку заново можно в настройках приложения: кнопка «Я психолог — подать заявку».',
    );
    expect(mail.text).toBe(
      'Твоя заявка на роль терапевта отклонена.\n\nПричина: нужен <диплом>\n\n' +
        'Подать заявку заново можно на https://schemehappens.ru/account: кнопка «Я психолог — подать заявку».',
    );
    expect(mail.subject).toBe('Заявка на роль терапевта отклонена');
  });

  it('отказ без причины: следующий шаг есть в обоих каналах и формах, одобрение его не несёт', () => {
    const vyMail = mod.decisionMessage('vy', 'rejected', undefined, 'email');
    expect(vyMail.text).toBe(
      'Ваша заявка на роль терапевта отклонена.\n\n' +
        'Подать заявку заново можно на https://schemehappens.ru/account: кнопка «Я психолог — подать заявку».',
    );
    const tyTg = mod.decisionMessage('ty', 'rejected', undefined, 'tg').text;
    expect(tyTg).toMatch(
      /^❌ Твоя заявка[^\n]*отклонена\.\n\nПодать заявку заново/,
    );
    expect(tyTg).not.toContain('Причина');
    // Обращения в хвосте нет: ни «ты», ни «вы» не просочиваются мимо t().
    expect(vyMail.text.split('\n\n')[1]).not.toMatch(
      /(^|[^а-яё])(ты|вы)([^а-яё]|$)/i,
    );
    const ok = mod.decisionMessage('ty', 'approved', undefined, 'tg').text;
    expect(ok).not.toContain('заново');
  });

  // Подпись кнопки живёт в двух фронтендах (правило №3) и в письме — три места,
  // обязанные совпадать (правило №4): переименуют кнопку — письмо поведёт «не туда».
  it('подпись кнопки из письма есть в настройках сайта и мини-аппа', () => {
    const root = join(__dirname, '..', '..');
    for (const file of [
      'webapp/src/pages/account/TherapistRequestSection.tsx',
      'schema-miniapp/src/components/settingsSheet/BecomeTherapistSection.tsx',
    ]) {
      expect(readFileSync(join(root, file), 'utf8')).toContain(
        mod.APPLY_BUTTON,
      );
    }
  });
});

describe('loadApplicantProfile', () => {
  const ID = 1_000_000_000_000_102n;

  it('подтверждённый recoveryEmail сильнее провайдеров; форма читается из User', async () => {
    const prisma = prismaWith([{ provider: 'email', providerId: 'x@e.ru' }], {
      addressForm: 'vy',
      recoveryEmail: 'r@e.ru',
      recoveryEmailVerifiedAt: new Date(),
    });
    expect(await mod.loadApplicantProfile(prisma, ID)).toEqual({
      form: 'vy',
      email: 'r@e.ru',
    });
    expect(prisma.authProvider.findMany).not.toHaveBeenCalled();
  });

  it('email Google, лежащий шифротекстом, уходит в письмо расшифрованным', async () => {
    const row = authCrypto.encryptAuthProviderFields({
      provider: 'google',
      providerId: 'sub-1',
      email: 'anya@example.com',
    });
    expect(row.email).not.toBe('anya@example.com');
    const prisma = prismaWith([row], { addressForm: null });
    expect(await mod.loadApplicantProfile(prisma, ID)).toEqual({
      form: 'ty',
      email: 'anya@example.com',
    });
  });

  it('вход по почте: providerId и есть адрес; невалидное значение пропускается', async () => {
    const good = prismaWith([{ provider: 'email', providerId: 'a@e.ru' }]);
    expect((await mod.loadApplicantProfile(good, ID)).email).toBe('a@e.ru');
    const bad = prismaWith([{ provider: 'email', providerId: 'не-адрес' }]);
    expect((await mod.loadApplicantProfile(bad, ID)).email).toBeNull();
  });

  it('пользователя нет и провайдеров нет → «ты» и без почты', async () => {
    const prisma = {
      user: { findUnique: jest.fn(() => Promise.resolve(null)) },
      authProvider: { findMany: jest.fn(() => Promise.resolve([])) },
    } as any;
    expect(await mod.loadApplicantProfile(prisma, ID)).toEqual({
      form: 'ty',
      email: null,
    });
  });
});
