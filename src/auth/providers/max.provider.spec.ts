// MaxProvider — обёртка verifyMaxInitData под ConfigService. Сам алгоритм
// проверки покрыт max-init-data.spec.ts; здесь — конфиг-ветки провайдера:
// нет токена вовсе, свой токен, унаследованный от канального бота (у нас бот
// один на канал и мини-апп) и приоритет своего над канальным.
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MaxProvider } from './max.provider';
import { MaxNotConfiguredError } from '../max-init-data';
import { classifyInitDataFailure } from '../../api/initdata-alert';

const BOT_TOKEN = '111222:MAX_PROVIDER_TEST_TOKEN';

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

function signInitData(user: unknown, botToken: string): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify(user),
  };
  const checkString = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  const pairs = Object.entries(fields).map(
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  );
  pairs.push(`hash=${hash}`);
  return pairs.join('&');
}

describe('MaxProvider.verifyInitData', () => {
  // Отдельный класс, а НЕ UnauthorizedException: незаданный токен — наша
  // несобранная конфигурация. Уйди она в rejectInitData как обычная ошибка
  // подписи — админ получал бы «suspicious_initdata» на каждой попытке входа,
  // пока переменную не проставят, и настоящая подделка утонула бы в этом шуме.
  it('MAX_BOT_TOKEN не задан → MaxNotConfiguredError, а не ошибка подписи', () => {
    const provider = new MaxProvider(makeConfig({}));
    expect(() => provider.verifyInitData('anything')).toThrow(
      MaxNotConfiguredError,
    );
    expect(() => provider.verifyInitData('anything')).toThrow(
      'MAX_BOT_TOKEN not configured',
    );
    // Классификатор алертов не должен принять это за подделку.
    expect(classifyInitDataFailure(new MaxNotConfiguredError())).not.toBe(
      'expired',
    );
    try {
      provider.verifyInitData('anything');
    } catch (err) {
      expect(err).not.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('MAX_BOT_TOKEN задан и подпись валидна → ProviderIdentity', () => {
    const provider = new MaxProvider(makeConfig({ MAX_BOT_TOKEN: BOT_TOKEN }));
    const initData = signInitData(
      { id: 42, first_name: 'Ира', username: 'ira' },
      BOT_TOKEN,
    );
    const identity = provider.verifyInitData(initData);
    expect(identity).toEqual({ providerId: '42', displayName: 'Ира' });
  });

  it('BOT_TOKEN с пробелами по краям — секрет всё равно совпадает (config.trim())', () => {
    const provider = new MaxProvider(
      makeConfig({ MAX_BOT_TOKEN: `  ${BOT_TOKEN}  ` }),
    );
    const initData = signInitData({ id: 42, first_name: 'Ира' }, BOT_TOKEN);
    expect(provider.verifyInitData(initData).providerId).toBe('42');
  });

  // Мини-апп живёт под тем же ботом, что публикует канал, и его токен уже
  // лежит в HEALTHY_ADULT_MAX_TOKEN. Дублировать секрет во вторую переменную
  // значит обязать себя ротировать их синхронно — забудешь одну, и либо канал
  // молча перестанет постить, либо все входы начнут падать.
  it('своей переменной нет → берётся токен канального бота', () => {
    const provider = new MaxProvider(
      makeConfig({ HEALTHY_ADULT_MAX_TOKEN: BOT_TOKEN }),
    );
    const initData = signInitData({ id: 7, first_name: 'Гриша' }, BOT_TOKEN);
    expect(provider.verifyInitData(initData).providerId).toBe('7');
  });

  // Если мини-апп переедет под отдельного бота, явная переменная обязана
  // перекрыть унаследованную — иначе вход остался бы на старом секрете.
  it('заданы обе → MAX_BOT_TOKEN сильнее канального', () => {
    const OWN = '999:OWN_MINIAPP_BOT';
    const provider = new MaxProvider(
      makeConfig({ MAX_BOT_TOKEN: OWN, HEALTHY_ADULT_MAX_TOKEN: BOT_TOKEN }),
    );
    expect(
      provider.verifyInitData(signInitData({ id: 7 }, OWN)).providerId,
    ).toBe('7');
    // Подпись канальным токеном при заданном своём больше не проходит.
    expect(() =>
      provider.verifyInitData(signInitData({ id: 7 }, BOT_TOKEN)),
    ).toThrow('Invalid MAX initData signature');
  });

  it('пустая строка в своей переменной не считается заданной', () => {
    const provider = new MaxProvider(
      makeConfig({ MAX_BOT_TOKEN: '   ', HEALTHY_ADULT_MAX_TOKEN: BOT_TOKEN }),
    );
    const initData = signInitData({ id: 7, first_name: 'Гриша' }, BOT_TOKEN);
    expect(provider.verifyInitData(initData).providerId).toBe('7');
  });

  it('подделанная подпись → ошибка пробрасывается наружу (не глотается)', () => {
    const provider = new MaxProvider(makeConfig({ MAX_BOT_TOKEN: BOT_TOKEN }));
    const initData = signInitData(
      { id: 42, first_name: 'Ира' },
      BOT_TOKEN,
    ).replace(/hash=[0-9a-f]+$/, `hash=${'0'.repeat(64)}`);
    expect(() => provider.verifyInitData(initData)).toThrow(
      'Invalid MAX initData signature',
    );
  });
});
