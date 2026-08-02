// Доверие сертификату MAX. Инцидент при подключении площадки 2026-07-30:
// после переезда на platform-api2 сертификат площадки выдан российским УЦ, и
// запрос падал на проверке ещё до отправки («unable to get local issuer
// certificate»). Инцидент 2026-07-31: корень, который ехал через env, до
// приложения так и не доехал — теперь он лежит файлом в репозитории, а env
// остался перекрытием. Здесь проверяется, что доверие включается корнем и не
// расширяется на остальное приложение.
import {
  looksLikePem,
  maxCa,
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
    it('без env корень берётся из репозитория — доверие работает само', () => {
      delete process.env.HEALTHY_ADULT_MAX_CA;
      expect(maxDispatcher()).toBeDefined();
    });

    it('мусор в env не отменяет рабочий корень из файла', () => {
      process.env.HEALTHY_ADULT_MAX_CA = 'сертификат обязательно добавлю потом';
      expect(maxDispatcher()).toBeDefined();
      expect(maxCa().source).toBe('файл');
    });

    it('один агент на процесс — новое соединение на каждый пост лишнее', () => {
      const first = maxDispatcher();
      expect(maxDispatcher()).toBe(first);
    });

    it('битый PEM в env доверия не включает — источника корня нет', () => {
      process.env.HEALTHY_ADULT_MAX_CA = PEM.replace(/\n/g, '\\n');
      expect(maxCa().pem).toBeNull();
      expect(maxDispatcher()).toBeUndefined();
    });
  });
});
