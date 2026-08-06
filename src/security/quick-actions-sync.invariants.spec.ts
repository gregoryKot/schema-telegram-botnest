// Security-трипваер: рассинхрон реестра пунктов меню «плюс» между фронтом и
// бэком (правило №4 CLAUDE.md — денормализованные/дублированные реестры,
// обязанные совпадать, фиксируются тестом-сверкой). Бэкенд валидирует
// meta.action по allow-list QUICK_ACTION_IDS (src/analytics/quick-actions.constants.ts);
// фронт заводит парную константу QUICK_ACTION_IDS в
// schema-miniapp/src/utils/quickActions.ts. Расхождение молча роняет
// метрику (сервер отбросит meta.action) или ломает UI (фронт покажет пункт,
// который бэк не признаёт валидным действием).
//
// ВАЖНО: если фронтовый файл ещё не создан (параллельная работа над меню
// «плюс» не доехала до этой ветки), тест падает громко — с понятным
// сообщением, а НЕ пропускается молча. Гейт не должен молчать.
import { readFileSync } from 'fs';
import { join } from 'path';
import { QUICK_ACTION_IDS } from '../analytics/quick-actions.constants';

const ROOT = join(__dirname, '..', '..');
const FRONTEND_REL = 'schema-miniapp/src/utils/quickActions.ts';
const FRONTEND_PATH = join(ROOT, FRONTEND_REL);

// Вырезает блок `QUICK_ACTION_IDS = [ ... ]` и достаёт строковые литералы id.
function extractFrontendIds(src: string): string[] {
  const blockMatch = src.match(
    /QUICK_ACTION_IDS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/,
  );
  if (!blockMatch) {
    throw new Error(
      `Не нашли массив QUICK_ACTION_IDS = [...] в ${FRONTEND_REL}. ` +
        'Проверь, что константа называется именно так и объявлена как ' +
        'обычный массив-литерал (по образцу бэкендного quick-actions.constants.ts).',
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
      `Не найден файл ${FRONTEND_REL}. Бэкендный реестр QUICK_ACTION_IDS ` +
        '(src/analytics/quick-actions.constants.ts) ожидает парную константу ' +
        'на фронте — без неё сверка невозможна. Если файл ещё не доехал от ' +
        'параллельного агента, это ожидаемый красный тест до интеграции фронта.',
    );
  }
  return extractFrontendIds(src);
}

describe('трипваер: QUICK_ACTION_IDS фронта и бэка совпадают (правило №4)', () => {
  it('бэкендный реестр непуст и без дублей (санити перед сверкой)', () => {
    expect(QUICK_ACTION_IDS.length).toBeGreaterThan(0);
    expect(new Set(QUICK_ACTION_IDS).size).toBe(QUICK_ACTION_IDS.length);
  });

  it('каждый id бэкенда есть на фронте', () => {
    const frontend = new Set(readFrontendIds());
    const missing = QUICK_ACTION_IDS.filter((id) => !frontend.has(id));
    expect(missing).toEqual([]);
  });

  it('каждый id фронта есть в бэкендном allow-list (обратная сверка)', () => {
    const frontend = readFrontendIds();
    const backend = new Set<string>(QUICK_ACTION_IDS);
    const extra = frontend.filter((id) => !backend.has(id));
    expect(extra).toEqual([]);
  });

  it('на фронте нет дублей id', () => {
    const frontend = readFrontendIds();
    expect(new Set(frontend).size).toBe(frontend.length);
  });
});
