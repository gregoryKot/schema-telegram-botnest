import { NotFoundException } from '@nestjs/common';
import { AuthProviderRegistry } from './registry';

// registry → google.provider → jose (ESM). Мокаем, чтобы jest не парсил ESM-модуль.
jest.mock('jose', () => ({ createRemoteJWKSet: jest.fn(), jwtVerify: jest.fn() }));

// Лёгкие стабы — реестру важен только .id каждого провайдера.
const google = { id: 'google' } as any;
const telegram = { id: 'telegram' } as any;
const telegramOidc = { id: 'telegram-oidc' } as any;
const vk = { id: 'vk' } as any;

function makeRegistry() {
  return new AuthProviderRegistry(google, telegram, telegramOidc, vk);
}

describe('AuthProviderRegistry', () => {
  it('get() возвращает провайдера по id', () => {
    const reg = makeRegistry();
    expect(reg.get('google')).toBe(google);
    expect(reg.get('vk')).toBe(vk);
    expect(reg.get('telegram-oidc')).toBe(telegramOidc);
  });

  it('get() на неизвестный id → NotFoundException', () => {
    expect(() => makeRegistry().get('facebook')).toThrow(NotFoundException);
  });

  it('list() возвращает все зарегистрированные провайдеры', () => {
    const list = makeRegistry().list();
    expect(list).toHaveLength(4);
    expect(list).toEqual(expect.arrayContaining([google, telegram, telegramOidc, vk]));
  });
});
