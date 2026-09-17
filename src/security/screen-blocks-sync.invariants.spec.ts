// Security-трипваер: рассинхрон реестра блоков экранов «Профиль»/«Паттерны»
// между фронтом и бэком (правило №4 CLAUDE.md — денормализованные/
// дублированные реестры, обязанные совпадать, фиксируются тестом-сверкой).
// Бэкенд валидирует meta.block по allow-list SCREEN_BLOCK_IDS
// (src/analytics/screen-blocks.constants.ts); фронт заводит парную константу
// SCREEN_BLOCK_IDS в schema-miniapp/src/utils/screenBlocks.ts. Расхождение
// молча роняет метрику (сервер отбросит meta.block) или ломает UI (фронт
// покажет блок, который бэк не признаёт валидным).
//
// ВАЖНО: если фронтовый файл ещё не создан (параллельная работа над
// настройкой экранов не доехала до этой ветки), тест падает громко — с
// понятным сообщением, а НЕ пропускается молча. Гейт не должен молчать.
import { readFileSync } from 'fs';
import { join } from 'path';
import { SCREEN_BLOCK_IDS } from '../analytics/screen-blocks.constants';

const ROOT = join(__dirname, '..', '..');
const FRONTEND_REL = 'schema-miniapp/src/utils/screenBlocks.ts';
const FRONTEND_PATH = join(ROOT, FRONTEND_REL);

// Вырезает блок `SCREEN_BLOCK_IDS = [ ... ]` и достаёт строковые литералы id.
function extractFrontendIds(src: string): string[] {
  const blockMatch = src.match(
    /SCREEN_BLOCK_IDS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/,
  );
  if (!blockMatch) {
    throw new Error(
      `Не нашли массив SCREEN_BLOCK_IDS = [...] в ${FRONTEND_REL}. ` +
        'Проверь, что константа называется именно так и объявлена как ' +
        'обычный массив-литерал (по образцу бэкендного screen-blocks.constants.ts).',
    );
  }
  const ids: string[] = [];
  const idRe = /['"]([a-z][a-z0-9_]*)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(blockMatch[1]))) ids.push(m[1]);
  return ids;
}

function readFrontendIds(): string[] {
  let src: string;
  try {
    src = readFileSync(FRONTEND_PATH, 'utf8');
  } catch {
    throw new Error(
      `Не найден файл ${FRONTEND_REL}. Бэкендный реестр SCREEN_BLOCK_IDS ` +
        '(src/analytics/screen-blocks.constants.ts) ожидает парную константу ' +
        'на фронте — без неё сверка невозможна. Если файл ещё не доехал от ' +
        'параллельного агента, это ожидаемый красный тест до интеграции фронта.',
    );
  }
  return extractFrontendIds(src);
}

describe('трипваер: SCREEN_BLOCK_IDS фронта и бэка совпадают (правило №4)', () => {
  it('бэкендный реестр непуст и без дублей (санити перед сверкой)', () => {
    expect(SCREEN_BLOCK_IDS.length).toBeGreaterThan(0);
    expect(new Set(SCREEN_BLOCK_IDS).size).toBe(SCREEN_BLOCK_IDS.length);
  });

  it('каждый id бэкенда есть на фронте', () => {
    const frontend = new Set(readFrontendIds());
    const missing = SCREEN_BLOCK_IDS.filter((id) => !frontend.has(id));
    expect(missing).toEqual([]);
  });

  it('каждый id фронта есть в бэкендном allow-list (обратная сверка)', () => {
    const frontend = readFrontendIds();
    const backend = new Set<string>(SCREEN_BLOCK_IDS);
    const extra = frontend.filter((id) => !backend.has(id));
    expect(extra).toEqual([]);
  });

  it('на фронте нет дублей id', () => {
    const frontend = readFrontendIds();
    expect(new Set(frontend).size).toBe(frontend.length);
  });
});
