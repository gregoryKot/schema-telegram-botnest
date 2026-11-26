// Единый источник хостовых 301-редиректов (2026-09-16: OAuth зациклился с
// main.ts, потому что список хостов жил только там). Контрольный тест —
// алиас (kotlarewski.gr) НЕ редиректится по хосту.
import { canonicalRedirectTarget, isRedirectedHost } from './canonical-host';

describe('isRedirectedHost', () => {
  it('legacy-домен и его www — редиректятся', () => {
    expect(isRedirectedHost('schemalab.ru')).toBe(true);
    expect(isRedirectedHost('www.schemalab.ru')).toBe(true);
  });

  it('www канонического домена — редиректится', () => {
    expect(isRedirectedHost('www.schemehappens.ru')).toBe(true);
  });

  it('регистр не важен', () => {
    expect(isRedirectedHost('WWW.SchemeHappens.RU')).toBe(true);
  });

  it('канонический apex — не редиректится', () => {
    expect(isRedirectedHost('schemehappens.ru')).toBe(false);
  });

  it('контроль: алиас kotlarewski.gr НЕ редиректится по хосту', () => {
    expect(isRedirectedHost('kotlarewski.gr')).toBe(false);
    expect(isRedirectedHost('kotlarewski.ru')).toBe(false);
  });
});

describe('canonicalRedirectTarget', () => {
  it('legacy-хост → https://schemehappens.ru + тот же путь+query', () => {
    expect(canonicalRedirectTarget('schemalab.ru', '/login?x=1')).toBe(
      'https://schemehappens.ru/login?x=1',
    );
  });

  it('www канонического домена → apex', () => {
    expect(canonicalRedirectTarget('www.schemehappens.ru', '/app')).toBe(
      'https://schemehappens.ru/app',
    );
  });

  it('канонический хост → null (не редиректить самого себя)', () => {
    expect(canonicalRedirectTarget('schemehappens.ru', '/app')).toBeNull();
  });

  it('алиас kotlarewski.gr → null (только форс https, не в этой функции)', () => {
    expect(canonicalRedirectTarget('kotlarewski.gr', '/app')).toBeNull();
  });
});
