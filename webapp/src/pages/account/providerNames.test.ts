import { describe, it, expect } from 'vitest';
import { PROVIDER_NAMES, providerName } from './providerNames';

describe('providerName', () => {
  it('настоящие id бэкенда → человеческие имена', () => {
    expect(providerName('google')).toBe('Google');
    expect(providerName('vk')).toBe('ВКонтакте');
    expect(providerName('telegram')).toBe('Telegram');
    expect(providerName('max')).toBe('MAX');
    expect(providerName('email')).toBe('Email');
  });

  it('пусто, неизвестный id и ключ прототипа → null, а не сам id', () => {
    expect(providerName(null)).toBeNull();
    expect(providerName(undefined)).toBeNull();
    expect(providerName('')).toBeNull();
    expect(providerName('Google')).toBeNull();
    expect(providerName('toString')).toBeNull();
  });

  it('словарь покрывает каждый способ входа', () => {
    expect(Object.keys(PROVIDER_NAMES).sort()).toEqual(['email', 'google', 'max', 'telegram', 'vk']);
  });
});
