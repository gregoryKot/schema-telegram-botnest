// Тест гейта check-silent-catch.mjs (три волны ужесточения тестов, 2026-08):
// пофайловый храповик тихих catch-хендлеров — `.catch(() => {})` и родня,
// `try { } catch { }` — паттерн, из-за которого девять раз в проде юзер видел
// «✓ Сохранено», хотя запрос упал и ничего не сохранилось.
//
// Проверяются оба исхода: гейт краснеет на регрессе И зеленеет на чистом
// дереве. Второй не менее важен — ложно-красный гейт отключают через неделю
// (CLAUDE.md, правило №11: гейт без теста на оба исхода не доказывает ничего).
import { loadNamedPatterns, loadStringList } from './pattern-loader';
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

  // Разрешение navigator.share задано С ОБЪЕКТОМ, потому что голое имя метода
  // накрыло бы `s.share()` карточки-приглашения, где проглоченная ошибка
  // значима. Пара тестов держит границу с обеих сторон.
  it('разрешает navigator.share — отказ шторки не сбой, ссылка остаётся на экране', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "navigator.share({ text: 'x' }).catch(() => {});",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('разрешает navigator.share и когда prettier перенёс цепочку на строки', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        'navigator',
        "  .share({ text: 'x' })",
        '  .catch(() => {});',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('НЕ разрешает чужой .share() — одноимённый метод не наследует разрешение', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': ['s.share().catch(() => {});', ''].join('\n'),
    });
    expect(res.status).toBe(1);
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

  // Доставка ответа в Telegram — та же строка CLAUDE.md, что про reply/
  // editMessageText. Гейт благословлял два метода и считал долгом три других
  // в той же позиции («залогировали, теперь сообщаем человеку»).
  it.each(['answerCbQuery', 'editMessageReplyMarkup'])(
    'аллоу-листед ctx.%s() внутри error-хендлера — не считается',
    (method) => {
      const res = runGate('check-silent-catch.mjs', {
        'scripts/silent-catch-baseline.json': JSON.stringify({}),
        'src/telegram/telegram.service.ts': [
          'try {',
          '  await saveSettings();',
          '} catch (err) {',
          '  this.logger.error(err);',
          `  await ctx.${method}('Не удалось сохранить').catch(() => null);`,
          '}',
          '',
        ].join('\n'),
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
    },
  );

  // Граница аллоу-листа: доставка уведомления — не ответ на действие. Молча
  // не дошедшее напоминание и есть тот сбой, ради которого гейт заведён,
  // поэтому sendMessage остаётся на счётчике, хоть и живёт в том же файле.
  it('sendMessage НЕ аллоу-листед — уведомление не имеет права падать молча', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/telegram/telegram.service.ts':
        "this.bot.telegram.sendMessage(userId, 'Напоминание').catch(() => null);\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[catch-null]');
  });

  // FILE_ALLOW: телеметрия крашей — файл целиком best-effort примитив
  // («никогда не бросает»), его catch — контракт, а не долг.
  it('shared/src/api/clientErrorReport.ts — не считается целиком', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'shared/src/api/clientErrorReport.ts': [
        'export function createClientErrorReporter(base, source) {',
        '  return function reportClientError(payload) {',
        '    try {',
        '      void fetch(base).catch(() => {});',
        '    } catch {}',
        '  };',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });

  // Граница FILE_ALLOW: те же catch в ЛЮБОМ другом новом файле — ошибка.
  it('такой же код в другом файле — считается', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'shared/src/api/otherReporter.ts': [
        'export function report(base) {',
        '  try {',
        '    void fetch(base).catch(() => {});',
        '  } catch {}',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('новый файл с 2 тихими catch');
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

  // Комментарии не сканируются — в обе стороны. Поймано на первый же день
  // работы гейта: файл, где ПОЧИНИЛИ тихий catch и объяснили это в шапке,
  // краснел из-за собственного объяснения. Обратная сторона важнее: комментарий
  // с именем из аллоу-листа не имеет права прощать соседний живой код —
  // из-за этого гейт недосчитывал 69 вхождений в 37 файлах.
  it('упоминание .catch(() => {}) в комментарии — не считается', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        '// Раньше сбой глушился `.catch(() => {})` — юзер видел «сохранено».',
        '/* Блочный комментарий тоже: .catch(() => []) */',
        'api.save(x).catch((e) => setError(e));',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик тихих catch: 0 (без роста)');
  });

  it('имя из аллоу-листа в комментарии не прощает живой код рядом', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        '// см. ctx.reply(...) в соседнем хендлере — там глушить законно',
        'const settings = await getUserSettings(id).catch(() => null);',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('L2 [catch-null]');
  });

  // Слепое пятно, найденное при разборе долга: prettier переносит длинный
  // вызов и ставит висячую запятую — `.catch(\n  () => null,\n)`. Форма та же,
  // а регэксп требовал `null)` без запятой, и вхождение уезжало мимо счёта.
  // Гейт, который не видит форму из-за форматирования, неотличим от чистого кода.
  it('висячая запятая перед закрывающей скобкой не прячет вхождение', () => {
    const res = runGate('check-silent-catch.mjs', {
      'scripts/silent-catch-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        'await notifyApplicant(id, status).catch(',
        '  () => null,',
        ');',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[catch-null]');
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

// Механизм вместо добросовестности (как в gendered-forms.spec.ts): тесты выше
// бьют по CLI известными строками и не пинят каждый паттерн по отдельности —
// отключённый регэксп мог бы не уронить ни один из них. Здесь у КАЖДОГО
// паттерна PATTERNS живой образец, который ловит именно он, а у каждого
// разрешения CHAIN_ALLOW — причина его существования в списке. Файл правил
// (scripts/silent-catch-rules.mjs) исполняется отсюда — иначе он был бы кодом,
// который никто не проверяет (правило 14 CLAUDE.md, гейт check-unwatched-code).
describe('правила гейта: каждый паттерн со своим образцом', () => {
  const PATTERNS = loadNamedPatterns('silent-catch-rules.mjs', 'PATTERNS');
  const CHAIN_ALLOW = loadStringList('silent-catch-rules.mjs', 'CHAIN_ALLOW');

  const POSITIVE: Record<string, string> = {
    'catch-empty-object': 'api.save(x).catch(() => {});',
    'catch-empty-array': 'api.list().catch(() => []);',
    'catch-null': 'api.one(id).catch(() => null);',
    'catch-undefined': 'api.one(id).catch(() => undefined);',
    'catch-zero': 'api.count().catch(() => 0);',
    'catch-false': 'api.check().catch(() => false);',
    'try-catch-empty': 'try { risky(); } catch {}',
  };

  it('в PATTERNS нет имени без образца в POSITIVE', () => {
    const missing = PATTERNS.map((p) => p.name).filter((n) => !(n in POSITIVE));
    expect(missing).toEqual([]);
  });

  it.each(PATTERNS.map((p) => [p.name] as const))(
    'паттерн «%s» ловит свой образец',
    (name) => {
      const p = PATTERNS.find((x) => x.name === name)!;
      expect(new RegExp(p.source, p.flags).test(POSITIVE[name])).toBe(true);
    },
  );

  it('разрешения перечислены явно и включают точечное navigator.share', () => {
    expect(CHAIN_ALLOW).toContain('navigator.share');
    // Голого «share» в списке быть не должно: оно накрыло бы s.share()
    // карточки-приглашения, где проглоченная ошибка значима.
    expect(CHAIN_ALLOW).not.toContain('share');
  });
});
