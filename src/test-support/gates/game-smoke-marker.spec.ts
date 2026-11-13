// Гейт: маркер игры в шаге `/game/` смока прода (prod-smoke.yml) совпадает с
// game/index.html (правило №20, инцидент 2026-11-13: переименование игры в
// #1096 покрасило смок живого прода на «Schema Runner», смок красный ~14 ч).
// Правила — game-smoke-marker.ts; здесь оба исхода на образцах и прогон по
// настоящим файлам.
import { readFileSync } from 'fs';
import { join } from 'path';
import { gameMarkerProblems, gameSmokeMarker } from './game-smoke-marker';

const read = (...p: string[]) =>
  readFileSync(join(process.cwd(), ...p), 'utf8');

const smoke = (grep: string, comment = '') =>
  [
    'jobs:',
    '  prod-smoke:',
    '    runs-on: ubuntu-26.04',
    '    steps:',
    '      - name: /game/ — 200 и реально раздаёт игру',
    '        run: |',
    comment,
    '          body=$($CURL https://schemehappens.ru/game/)',
    `          echo "$body" | ${grep}`,
    '  alarm:',
    '    runs-on: ubuntu-26.04',
    '',
  ]
    .filter((l) => l !== '')
    .join('\n') + '\n';

describe('гейт: маркер игры в смоке прода', () => {
  describe('образцы', () => {
    it('вытаскивает маркер из grep -qF шага /game/', () => {
      expect(gameSmokeMarker(smoke(`grep -qF 'id="game-container"'`))).toBe(
        'id="game-container"',
      );
    });

    it('комментарий с чужим grep не принимается за маркер', () => {
      const yml = smoke(
        `grep -qF 'id="game-container"'`,
        `          # было: grep -qF 'Schema Runner'`,
      );
      expect(gameSmokeMarker(yml)).toBe('id="game-container"');
    });

    it('grep без -F — ошибка: маркер обязан быть фиксированной строкой', () => {
      expect(() => gameSmokeMarker(smoke(`grep -q 'Schema Runner'`))).toThrow(
        /grep -qF/,
      );
    });

    it('шага /game/ нет — ошибка', () => {
      expect(() =>
        gameSmokeMarker(
          'jobs:\n  prod-smoke:\n    steps:\n      - name: / — 200\n        run: echo\n  alarm:\n    steps: []\n',
        ),
      ).toThrow(/нет шага/);
    });

    it('переименованная игра: заголовок как маркер ломается, узел — нет', () => {
      const game =
        '<title>Сквозь голову</title><div id="game-container"></div>';
      const site = '<title>Всё по схеме</title><div id="root"></div>';
      expect(gameMarkerProblems('Schema Runner', game, site)).toEqual([
        expect.stringContaining('нет в game/index.html'),
      ]);
      expect(gameMarkerProblems('id="game-container"', game, site)).toEqual([]);
    });

    it('маркер, который есть и на сайте, не отличает игру от fallback', () => {
      const html = '<div id="root"></div><meta charset="UTF-8">';
      expect(gameMarkerProblems('meta charset="UTF-8"', html, html)).toEqual([
        expect.stringContaining('есть в webapp/index.html'),
      ]);
    });
  });

  describe('настоящие файлы', () => {
    const marker = gameSmokeMarker(
      read('.github', 'workflows', 'prod-smoke.yml'),
    );

    it('маркер есть в game/index.html и нет в webapp/index.html', () => {
      expect(
        gameMarkerProblems(
          marker,
          read('game', 'index.html'),
          read('webapp', 'index.html'),
        ),
      ).toEqual([]);
    });
  });
});
