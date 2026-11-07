// Манифест PWA у корня сайта: «сохранить ярлык» с любой страницы
// schemehappens.ru ставит приложение. С 2026-10-17 оно открывает кабинет сайта
// (/today).
//
// Цвет оболочки (сплэш, статус-бар) — одна роль в четырёх местах, они обязаны
// совпадать (правило №4): manifest, два meta theme-color в index.html,
// THEME_BG.light в utils/theme.ts и токен --bg светлого блока index.css.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

describe('цвет оболочки PWA — один на все четыре места', () => {
  const bgToken = /--bg:\s*(#[0-9a-f]{6});/i.exec(read('./index.css'))?.[1];
  const themeBg = /light:\s*'(#[0-9a-f]{6})'/i.exec(read('./utils/theme.ts'))?.[1];
  const metaLight = /name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: light\)"/i.exec(indexHtml)?.[1];
  const metaDynamic = /id="theme-color-meta" content="(#[0-9a-f]{6})"/i.exec(indexHtml)?.[1];

  it('manifest: background_color = theme_color = --bg светлого блока', () => {
    expect(bgToken).toBeTruthy();
    expect(root.background_color).toBe(bgToken);
    expect(root.theme_color).toBe(bgToken);
  });

  it('index.html и THEME_BG.light — тот же цвет', () => {
    expect(metaLight).toBe(bgToken);
    expect(metaDynamic).toBe(bgToken);
    expect(themeBg).toBe(bgToken);
  });
});

describe('index.html', () => {
  it('ссылается на корневой манифест', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });
});
