// Тест гейта check-css-link-order.mjs (ревью волны 0 редизайна, 2026-11-09): порядок
// <link rel="stylesheet"> в собранном webapp/dist/index.html задаёт каскад правил с равной
// специфичностью, а меняет его разбиение на чанки, а не исходник. Песочница подсовывает
// фикстурный index.html вместо настоящей сборки — гейт просто читает файл по пути.
import { readFileSync } from 'fs';
import { runGate, cleanupTmp } from './gate-sandbox';

const link = (name: string, hash = 'AbCd1234') =>
  `<link rel="stylesheet" crossorigin href="/assets/${name}-${hash}.css">`;
const html = (...links: string[]) =>
  `<!doctype html><html><head><link rel="modulepreload" crossorigin href="/assets/index-Zz9_yY8x.js">${links.join('')}</head><body></body></html>`;
const PINNED = JSON.stringify({
  'webapp/dist/index.html': ['TherapyCaution', 'index', 'sheet-tasks'],
});

const files = (page: string) => ({
  'scripts/css-link-order.json': PINNED,
  'webapp/dist/index.html': page,
});

describe('check-css-link-order.mjs', () => {
  it('порядок совпал — exit 0; контент-хеш и не-CSS ссылки не считаются', () => {
    const res = runGate(
      'check-css-link-order.mjs',
      files(
        html(
          link('TherapyCaution', 'B02oy9gG'),
          link('index', 'dyto_Osq'),
          link('sheet-tasks'),
        ),
      ),
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('TherapyCaution → index → sheet-tasks');
  });

  it('файл переехал в другой чанк (перестановка) — exit 1 с «было → стало» и подсказкой', () => {
    const res = runGate(
      'check-css-link-order.mjs',
      files(html(link('index'), link('TherapyCaution'), link('sheet-tasks'))),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('было:  TherapyCaution → index → sheet-tasks');
    expect(res.stderr).toContain('стало: index → TherapyCaution → sheet-tasks');
    expect(res.stderr).toContain('--update');
  });

  it('новый CSS-чанк в стартовой странице (ExScreen.css раньше index.css) — exit 1', () => {
    const res = runGate(
      'check-css-link-order.mjs',
      files(
        html(
          link('TherapyCaution'),
          link('ExScreen'),
          link('index'),
          link('sheet-tasks'),
        ),
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('ExScreen');
  });

  it('нет сборки — exit 1 с подсказкой собрать, а не молчание', () => {
    const res = runGate('check-css-link-order.mjs', {
      'scripts/css-link-order.json': PINNED,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('нет webapp/dist/index.html');
  });

  it('нет закреплённого списка — exit 1', () => {
    const res = runGate('check-css-link-order.mjs', {
      'webapp/dist/index.html': html(link('index')),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('--update');
  });

  it('--update закрепляет текущий порядок', () => {
    const res = runGate(
      'check-css-link-order.mjs',
      { 'webapp/dist/index.html': html(link('a'), link('b')) },
      { args: ['--update'], keepTmp: true },
    );
    try {
      expect(res.status).toBe(0);
      const written = JSON.parse(
        readFileSync(`${res.tmp}/scripts/css-link-order.json`, 'utf8'),
      ) as Record<string, string[]>;
      expect(written['webapp/dist/index.html']).toEqual(['a', 'b']);
    } finally {
      cleanupTmp(res.tmp);
    }
  });
});
