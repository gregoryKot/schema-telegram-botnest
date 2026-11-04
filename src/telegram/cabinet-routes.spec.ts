// Правило №4: пути кабинета, которые строит бот, обязаны быть роутами сайта
// (webapp/src/App.tsx). Иначе кнопка уведомления упрётся в редирект «*».
import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_URL, CABINET_URL, CABINET_HELP_URL } from './telegram.constants';

const app = readFileSync(join(__dirname, '../../webapp/src/App.tsx'), 'utf8');
const declared = new Set(
  [...app.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]),
);

describe('адреса кабинета в кнопках бота совпадают с роутами сайта', () => {
  it.each([
    ['CABINET_URL', CABINET_URL],
    ['CABINET_HELP_URL', CABINET_HELP_URL],
  ])('%s — объявленный роут webapp/src/App.tsx', (_name, url) => {
    expect(url.startsWith(`${APP_URL}/`)).toBe(true);
    const path = url.slice(APP_URL.length);
    expect(declared.has(path)).toBe(true);
  });
});
