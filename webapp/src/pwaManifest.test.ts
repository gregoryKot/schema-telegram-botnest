// Манифест PWA у корня сайта: «сохранить ярлык» с любой страницы
// schemehappens.ru ставит приложение, а не ужатую десктопную вёрстку.
// start_url ведёт в мини-апп /app/ (docs/PWA_PLAN.md: база установки — он).
// Тест-сверка (правило №4: два места, обязанные совпадать): корневой манифест
// и манифест мини-аппа (schema-miniapp/dist, собирается vite-plugin-pwa из
// schema-miniapp/vite.config.ts) описывают ОДНО приложение — одинаковые
// identity (id/start_url) и имя, иначе браузер увидит два разных приложения.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_MANIFEST_PATH = resolve(__dirname, '../public/manifest.webmanifest');
const MINIAPP_MANIFEST_PATH = resolve(
  __dirname,
  '../../schema-miniapp/dist/manifest.webmanifest',
);

interface Manifest {
  name: string;
  id?: string;
  start_url: string;
  scope: string;
  display: string;
  icons: Array<{ src: string; sizes: string }>;
}

const root = JSON.parse(readFileSync(ROOT_MANIFEST_PATH, 'utf8')) as Manifest;
const miniapp = JSON.parse(
  readFileSync(MINIAPP_MANIFEST_PATH, 'utf8'),
) as Manifest;

describe('корневой manifest.webmanifest', () => {
  it('ведёт в приложение: start_url и id — /app/', () => {
    expect(root.start_url).toBe('/app/');
    // id без явного значения по спецификации равен start_url — у мини-аппа
    // он не задан, поэтому у корня обязан быть ровно '/app/'.
    expect(root.id).toBe('/app/');
  });

  it('scope покрывает страницу установки (весь сайт)', () => {
    expect(root.scope).toBe('/');
    expect(root.display).toBe('standalone');
  });

  it('иконки существуют в webapp/public', () => {
    expect(root.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of root.icons) {
      const file = resolve(__dirname, '../public', icon.src.replace(/^\//, ''));
      expect(() => readFileSync(file)).not.toThrow();
    }
  });

  it('описывает то же приложение, что манифест мини-аппа', () => {
    expect(root.name).toBe(miniapp.name);
    expect(root.start_url).toBe(miniapp.start_url);
    // У мини-аппа id не задан → равен его start_url; сверка выше это и пинит.
    expect(miniapp.id ?? miniapp.start_url).toBe(root.id);
  });
});

describe('index.html', () => {
  it('ссылается на корневой манифест', () => {
    const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });
});
