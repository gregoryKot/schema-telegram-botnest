// Манифест PWA у корня сайта: «сохранить ярлык» с любой страницы
// schemehappens.ru ставит приложение. С 2026-10-17 оно открывает кабинет сайта
// (/today).
//
// Цвет оболочки (сплэш, статус-бар) — одна роль в четырёх местах, они обязаны
// совпадать (правило №4): manifest, два meta theme-color в index.html,
// THEME_BG.light в utils/theme.ts и токен --bg светлого блока index.css.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');

interface Manifest {
  name: string;
  id?: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: Array<{ src: string; sizes: string; purpose?: string }>;
}

const root = JSON.parse(read('../public/manifest.webmanifest')) as Manifest;

/** Заголовок PNG (IHDR): ширина, высота и есть ли альфа (тип цвета 4 или 6). */
function png(src: string) {
  const buf = readFileSync(resolve(__dirname, '../public', src.replace(/^\//, '')));
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: (buf[25] & 4) !== 0 };
}
const indexHtml = read('../index.html');

describe('корневой manifest.webmanifest', () => {
  it('ведёт в кабинет сайта: start_url /today, собственный id', () => {
    expect(root.start_url).toBe('/today');
    expect(root.id).toBe('/');
  });

  it('scope покрывает страницу установки (весь сайт)', () => {
    expect(root.scope).toBe('/');
    expect(root.display).toBe('standalone');
  });

  it('иконки существуют в webapp/public, размер PNG = sizes в манифесте', () => {
    expect(root.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of root.icons) {
      const { w, h } = png(icon.src);
      expect(`${w}x${h}`).toBe(icon.sizes);
    }
  });

  // Маску накладывает система (maskable у Android, скругление apple-touch-icon у iOS), а
  // прозрачное под ней красится чёрным. PNG собирает scripts/generate-pwa-icons.mjs.
  it('maskable и apple-touch-icon непрозрачные, apple-touch-icon — 180×180 как в index.html', () => {
    const maskable = root.icons.find((i) => i.purpose === 'maskable');
    expect(maskable).toBeTruthy();
    expect(png(maskable!.src).alpha).toBe(false);
    expect(indexHtml).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
    expect(png('/apple-touch-icon.png')).toEqual({ w: 180, h: 180, alpha: false });
  });

  it('favicon-96.png — 96×96, как в index.html', () => {
    expect(indexHtml).toContain('<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png" />');
    expect(png('/favicon-96.png')).toMatchObject({ w: 96, h: 96 });
  });
});

describe('цвет оболочки PWA — один на все места', () => {
  const css = read('./index.css');
  const bgToken = /--bg:\s*(#[0-9a-f]{6});/i.exec(css)?.[1];
  const bgDark = /html\[data-theme="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6});/i.exec(css)?.[1];
  const metaLight = /name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: light\)"/i.exec(indexHtml)?.[1];
  const metaDark = /name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: dark\)"/i.exec(indexHtml)?.[1];
  const metaDynamic = /id="theme-color-meta" content="(#[0-9a-f]{6})"/i.exec(indexHtml)?.[1];

  it('manifest: background_color = theme_color = --bg светлого блока', () => {
    expect(bgToken).toBeTruthy();
    expect(root.background_color).toBe(bgToken);
    expect(root.theme_color).toBe(bgToken);
  });

  it('index.html — тот же цвет, что --bg светлого блока', () => {
    expect(metaLight).toBe(bgToken);
    expect(metaDynamic).toBe(bgToken);
  });

  // theme.ts своего литерала не держит: читает --bg; theme.test.ts берёт его значения из index.css.
  it('тёмная meta theme-color в index.html = --bg тёмного блока', () => {
    expect(bgDark).toBeTruthy();
    expect(metaDark).toBe(bgDark);
  });
});

describe('index.html', () => {
  it('ссылается на корневой манифест', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });
});

// Картинки запуска iOS: PNG и блок тегов пишет scripts/generate-ios-splash.mjs. iOS берёт
// картинку только при точном совпадении её размера с экраном — иначе пустой кадр.
describe('картинки запуска iOS (apple-touch-startup-image)', () => {
  const tags = [...indexHtml.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)" media="([^"]+)" \/>/g)].map(
    ([, href, media]) => {
      const num = (re: RegExp) => Number(re.exec(media)?.[1]);
      return {
        href,
        media,
        w: num(/\(device-width: (\d+)px\)/),
        h: num(/\(device-height: (\d+)px\)/),
        dpr: num(/\(-webkit-device-pixel-ratio: (\d)\)/),
        theme: /\(prefers-color-scheme: (light|dark)\)/.exec(media)?.[1],
      };
    },
  );

  it('каждому тегу соответствует PNG размером «экран × плотность», без альфы', () => {
    expect(tags.length).toBeGreaterThanOrEqual(30);
    for (const t of tags) {
      expect(t.media).toContain('(orientation: portrait)');
      expect(png(t.href), t.href).toEqual({ w: t.w * t.dpr, h: t.h * t.dpr, alpha: false });
    }
  });

  it('у каждого экрана есть светлая и тёмная картинка, условия не повторяются', () => {
    const screens = new Set(tags.map((t) => `${t.w}x${t.h}@${t.dpr}`));
    for (const theme of ['light', 'dark']) {
      expect(new Set(tags.filter((t) => t.theme === theme).map((t) => `${t.w}x${t.h}@${t.dpr}`))).toEqual(screens);
    }
    expect(new Set(tags.map((t) => t.media)).size).toBe(tags.length);
  });

  it('в папке нет файлов без тега, общий вес — до 500 КБ', () => {
    const dir = resolve(__dirname, '../public/splash');
    const files = readdirSync(dir);
    expect(files.map((f) => `/splash/${f}`).sort()).toEqual(tags.map((t) => t.href).sort());
    expect(files.reduce((sum, f) => sum + statSync(resolve(dir, f)).size, 0)).toBeLessThan(500 * 1024);
  });
});
