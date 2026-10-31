// A3: письмо привязки адреса не должно выглядеть как письмо входа.
import { linkEmailLetter } from './email-link.letter';
import { loginLetter } from './email.letters';

const LINK = 'https://schemehappens.ru/api/auth/email/callback?token=abc';

describe('linkEmailLetter', () => {
  it.each(['ty', 'vy'] as const)(
    'форма %s: названо действие и есть ссылка',
    (form) => {
      const l = linkEmailLetter(form, LINK);
      expect(l.body).toContain(LINK);
      expect(l.body).toContain(
        'привязать этот адрес к своему аккаунту во «Всё по схеме»',
      );
      expect(l.subject).toContain('Привязать');
      // Не письмо входа: жертва не должна читать «Войти».
      expect(l.subject).not.toBe(loginLetter(form, LINK).subject);
      expect(l.body).not.toContain('чтобы войти');
    },
  );

  it('«ты»-форма не содержит «вы»-оборотов и наоборот', () => {
    const ty = linkEmailLetter('ty', LINK).body;
    const vy = linkEmailLetter('vy', LINK).body;
    expect(ty).toContain('Перейди');
    expect(ty).toContain('не от тебя');
    expect(ty).not.toMatch(/Перейдите|не от вас/);
    expect(vy).toContain('Перейдите');
    expect(vy).toContain('не от вас');
    expect(vy).not.toMatch(/Перейди по|не от тебя/);
  });

  // Аудит 2026-10: перед «вс-» — «во», а не «в». Тема и тело
  // письма входа — первое, что человек получает от продукта.
  it.each(['ty', 'vy'] as const)(
    'форма %s: письмо входа — «во «Всё по схеме»»',
    (form) => {
      const login = loginLetter(form, LINK);
      expect(login.subject).toBe('Войти во «Всё по схеме»');
      expect(login.body).toContain('чтобы войти во «Всё по схеме»:');
    },
  );

  it('предупреждает: если запрос не от получателя — не переходить', () => {
    expect(linkEmailLetter('ty', LINK).body).toContain('не переходи по ссылке');
    expect(linkEmailLetter('vy', LINK).body).toContain(
      'не переходите по ссылке',
    );
  });
});
