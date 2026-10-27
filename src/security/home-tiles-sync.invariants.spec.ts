// Трипваер: плитки главной «Сегодня» на фронте и бэке (правило №4 CLAUDE.md).
// Бэкенд валидирует meta.tile по HOME_TILES (src/analytics/home-events.constants.ts),
// фронт держит тип HomeTile в shared/src/analytics/homeTile.ts. Расхождение
// молча роняет метрику: сервер отбросит неизвестную плитку.
// Файл фронта не найден или не разобран — тест падает громко, а не пропускается.
import { readFileSync } from 'fs';
import { join } from 'path';
import { HOME_EVENTS, HOME_TILES } from '../analytics/home-events.constants';

const ROOT = join(__dirname, '..', '..');
const FRONTEND_REL = 'shared/src/analytics/homeTile.ts';

function readFrontend(): string {
  try {
    return readFileSync(join(ROOT, FRONTEND_REL), 'utf8');
  } catch {
    throw new Error(
      `Не найден файл ${FRONTEND_REL}: сверка HOME_TILES невозможна.`,
    );
  }
}

// Достаёт строковые литералы из `export type HomeTile = | 'a' | 'b';`.
function extractFrontendTiles(src: string): string[] {
  const m = src.match(/export type HomeTile\s*=([^;]+);/);
  if (!m) {
    throw new Error(`Не нашли union-тип HomeTile в ${FRONTEND_REL}.`);
  }
  const ids: string[] = [];
  const re = /['"]([a-z][a-z0-9_]*)['"]/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m[1]))) ids.push(x[1]);
  return ids;
}

describe('трипваер: HomeTile фронта и HOME_TILES бэка совпадают (правило №4)', () => {
  it('бэкендный реестр непуст и без дублей', () => {
    expect(HOME_TILES.length).toBeGreaterThan(0);
    expect(new Set(HOME_TILES).size).toBe(HOME_TILES.length);
  });

  it('каждая плитка бэкенда есть на фронте', () => {
    const frontend = new Set(extractFrontendTiles(readFrontend()));
    expect(HOME_TILES.filter((t) => !frontend.has(t))).toEqual([]);
  });

  it('каждая плитка фронта есть в allow-list бэка', () => {
    const backend = new Set<string>(HOME_TILES);
    expect(
      extractFrontendTiles(readFrontend()).filter((t) => !backend.has(t)),
    ).toEqual([]);
  });

  it('на фронте нет дублей плиток', () => {
    const frontend = extractFrontendTiles(readFrontend());
    expect(new Set(frontend).size).toBe(frontend.length);
  });

  it('имя события на фронте (HOME_TILE_EVENT) входит в HOME_EVENTS бэка', () => {
    const m = readFrontend().match(/HOME_TILE_EVENT\s*=\s*['"]([a-z_]+)['"]/);
    expect(m).not.toBeNull();
    expect((HOME_EVENTS as readonly string[]).includes(m![1])).toBe(true);
  });
});
