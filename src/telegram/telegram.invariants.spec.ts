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

/** Индекс сразу за `}`, закрывающей блок, который открывает `{` на open. */
function blockEnd(src: string, open: number): number {
  let depth = 1;
  let i = open + 1;
  while (depth > 0 && i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return i;
}

/** Блоки ВНЕШНЕГО try и его catch в теле хендлера (null — нет пары). */
function outerTryCatch(
  body: string,
): { tryBlock: string; catchBlock: string } | null {
  const tryM = /\btry\s*\{/.exec(body);
  if (!tryM) return null;
  const tryOpen = tryM.index + tryM[0].length - 1;
  const tryEnd = blockEnd(body, tryOpen);
  const catchM = /^\s*catch\s*(?:\([^)]*\))?\s*\{/.exec(body.slice(tryEnd));
  if (!catchM) return null;
  const catchOpen = tryEnd + catchM[0].length - 1;
  return {
    tryBlock: body.slice(tryOpen, tryEnd),
    catchBlock: body.slice(catchOpen, blockEnd(body, catchOpen)),
  };
}

/**
 * Хендлер отвечает на нажатие в try и снова — в catch. Второй ответ Telegram
 * отклоняет (спиннер уже погашен), а staleUpdateGuard молча глотает ошибку:
 * человек не видит исхода (аудит 2026-10). Исход сообщают editMessageText/reply
 * (callback-failure.ts). Ищется ВНЕШНИЙ try тела хендлера.
 */
function repeatsAnswerInCatch(body: string): boolean {
  const pair = outerTryCatch(body);
  return (
    !!pair &&
    pair.tryBlock.includes('answerCbQuery') &&
    pair.catchBlock.includes('answerCbQuery')
  );
}

// Исход сбоя человеку: хелпер callback-failure.ts или прямой ответ в чат.
const OUTCOME_RE =
  /\b(failCallback|failSettings)\(|\bctx\s*\.\s*(reply\w*|editMessageText)\(/;

/**
 * catch внешнего try без исхода — только лог. Спиннер уже погашен
 * answerCbQuery, и человек, не увидев ничего, решает, что нажатие сработало
 * (аудит 2026-10: квиз и `notify:pause:cancel`).
 */
function catchWithoutOutcome(body: string): boolean {
  const pair = outerTryCatch(body);
  return !!pair && !OUTCOME_RE.test(pair.catchBlock);
}

// Кнопки, которые больше никто не шлёт (их нет ни в одной клавиатуре — только
// под старыми сообщениями): сбой там — отказ удалить/перерисовать старое
// сообщение, а «попробовать ещё раз» упрётся в тот же отказ. Список может
// только сокращаться; новую кнопку сюда не добавлять.
const NO_OUTCOME_ALLOWLIST = [
  "telegram.service.ts:action:'cancel'",
  "telegram.service.ts:action:'back:welcome'",
];

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

  it('answerCbQuery в try ⇒ в catch его нет: исход сбоя сообщается через editMessageText/reply', () => {
    const violations = allHandlers
      .filter((h) => h.kind === 'action' && repeatsAnswerInCatch(h.body))
      .map(
        (h) =>
          `${h.file}: action(${h.name}) — повторный answerCbQuery в catch: ` +
          `Telegram его отклонит, человек не увидит сбоя; ` +
          `используй failCallback/failSettings (callback-failure.ts)`,
      );
    expect(violations).toEqual([]);
  });

  it('контроль: предикат краснеет на повторе и молчит на допустимых формах', () => {
    const repeat = `{ try { await ctx.answerCbQuery(); await x(); } catch (e) { await ctx.answerCbQuery('x').catch(() => null); } }`;
    expect(repeatsAnswerInCatch(repeat)).toBe(true);
    // вложенные блоки до catch не сбивают поиск catch внешнего try
    const nested = `{ try { await ctx.answerCbQuery(); if (a) { b(); } } catch { await ctx.answerCbQuery('x'); } }`;
    expect(repeatsAnswerInCatch(nested)).toBe(true);
    // quiz-форма: единственный ответ в try под .catch, в catch только лог
    const quiz = `{ try { await ctx.answerCbQuery().catch(() => null); await go(); } catch (e) { this.logger.error('q', e); } }`;
    expect(repeatsAnswerInCatch(quiz)).toBe(false);
    // исход через reply — норма
    const reply = `{ try { await ctx.answerCbQuery(); } catch (e) { await ctx.reply('x').catch(() => null); } }`;
    expect(repeatsAnswerInCatch(reply)).toBe(false);
    // ответ только в catch (первый и единственный) — не повтор
    const onlyCatch = `{ try { await go(); } catch (e) { await ctx.answerCbQuery('x'); } }`;
    expect(repeatsAnswerInCatch(onlyCatch)).toBe(false);
  });

  it('в catch каждого bot.action есть исход для человека, а не только лог', () => {
    const violations = allHandlers
      .filter((h) => h.kind === 'action' && catchWithoutOutcome(h.body))
      .filter((h) => !NO_OUTCOME_ALLOWLIST.includes(handlerKey(h)))
      .map(
        (h) =>
          `${h.file}: action(${h.name}) — catch только пишет в лог, человек ` +
          `не видит исхода; используй failCallback/failSettings (callback-failure.ts)`,
      );
    expect(violations).toEqual([]);
  });

  it('аллоулист «без исхода» указывает на живые хендлеры и только сокращается', () => {
    const keys = allHandlers.map(handlerKey);
    for (const k of NO_OUTCOME_ALLOWLIST) expect(keys).toContain(k);
    expect(NO_OUTCOME_ALLOWLIST.length).toBeLessThanOrEqual(2);
  });

  it('контроль: «без исхода» краснеет на голом логе и молчит на исходе', () => {
    const logOnly = `{ try { await ctx.answerCbQuery(); await go(); } catch (err) { this.logger.error('x', err); } }`;
    expect(catchWithoutOutcome(logOnly)).toBe(true);
    const helper = `{ try { await go(); } catch (err) { await failCallback(this.logger, ctx, 'x', err); } }`;
    expect(catchWithoutOutcome(helper)).toBe(false);
    const edit = `{ try { await go(); } catch (err) { await ctx\n  .editMessageText(ERROR_RETRY).catch(() => null); } }`;
    expect(catchWithoutOutcome(edit)).toBe(false);
    const reply = `{ try { await go(); } catch { await ctx.reply('x'); } }`;
    expect(catchWithoutOutcome(reply)).toBe(false);
  });

  it('callback-failure.ts не зовёт answerCbQuery (иначе повтор спрятался бы в хелпере от инварианта)', () => {
    expect(sources['callback-failure.ts']).toBeDefined();
    const code = sources['callback-failure.ts'].replace(/\/\/.*$/gm, '');
    expect(code).not.toContain('answerCbQuery');
  });

  // Разбор 2026-08-29: userId == telegramId верно только для телеграм-входа.
  // У Google/почты/MAX номер лежит в веб-диапазоне, а после слияния аккаунтов
  // строка User источника удаляется — и хендлер, взявший ctx.from.id как
  // userId, пишет в несуществующий или заново созданный пустой аккаунт.
  // Резолвер AccountService.canonicalUserId закрывает все нынешние места;
  // трипваер нужен, чтобы СЛЕДУЮЩИЙ хендлер не завёл двадцать седьмое.
  const RAW_ID_RE = /BigInt\(\s*(rawId|ctx\.from[?!]?\.id)\s*\)/;

  it('ни один хендлер не берёт сырой telegramId за userId', () => {
    const violations = Object.entries(sources)
      .filter(([, src]) => RAW_ID_RE.test(src))
      .map(
        ([file]) =>
          `${file}: BigInt(rawId) — сырой telegramId вместо ` +
          `await this.accountService.canonicalUserId(rawId); ` +
          `у слитого аккаунта это чужой (пустой) userId`,
      );
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
