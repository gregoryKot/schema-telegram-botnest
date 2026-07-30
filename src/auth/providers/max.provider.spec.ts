// MaxProvider — обёртка verifyMaxInitData под ConfigService (MAX_BOT_TOKEN).
// Сам алгоритм проверки покрыт max-init-data.spec.ts; здесь — конфиг-ветки
// провайдера (нет токена / есть токен + валидная подпись).
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { MaxProvider } from './max.provider';

const BOT_TOKEN = '111222:MAX_PROVIDER_TEST_TOKEN';

function makeConfig(token: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'MAX_BOT_TOKEN' ? token : undefined),
  } as unknown as ConfigService;
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
  it('MAX_BOT_TOKEN не задан → UnauthorizedException', () => {
    const provider = new MaxProvider(makeConfig(undefined));
    expect(() => provider.verifyInitData('anything')).toThrow(
      UnauthorizedException,
    );
    expect(() => provider.verifyInitData('anything')).toThrow(
      'MAX_BOT_TOKEN not configured',
    );
  });

  it('MAX_BOT_TOKEN задан и подпись валидна → ProviderIdentity', () => {
    const provider = new MaxProvider(makeConfig(BOT_TOKEN));
    const initData = signInitData(
      { id: 42, first_name: 'Ира', username: 'ira' },
      BOT_TOKEN,
    );
    const identity = provider.verifyInitData(initData);
    expect(identity).toEqual({ providerId: '42', displayName: 'Ира' });
  });

  it('BOT_TOKEN с пробелами по краям — секрет всё равно совпадает (config.trim())', () => {
    const provider = new MaxProvider(makeConfig(`  ${BOT_TOKEN}  `));
    const initData = signInitData({ id: 42, first_name: 'Ира' }, BOT_TOKEN);
    expect(provider.verifyInitData(initData).providerId).toBe('42');
  });

  it('подделанная подпись → ошибка пробрасывается наружу (не глотается)', () => {
    const provider = new MaxProvider(makeConfig(BOT_TOKEN));
    const initData = signInitData(
      { id: 42, first_name: 'Ира' },
      BOT_TOKEN,
    ).replace(/hash=[0-9a-f]+$/, `hash=${'0'.repeat(64)}`);
    expect(() => provider.verifyInitData(initData)).toThrow(
      'Invalid MAX initData signature',
    );
  });
});
