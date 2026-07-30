// Доверие сертификату MAX. Инцидент при подключении площадки 2026-07-30:
// после переезда на platform-api2 сертификат площадки выдан российским УЦ, и
// запрос падал на проверке ещё до отправки («unable to get local issuer
// certificate»). Здесь проверяется, что доверие включается только явным
// сертификатом из env и не расширяется на остальное приложение.
import {
  looksLikePem,
  maxDispatcher,
  normalizePem,
  resetMaxDispatcher,
} from './max-ca';

const PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIB0zCCAX2gAwIBAgIJAKZ0Nx0000000',
  '-----END CERTIFICATE-----',
].join('\n');

describe('max-ca', () => {
  const OLD = process.env.HEALTHY_ADULT_MAX_CA;
  beforeEach(() => resetMaxDispatcher());
  afterEach(() => {
    if (OLD === undefined) delete process.env.HEALTHY_ADULT_MAX_CA;
    else process.env.HEALTHY_ADULT_MAX_CA = OLD;
    resetMaxDispatcher();
  });

  describe('normalizePem', () => {
    it('разворачивает экранированные переводы строк из панели хостинга', () => {
      const raw =
        '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';
      expect(normalizePem(raw)).toBe(
        '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
      );
    });

    it('многострочный PEM оставляет как есть, только без краевых пробелов', () => {
      expect(normalizePem(`  ${PEM}\n `)).toBe(PEM);
    });
  });

  describe('looksLikePem', () => {
    it('узнаёт сертификат', () => {
      expect(looksLikePem(PEM)).toBe(true);
    });

    it('случайную строку сертификатом не считает', () => {
      expect(looksLikePem('путь/к/файлу.crt')).toBe(false);
    });
  });

  describe('maxDispatcher', () => {
    it('без env диспетчера нет — fetch идёт обычным путём', () => {
      delete process.env.HEALTHY_ADULT_MAX_CA;
      expect(maxDispatcher()).toBeUndefined();
    });

    it('мусор вместо сертификата не включает доверие', () => {
      process.env.HEALTHY_ADULT_MAX_CA = 'сертификат обязательно добавлю потом';
      expect(maxDispatcher()).toBeUndefined();
    });

    it('с сертификатом отдаёт диспетчер и переиспользует его', () => {
      process.env.HEALTHY_ADULT_MAX_CA = PEM;
      const first = maxDispatcher();
      expect(first).toBeDefined();
      // Один агент на процесс: новое соединение на каждый пост — лишняя трата.
      expect(maxDispatcher()).toBe(first);
    });

    it('принимает PEM с экранированными переводами строк', () => {
      process.env.HEALTHY_ADULT_MAX_CA = PEM.replace(/\n/g, '\\n');
      expect(maxDispatcher()).toBeDefined();
    });
  });
});
