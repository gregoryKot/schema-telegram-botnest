// Grep-трипваер (по образцу src/auth/table-registry.spec.ts) на правило
// CLAUDE.md «Обработка ошибок»:
//   - answerCbQuery() вызывается ДО обращения к БД/внешним сервисам в
//     bot.action(...) — иначе Telegram крутит вечный спиннер на кнопке;
//   - все bot.command(...)/bot.action(...) обёрнуты в try/catch;
//   - ошибки логируются через this.logger, не через console.log.
//
// Тест статически парсит исходники src/telegram/*.ts (без выполнения кода) —
// находит вызовы this.bot.command(...)/this.bot.action(...), вырезает тело
// async-колбэка балансировкой фигурных скобок и проверяет инварианты.
//
// TEST_COVERAGE_PLAN.md, этап 3, п.12.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = __dirname;
const SOURCE_FILES = readdirSync(DIR).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'),
);

interface Handler {
  file: string;
  kind: 'command' | 'action';
  name: string; // текст паттерна: 'settings:toggle' или /^addr:(ty|vy)$/
  body: string; // тело async (ctx) => { ... } целиком, включая фигурные скобки
}

// Захватывает this.bot.command(<pattern>, async (ctx) => { — паттерн это
// либо строковый литерал, либо regex-литерал без внутренних '/'
// (все паттерны в проекте такие — см. sanity-тест ниже).
const HANDLER_START_RE =
  /this\.bot\.(command|action)\(\s*(\/(?:[^\n/]|\\\/)*\/[a-z]*|'[^']*'|"[^"]*")\s*,\s*async\s*\(ctx\)\s*=>\s*\{/g;

function extractHandlers(file: string, src: string): Handler[] {
  const handlers: Handler[] = [];
  const re = new RegExp(HANDLER_START_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const kind = m[1] as 'command' | 'action';
    const name = m[2];
    const braceStart = re.lastIndex - 1; // индекс открывающей '{'
    let depth = 1;
    let i = braceStart + 1;
    while (depth > 0 && i < src.length) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    handlers.push({ file, kind, name, body: src.slice(braceStart, i) });
  }
  return handlers;
}

const allHandlers: Handler[] = [];
const sources: Record<string, string> = {};
for (const file of SOURCE_FILES) {
  const src = readFileSync(join(DIR, file), 'utf8');
  sources[file] = src;
  allHandlers.push(...extractHandlers(file, src));
}

// ── Ратчет-аллоулист ─────────────────────────────────────────────────────────
// Существующие нарушения на момент написания теста — их НЕТ (кодовая база
// уже следует правилу). Списки заведены на случай будущего дрейфа: если PR
// вносит нарушение, тест красный, если только имя хендлера не добавлено сюда
// осознанно с TODO на фикс. Списки могут только УМЕНЬШАТЬСЯ.
const TRY_CATCH_ALLOWLIST: string[] = []; // 'file.ts:kind:name'
const ANSWER_CB_ORDER_ALLOWLIST: string[] = []; // 'file.ts:kind:name'
const CONSOLE_LOG_ALLOWLIST: string[] = []; // 'file.ts'

function handlerKey(h: Handler): string {
  return `${h.file}:${h.kind}:${h.name}`;
}

describe('Telegram-хендлеры ↔ правило CLAUDE.md «Обработка ошибок»', () => {
  it('sanity: парсер находит хендлеры (регресс на «регекс сломался — 0 хендлеров, тест молча зелёный»)', () => {
    expect(allHandlers.length).toBeGreaterThanOrEqual(30);
    expect(allHandlers.some((h) => h.kind === 'command')).toBe(true);
    expect(allHandlers.some((h) => h.kind === 'action')).toBe(true);
  });

  it('ни один bot.command/bot.action не голый (try/catch обязателен)', () => {
    const violations = allHandlers
      .filter((h) => {
        const hasTry = /\btry\s*\{/.test(h.body);
        const hasCatch = /catch\s*\(/.test(h.body);
        return !(hasTry && hasCatch);
      })
      .filter((h) => !TRY_CATCH_ALLOWLIST.includes(handlerKey(h)))
      .map(
        (h) =>
          `${h.file}: ${h.kind}(${h.name}) — нет try/catch вокруг тела хендлера`,
      );
    expect(violations).toEqual([]);
  });

  // Сервисные свойства класса, обращение к которым — это поход в БД/внешний
  // сервис (имя оканчивается на "Service" или это сам this.prisma).
  const DB_CALL_RE = /await\s+this\.(\w*[Ss]ervice|prisma)\.[\w]+\(/;

  it('в каждом bot.action(...) answerCbQuery вызывается ДО первого обращения к БД/сервису', () => {
    const violations = allHandlers
      .filter((h) => h.kind === 'action')
      .flatMap((h) => {
        if (ANSWER_CB_ORDER_ALLOWLIST.includes(handlerKey(h))) return [];
        const cbIdx = h.body.indexOf('answerCbQuery');
        const dbMatch = h.body.match(DB_CALL_RE);
        const dbIdx = dbMatch ? h.body.indexOf(dbMatch[0]) : -1;
        if (cbIdx === -1) {
          return [
            `${h.file}: action(${h.name}) — нет answerCbQuery() в теле хендлера`,
          ];
        }
        if (dbIdx !== -1 && dbIdx < cbIdx) {
          return [
            `${h.file}: action(${h.name}) — обращение к БД/сервису (${dbMatch![0]}…) идёт ДО answerCbQuery() — риск вечного спиннера на кнопке`,
          ];
        }
        return [];
      });
    expect(violations).toEqual([]);
  });

  it('в src/telegram/ нет console.log (ошибки — только через this.logger)', () => {
    const violations = Object.entries(sources)
      .filter(([file]) => !CONSOLE_LOG_ALLOWLIST.includes(file))
      .filter(([, src]) => /console\.log\(/.test(src))
      .map(([file]) => `${file}: найден console.log — используй this.logger`);
    expect(violations).toEqual([]);
  });

  it('аллоулисты не разрослись тайно мимо кода — сверка размеров', () => {
    // Если этот тест начнёт падать из-за роста аллоулистов — значит кто-то
    // расширил список нарушений без явного ревью. Пороги = текущее
    // (нулевое) состояние; поднимать только осознанно, вместе с TODO.
    expect(TRY_CATCH_ALLOWLIST.length).toBe(0);
    expect(ANSWER_CB_ORDER_ALLOWLIST.length).toBe(0);
    expect(CONSOLE_LOG_ALLOWLIST.length).toBe(0);
  });
});
