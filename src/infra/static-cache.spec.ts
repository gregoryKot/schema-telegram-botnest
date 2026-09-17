// Политика кэширования статики (замер 2026-08-22: 857мс ревалидации на каждый
// запуск мини-аппа даже с тёплым кэшем). Тест держит границу: иммутабельным
// объявляется ТОЛЬКО то, чьё имя меняется вместе с содержимым.
import { cacheControlFor, IMMUTABLE, REVALIDATE } from './static-cache';

describe('cacheControlFor', () => {
  it('файл сборки с контент-хешем кэшируется на год', () => {
    expect(cacheControlFor('/assets/index-CTgJf44i.js')).toBe(IMMUTABLE);
    expect(cacheControlFor('/assets/vendor-react-DyVIWXff.js')).toBe(IMMUTABLE);
    expect(cacheControlFor('/assets/index-B7xKq2Lm.css')).toBe(IMMUTABLE);
    expect(cacheControlFor('/fonts/spectral-latin-a1B2c3D4.woff2')).toBe(
      IMMUTABLE,
    );
  });

  it('бандл мини-аппа без хеша в имени — только с ревалидацией', () => {
    // Хеш там запрещён правилом №13 (rename/rename у параллельных PR),
    // значит под тем же адресом завтра лежит другой код.
    expect(cacheControlFor('/app/assets/index.js')).toBe(REVALIDATE);
    expect(cacheControlFor('/app/assets/index.css')).toBe(REVALIDATE);
  });

  it('точки обновления приложения не залипают в кэше', () => {
    expect(cacheControlFor('/app/sw.js')).toBe(REVALIDATE);
    expect(cacheControlFor('/app/manifest.webmanifest')).toBe(REVALIDATE);
    expect(cacheControlFor('/manifest.webmanifest')).toBe(REVALIDATE);
    expect(cacheControlFor('/index.html')).toBe(REVALIDATE);
    expect(cacheControlFor('/app/index.html')).toBe(REVALIDATE);
  });

  it('контрольные образцы: похожее на хеш имя годовой кэш не получает', () => {
    // Словарные хвосты через дефис — не хеш сборки; ошибка здесь означала бы,
    // что правка файла не доедет до людей целый год.
    expect(cacheControlFor('/max-bridge.js')).toBe(REVALIDATE);
    expect(cacheControlFor('/add-icon.html')).toBe(REVALIDATE);
    expect(cacheControlFor('/telegram-web-app.js')).toBe(REVALIDATE);
    expect(cacheControlFor('/icon-192.png')).toBe(REVALIDATE);
    expect(cacheControlFor('/og-cover-v2.jpg')).toBe(REVALIDATE);
  });

  it('незнакомый путь получает безопасный дефолт, а не годовой кэш', () => {
    expect(cacheControlFor('/robots.txt')).toBe(REVALIDATE);
    expect(cacheControlFor('/')).toBe(REVALIDATE);
  });
});
