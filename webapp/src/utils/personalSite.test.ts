// S15 (аудит 2026-11): визитка и её Метрика на продуктовом хосте не включаются
// параметром `?site=personal`; вне прода (dev, петля для смока) — включаются.
import { describe, it, expect } from 'vitest';
import { resolvePersonalSite } from './personalSite';

describe('resolvePersonalSite', () => {
  it('хост визитки — визитка, с параметром и без', () => {
    expect(resolvePersonalSite('kotlarewski.gr', '', false)).toBe(true);
    expect(resolvePersonalSite('www.kotlarewski.gr', '?site=personal', false)).toBe(true);
  });

  it('продуктовый хост в проде: ?site=personal игнорируется', () => {
    expect(resolvePersonalSite('schemehappens.ru', '?site=personal', false)).toBe(false);
    expect(resolvePersonalSite('www.schemehappens.ru', '?a=1&site=personal', false)).toBe(false);
  });

  it('петля (смок на собранном бандле) и dev-сервер — параметр работает', () => {
    expect(resolvePersonalSite('127.0.0.1', '?site=personal', false)).toBe(true);
    expect(resolvePersonalSite('localhost', '?site=personal', false)).toBe(true);
    expect(resolvePersonalSite('192.168.1.5', '?site=personal', true)).toBe(true);
  });

  it('без параметра или с другим значением — продукт', () => {
    expect(resolvePersonalSite('127.0.0.1', '', false)).toBe(false);
    expect(resolvePersonalSite('localhost', '?site=app', true)).toBe(false);
    expect(resolvePersonalSite('127.0.0.1.evil.ru', '?site=personal', false)).toBe(false);
  });
});
