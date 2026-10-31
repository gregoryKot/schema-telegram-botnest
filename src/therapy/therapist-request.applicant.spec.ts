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
        'Подать заявку заново можно кнопкой «Я психолог — подать заявку» на странице https://schemehappens.ru/account',
    );
    expect(mail.subject).toBe('Заявка на роль терапевта отклонена');
  });

  it('отказ без причины: следующий шаг есть в обоих каналах и формах, одобрение его не несёт', () => {
    const vyMail = mod.decisionMessage('vy', 'rejected', undefined, 'email');
    expect(vyMail.text).toBe(
      'Ваша заявка на роль терапевта отклонена.\n\n' +
        'Подать заявку заново можно кнопкой «Я психолог — подать заявку» на странице https://schemehappens.ru/account',
    );
    const tyTg = mod.decisionMessage('ty', 'rejected', undefined, 'tg').text;
    expect(tyTg).toMatch(
      /^❌ Твоя заявка[^\n]*отклонена\.\n\nПодать заявку заново/,
    );
    expect(tyTg).not.toContain('Причина');
    // Письмо кончается ссылкой: ни точки, ни двоеточия вплотную — автолинкер
    // почтового клиента утащил бы знак препинания в адрес.
    expect(vyMail.text).toMatch(/https:\/\/schemehappens\.ru\/account$/);
    // Обращения в хвосте нет: ни «ты», ни «вы» не просочиваются мимо t().
    expect(vyMail.text.split('\n\n')[1]).not.toMatch(
      /(^|[^а-яё])(ты|вы)([^а-яё]|$)/i,
    );
    const ok = mod.decisionMessage('ty', 'approved', undefined, 'tg').text;
    expect(ok).not.toContain('заново');
  });

  // Подпись кнопки живёт в трёх местах фронтов (правило №3 и №4): страница
  // /account сайта, настройки сайта и настройки мини-аппа. Письмо и сообщение в
  // Telegram называют её дословно — переименуют кнопку, человека поведёт «не туда».
  // Строка подписи должна стоять сама по себе (текст кнопки), а не мелькать в
  // комментарии рядом: иначе пин зелёный и после удаления кнопки.
  const BUTTON_SOURCES = [
    'webapp/src/pages/account/TherapistRequestSection.tsx',
    'webapp/src/components/settingsSheet/BecomeTherapistSection.tsx',
    'schema-miniapp/src/components/settingsSheet/BecomeTherapistSection.tsx',
  ];
  const hasButton = (src: string) =>
    new RegExp(`^\\s*${mod.APPLY_BUTTON}\\s*$`, 'm').test(src);

  it('подпись кнопки из письма и Telegram есть на каждой площадке подачи заявки', () => {
    const root = join(__dirname, '..', '..');
    for (const file of BUTTON_SOURCES) {
      expect({
        file,
        found: hasButton(readFileSync(join(root, file), 'utf8')),
      }).toEqual({ file, found: true });
    }
  });

  it('пин не обманывается комментарием и переименованной кнопкой', () => {
    const label = mod.APPLY_BUTTON;
    expect(hasButton(`<button>\n  ${label}\n</button>`)).toBe(true);
    expect(
      hasButton(`// кнопка «${label}»\n<button>Подать заявку</button>`),
    ).toBe(false);
    expect(hasButton('<button>\n  Подать заявку\n</button>')).toBe(false);
  });
});

describe('loadApplicantProfile', () => {
  const ID = 1_000_000_000_000_102n;

  // Восстановление по запасной почте убрано (#864): колонка recoveryEmail пуста
  // у всех и не читается — адрес берётся у способов входа, даже если старая
  // строка в базе вдруг заполнена.
  it('адрес — у способа входа, не из recoveryEmail; форма читается из User', async () => {
    const prisma = prismaWith([{ provider: 'email', providerId: 'x@e.ru' }], {
      addressForm: 'vy',
      recoveryEmail: 'r@e.ru',
      recoveryEmailVerifiedAt: new Date(),
    });
    expect(await mod.loadApplicantProfile(prisma, ID)).toEqual({
      form: 'vy',
      email: 'x@e.ru',
    });
    expect(prisma.user.findUnique.mock.calls[0][0].select).toEqual({
      addressForm: true,
    });
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
