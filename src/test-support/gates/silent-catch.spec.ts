// Тест гейта check-silent-catch.mjs (три волны ужесточения тестов, 2026-08):
// пофайловый храповик тихих catch-хендлеров — `.catch(() => {})` и родня,
// `try { } catch { }` — паттерн, из-за которого девять раз в проде юзер видел
// «✓ Сохранено», хотя запрос упал и ничего не сохранилось.
//
// Проверяются оба исхода: гейт краснеет на регрессе И зеленеет на чистом
// дереве. Второй не менее важен — ложно-красный гейт отключают через неделю
// (CLAUDE.md, правило №11: гейт без теста на оба исхода не доказывает ничего).
import { runGate } from './gate-sandbox';

describe('check-silent-catch.mjs', () => {
  it('новый файл с .catch(() => {}) — exit 1, допустимо 0', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        'api.createLetter(text).catch(() => {});',
        'showSaved();',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.ts: новый файл с 1 тихими catch');
    expect(res.stderr).toContain('[catch-empty-object]');
  });

  it('ловит .catch(() => []) — фолбэк на пустой список вместо реальных данных', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'webapp/src/foo.ts': 'const tasks = await getTasks().catch(() => []);\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[catch-empty-array]');
  });

  it.each([
    ['null', 'catch-null'],
    ['undefined', 'catch-undefined'],
    ['0', 'catch-zero'],
    ['false', 'catch-false'],
  ])('ловит .catch(() => %s)', (value, patternName) => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': `const x = await api.updateSettings(v).catch(() => ${value});\n`,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`[${patternName}]`);
  });

  it('ловит пустой statement-catch: try { } catch { }', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': ['try {', '  doThing();', '} catch {}', ''].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[try-catch-empty]');
  });

  it('ловит пустой catch (e) {} с именованным параметром', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': ['try {', '  doThing();', '} catch (e) {}', ''].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[try-catch-empty]');
  });

  it('рост счётчика в известном файле — exit 1 с «было → стало»', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({
        'src/known.ts': 1,
      }),
      'src/known.ts': ['a().catch(() => {});', 'b().catch(() => {});', ''].join(
        '\n',
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/known.ts: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({
        'src/known.ts': 2,
      }),
      'src/known.ts': 'a().catch(() => {});\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  it('чистое дерево без тихих catch — exit 0, без роста', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/clean.ts': [
        'try {',
        '  doThing();',
        '} catch (e) {',
        '  this.logger.error(e);',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });

  // Аллоу-лист (правило №8): аналитика — намеренно fire-and-forget, ошибка
  // сети не должна ломать пользовательский поток.
  it('аллоу-листед trackEvent — не считается', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'shared/src/api/sharedApi.ts': [
        'export const buildSharedApi = (t) => ({',
        '  trackEvent: (name, meta) => {',
        "    void t.post('/api/event', { name, meta }).catch(() => undefined);",
        '  },',
        '});',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });

  // Аллоу-лист: CLAUDE.md прямо требует .catch(() => null) на editMessageText/
  // reply внутри error-хендлера — иначе вторая ошибка роняет весь хендлер.
  it('аллоу-листед ctx.reply().catch(() => null) внутри error-хендлера — не считается', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/telegram/telegram.service.ts': [
        'try {',
        '  await doSomething();',
        '} catch (err) {',
        '  this.logger.error(err);',
        "  await ctx.reply('Ошибка').catch(() => null);",
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });

  // Не аллоу-листед вызов рядом с аллоу-листед — только законный молчит.
  it('не аллоу-листед .catch(() => null) на произвольном вызове — считается', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': 'notifyApplicant(id, status).catch(() => null);\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[catch-null]');
  });

  // Регрессия на первую версию гейта: аллоу-лист искал имя в окне 300 символов
  // ПЕРЕД матчем, и соседство решало за цепочку. На реальном коде это прощало
  // ровно то, ради чего гейт заводился: `getUserSettings(id).catch(() => null)`
  // молчал, потому что строкой выше встретился `.reply(`. Теперь имя берётся
  // из самой цепочки, поэтому близость аллоу-листед вызова ничего не даёт.
  it('аллоу-листед вызов РЯДОМ не прощает соседний — считается только цепочка', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        'async function handler(ctx: Ctx) {',
        "  await ctx.reply('Что-то пошло не так').catch(() => null);",
        '  const settings = await getUserSettings(ctx.id).catch(() => null);',
        '  return settings;',
        '}',
        '',
      ].join('\n'),
    });
    // reply — законный (цепочка), getUserSettings — нет: ровно один счёт.
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.ts: новый файл с 1 тихими catch');
    // L3 — строка getUserSettings; L2 (ctx.reply) в отчёт не попал.
    expect(res.stderr).toContain('L3 [catch-null]');
    expect(res.stderr).not.toContain('L2 [catch-null]');
  });

  it('тестовый файл (*.test.tsx) не сканируется', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'webapp/src/Foo.test.tsx': 'api.save(x).catch(() => {});\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });

  it('спек-файл (*.spec.ts) не сканируется', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.spec.ts': 'api.save(x).catch(() => {});\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });
});
