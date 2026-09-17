// Security-трипваер: рассинхрон реестра ключей кастомизации мини-аппа
// между фронтом и бэком (правило №4 CLAUDE.md — денормализованные/
// дублированные реестры, обязанные совпадать, фиксируются тестом-сверкой).
// Бэкенд валидирует/хранит только ключи из SYNCED_PREF_KEYS
// (src/api/ui-prefs.sanitize.ts); фронт заводит парную константу
// SYNCED_PREF_KEYS в schema-miniapp/src/utils/uiPrefsSync.ts. Расхождение
// молча роняет синхронизацию: сервер отбросит ключ, которого не знает, или
// фронт будет ждать ключ, который бэк никогда не сохранит.
//
// ВАЖНО: если фронтовый файл ещё не создан (параллельная работа над
// синхронизацией настроек не доехала до этой ветки), тест падает громко — с
// понятным сообщением, а НЕ пропускается молча. Гейт не должен молчать.
import { readFileSync } from 'fs';
import { join } from 'path';
import { SYNCED_PREF_KEYS } from '../api/ui-prefs.sanitize';

const ROOT = join(__dirname, '..', '..');
const FRONTEND_REL = 'schema-miniapp/src/utils/uiPrefsSync.ts';
const FRONTEND_PATH = join(ROOT, FRONTEND_REL);

// Вырезает блок `SYNCED_PREF_KEYS = [ ... ]` и достаёт строковые литералы.
function extractFrontendKeys(src: string): string[] {
  const blockMatch = src.match(
    /SYNCED_PREF_KEYS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/,
  );
  if (!blockMatch) {
    throw new Error(
      `Не нашли массив SYNCED_PREF_KEYS = [...] в ${FRONTEND_REL}. ` +
        'Проверь, что константа называется именно так и объявлена как ' +
        'обычный массив-литерал (по образцу бэкендного src/api/ui-prefs.sanitize.ts).',
    );
  }
  const keys: string[] = [];
  const keyRe = /['"]([a-z][a-z0-9_]*)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(blockMatch[1]))) keys.push(m[1]);
  return keys;
}

function readFrontendKeys(): string[] {
  let src: string;
  try {
    src = readFileSync(FRONTEND_PATH, 'utf8');
  } catch {
    throw new Error(
      `Не найден файл ${FRONTEND_REL}. Бэкендный реестр SYNCED_PREF_KEYS ` +
        '(src/api/ui-prefs.sanitize.ts) ожидает парную константу на фронте ' +
        '— без неё сверка невозможна. Если файл ещё не доехал от ' +
        'параллельного агента, это ожидаемый красный тест до интеграции фронта.',
    );
  }
  return extractFrontendKeys(src);
}

describe('трипваер: SYNCED_PREF_KEYS фронта и бэка совпадают (правило №4)', () => {
  it('бэкендный реестр непуст и без дублей (санити перед сверкой)', () => {
    expect(SYNCED_PREF_KEYS.length).toBeGreaterThan(0);
    expect(new Set(SYNCED_PREF_KEYS).size).toBe(SYNCED_PREF_KEYS.length);
  });

  it('бэкендный реестр — ровно 14 ключей зафиксированного контракта', () => {
    expect(SYNCED_PREF_KEYS.length).toBe(14);
  });

  it('каждый ключ бэкенда есть на фронте', () => {
    const frontend = new Set(readFrontendKeys());
    const missing = SYNCED_PREF_KEYS.filter((key) => !frontend.has(key));
    expect(missing).toEqual([]);
  });

  it('каждый ключ фронта есть в бэкендном allow-list (обратная сверка)', () => {
    const frontend = readFrontendKeys();
    const backend = new Set<string>(SYNCED_PREF_KEYS);
    const extra = frontend.filter((key) => !backend.has(key));
    expect(extra).toEqual([]);
  });

  it('на фронте нет дублей ключей', () => {
    const frontend = readFrontendKeys();
    expect(new Set(frontend).size).toBe(frontend.length);
  });
});
