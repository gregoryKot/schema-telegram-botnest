// Кому показывать карточку объединения. Правило продуктовое, поэтому и
// проверяется таблицей: «у кого один способ входа» было бы верно почти для
// всей базы, и карточка стала бы постоянным предложением сделать ненужное.
import { describe, expect, it } from 'vitest';
import { missingLinkTarget } from './linkTarget';

describe('missingLinkTarget', () => {
  it('провайдеры ещё не пришли — карточки нет (выдуманного состояния не показываем)', () => {
    expect(missingLinkTarget({ providers: null, hostId: 'web' })).toBeNull();
  });

  it('пустой список — тоже ничего', () => {
    expect(missingLinkTarget({ providers: [], hostId: 'web' })).toBeNull();
  });

  describe('на сайте', () => {
    it.each([['google'], ['vk'], ['email']])(
      'вход только через %s — предлагаем подключить Telegram',
      (p) => {
        expect(missingLinkTarget({ providers: [p], hostId: 'web' })).toBe(
          'telegram',
        );
      },
    );

    it('Telegram уже привязан — собирать нечего', () => {
      expect(
        missingLinkTarget({ providers: ['google', 'telegram'], hostId: 'web' }),
      ).toBeNull();
    });

    it('MAX считается мессенджером — карточки тоже нет', () => {
      expect(
        missingLinkTarget({ providers: ['google', 'max'], hostId: 'web' }),
      ).toBeNull();
    });
  });

  describe('в мессенджере', () => {
    it('MAX без сайта — предлагаем сразу: своего входа для сайтов там нет', () => {
      expect(missingLinkTarget({ providers: ['max'], hostId: 'max' })).toBe(
        'site',
      );
    });

    it('Telegram без сайта — только по явному жесту', () => {
      const input = { providers: ['telegram'], hostId: 'telegram' };
      expect(missingLinkTarget(input)).toBeNull();
      expect(missingLinkTarget({ ...input, asked: true })).toBe('site');
    });

    it('сайт уже привязан — не предлагаем даже по жесту', () => {
      expect(
        missingLinkTarget({
          providers: ['telegram', 'google'],
          hostId: 'telegram',
          asked: true,
        }),
      ).toBeNull();
    });
  });
});
