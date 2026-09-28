// Тест гейта check-schema-terms.mjs: терминология схема-терапии сверена с
// docs/TERMINOLOGY.md (МИСТ). Инцидент: «схема Неудача» в статье вместо
// канонического «Неуспешность» — владелец нашёл глазами, гейта не было.
//
// Проверяет ОБА исхода (правило «Тестовые храповики и e2e» CLAUDE.md): гейт
// краснеет на регрессе и зеленеет на чистом дереве. У большинства терминов
// запрещённая форма совпадает с обычным русским словом/фразой вне контекста
// схема-терапии («неудача», «слияние», «подчинения силой») — поэтому каждый
// красный образец идёт в паре с КОНТРОЛЬНЫМ (правило №15 CLAUDE.md): похожим,
// но легитимным употреблением, которое обязано остаться зелёным.
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const OK_PREFIX = '✓ терминология схема-терапии:';

describe('check-schema-terms.mjs', () => {
  // ——— Неудача/Провал (схема «Неуспешность») ———
  it('схема-контекст «Неудача» — exit 1, контроль «неудачу» в прозе — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/a.tsx': 'export const A = () => <p>схема «Неудача»</p>;\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('webapp/src/a.tsx:1');
    expect(bad.stderr).toContain('Неуспешность');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/a.tsx':
        'export const A = () => <p>Это не про конкретную неудачу, а про паттерн. Момент неудачи проходит.</p>;\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  it('«Провал» — префикс обычного слова «Провалили» после </h2> не считается (реальная находка в articles.seed.ts)', () => {
    const res = runGate('check-schema-terms.mjs', {
      'src/articles/x.ts':
        'export const c = `<h2>Где проходит граница</h2>\n<p>Провалили презентацию – неделю неловко.</p>`;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK_PREFIX);
  });

  it('заголовок «<h3>9. Неудача» и кавычки — тоже exit 1', () => {
    const strong = runGate('check-schema-terms.mjs', {
      'webapp/src/b.tsx': 'const t = <strong>Неудача</strong>;\n',
    });
    expect(strong.status).toBe(1);

    const heading = runGate('check-schema-terms.mjs', {
      'webapp/src/c.html': '<h3>9. Неудача</h3>\n',
    });
    expect(heading.status).toBe(1);

    const quoted = runGate('check-schema-terms.mjs', {
      'src/d.ts': "const name = 'Неудача';\n",
    });
    expect(quoted.status).toBe(1);
  });

  // ——— Подчинение (схема «Покорность») ———
  it('схема-контекст «Подчинение» — exit 1, «подчинения силой» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/e.tsx': 'const s = <strong>Подчинение</strong>;\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Покорность');

    const quoted = runGate('check-schema-terms.mjs', {
      'shared/src/f.ts': "const name = 'Подчинение';\n",
    });
    expect(quoted.status).toBe(1);

    const guillemet = runGate('check-schema-terms.mjs', {
      'shared/src/g.ts': 'const label = "«Подчинение и Самопожертвование»";\n',
    });
    expect(guillemet.status).toBe(1);

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/e.tsx':
        'export const T = "Иногда близкие добиваются подчинения силой, а не просьбой.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Режимы: «…Родитель» вместо «…Критик» ———
  it('«Карающий Родитель» — exit 1, «Наказывающий Родитель» — exit 1, «Хороший Родитель» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'schema-miniapp/src/h.tsx':
        'const m = "Карающий Родитель говорит: ты плохой.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Критик');

    const bad2 = runGate('check-schema-terms.mjs', {
      'schema-miniapp/src/h2.tsx':
        'const m = "Наказывающий Родитель тут неуместен.";\n',
    });
    expect(bad2.status).toBe(1);
    expect(bad2.stderr).toContain('Критик');

    const ok = runGate('check-schema-terms.mjs', {
      'schema-miniapp/src/h.tsx':
        'const m = "Хороший Родитель поддерживает тебя.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Наказывающий Критик» — теперь допустимая альтернатива «Карающему
  // Критику» (документ АНИМА/МИСТ), запрещён остался только вариант с
  // «Родитель» (тест выше) ———
  it('«Наказывающий Критик» — допустимая альтернатива, exit 0', () => {
    const ok = runGate('check-schema-terms.mjs', {
      'schema-miniapp/src/h3.tsx':
        'const m = "Наказывающий Критик тут неуместен.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  it('«Добрый Родитель» (с заглавных) — exit 1, «доброго родителя» строчными — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/i.tsx': 'const m = "Добрый Родитель успокаивает.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Хороший Родитель');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/i.tsx':
        'const m = "Это похоже на слова доброго родителя ребёнку.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Злой Ребёнок» вместо «Сердитый/Упрямый/Разъярённый Ребёнок» ———
  it('«Злой Ребёнок» (капитал Р) — exit 1', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/j.tsx': 'const m = "Злой Ребёнок кричит внутри.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Сердитый');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/j.tsx': 'const m = "Он был зол на весь ребячий мир.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Капитулянт ———
  it('«Покорный Капитулянт» — exit 1, «Послушный Капитулянт» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/k.tsx':
        'const m = "Покорный Капитулянт соглашается на всё.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Послушный');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/k.tsx':
        'const m = "Послушный Капитулянт соглашается на всё.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Полианна / Поллианна (одна буква «л») ———
  it('«Полианна» (одно л) — exit 1, «Поллианна» (два л) — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/l.tsx': 'const m = "Режим Полианна улыбается через боль.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Поллианна');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/l.tsx':
        'const m = "Режим Поллианна улыбается через боль.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Гиперкомпенсатор / Гиперкомпенсация ———
  it('«Гиперкомпенсатор» — exit 1, «Гиперкомпенсация» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'shared/src/m.ts':
        'export const g = "Гиперкомпенсатор — режим избегания боли.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Гиперкомпенсация');

    const ok = runGate('check-schema-terms.mjs', {
      'shared/src/m.ts':
        'export const g = "Гиперкомпенсация — группа копинговых режимов.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Половина имени строчными: «Здоровый взрослый» ———
  it('«Здоровый взрослый» (строчная 2-я половина) — exit 1, «Здоровый Взрослый» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'schema-miniapp/src/n.tsx':
        'const m = "В тебе живёт Здоровый взрослый.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Здоровый Взрослый');

    const ok = runGate('check-schema-terms.mjs', {
      'schema-miniapp/src/n.tsx':
        'const m = "В тебе живёт Здоровый Взрослый.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  it('«Уязвимый ребёнок» (строчная 2-я половина) — exit 1, полностью строчное — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/o.tsx':
        'const m = "Внутри — Уязвимый ребёнок, которого не услышали.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Ребёнок');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/o.tsx':
        'const m = "Мы говорим о том, что уязвимого ребёнка внутри долго не замечали — это бытовой оборот.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Ранние дезадаптивные схемы ———
  it('«неадаптивные схемы»/«дисфункциональные схемы» — exit 1', () => {
    const bad1 = runGate('check-schema-terms.mjs', {
      'src/p.ts':
        'export const t = "Работа с неадаптивными схемами занимает время.";\n',
    });
    expect(bad1.status).toBe(1);
    expect(bad1.stderr).toContain('ранние дезадаптивные схемы');

    const bad2 = runGate('check-schema-terms.mjs', {
      'src/p2.ts': 'export const t = "Дисфункциональная схема мешает жить.";\n',
    });
    expect(bad2.status).toBe(1);

    const ok = runGate('check-schema-terms.mjs', {
      'src/p.ts':
        'export const t = "Работа с ранними дезадаптивными схемами занимает время.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Название метода ———
  it('«схематерапия»/«схемотерапия» слитно — exit 1, через дефис — exit 0', () => {
    const bad1 = runGate('check-schema-terms.mjs', {
      'src/q.ts': 'export const t = "Занимаюсь схематерапией уже пять лет.";\n',
    });
    expect(bad1.status).toBe(1);
    expect(bad1.stderr).toContain('схема-терапия');

    const bad2 = runGate('check-schema-terms.mjs', {
      'src/q2.ts':
        'export const t = "Схемотерапия помогает разобраться в паттернах.";\n',
    });
    expect(bad2.status).toBe(1);

    const ok = runGate('check-schema-terms.mjs', {
      'src/q.ts':
        'export const t = "Занимаюсь схема-терапией уже пять лет.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Старые названия доменов, «Сверхбдительность и запреты» как контрольный образец ———
  it('«Бдительность и подавление» — exit 1, «Сверхбдительность и запреты» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'src/r.ts':
        'export const d = "Домен Бдительность и подавление — про контроль.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Сверхбдительность и запреты');

    const ok = runGate('check-schema-terms.mjs', {
      'src/r.ts':
        'export const d = "Домен Сверхбдительность и запреты — про контроль.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Сверхбдительность и подавление эмоций» — раньше канон, теперь тоже
  // старое имя (документ АНИМА/МИСТ переименовал в «Сверхбдительность и
  // запреты») ———
  it('«Сверхбдительность и подавление эмоций» — exit 1', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'src/r2.ts':
        'export const d = "Домен Сверхбдительность и подавление эмоций — про контроль.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Сверхбдительность и запреты');
  });

  // ——— «Нарушение связи и отвержение» — тоже старое имя домена 1, канон —
  // «Разобщение / Отвержение» ———
  it('«Нарушение связи и отвержение» — exit 1, «Разобщение / Отвержение» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'src/r3.ts':
        'export const d = "Домен Нарушение связи и отвержение — про близость.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Разобщение / Отвержение');

    const ok = runGate('check-schema-terms.mjs', {
      'src/r3.ts':
        'export const d = "Домен Разобщение / Отвержение — про близость.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Спутанность» — старое имя схемы «Запутанность / Неразвитая
  // идентичность» ———
  it('схема-контекст «Спутанность» — exit 1, контроль «Запутанность / Неразвитая идентичность» и бытовая «спутанность» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/u.tsx': 'const m = <strong>Спутанность</strong>;\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Запутанность / Неразвитая идентичность');

    const okCanonical = runGate('check-schema-terms.mjs', {
      'webapp/src/u.tsx':
        'const m = "Схема «Запутанность / Неразвитая идентичность» — про размытые границы.";\n',
    });
    expect(okCanonical.status).toBe(0);
    expect(okCanonical.stdout).toContain(OK_PREFIX);

    const okProse = runGate('check-schema-terms.mjs', {
      'webapp/src/u.tsx':
        'const m = "От спутанности мыслей помогает пауза перед ответом.";\n',
    });
    expect(okProse.status).toBe(0);
    expect(okProse.stdout).toContain(OK_PREFIX);
  });

  // ——— «Дефективность / Стыд» — старое имя схемы «Дефективность /
  // Стыдливость» (тоже со строчной «стыд» после слэша) ———
  it('«Дефективность / Стыд» — exit 1 (в т.ч. со строчной «стыд»), «Дефективность / Стыдливость» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'src/v.ts':
        'export const d = "Схема Дефективность / Стыд — про ощущение изъяна.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Дефективность / Стыдливость');

    const badLowercase = runGate('check-schema-terms.mjs', {
      'src/v2.ts':
        'export const d = "Схема Дефективность / стыд — про ощущение изъяна.";\n',
    });
    expect(badLowercase.status).toBe(1);

    const ok = runGate('check-schema-terms.mjs', {
      'src/v.ts':
        'export const d = "Схема Дефективность / Стыдливость — про ощущение изъяна.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Эмоциональная депривация» — старое имя схемы «Эмоциональная
  // депривированность»; строчная бытовая фраза не трогается ———
  it('схема-контекст «Эмоциональная депривация» — exit 1, строчная проза — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/w.tsx':
        'const m = <strong>Эмоциональная депривация</strong>;\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Эмоциональная депривированность');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/w.tsx':
        'const m = "Долгая эмоциональная депривация в детстве оставляет след.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Подавление эмоций» — старое имя схемы «Подавленность эмоций»;
  // строчная бытовая фраза не трогается ———
  it('схема-контекст «Подавление эмоций» — exit 1, строчная проза — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'webapp/src/x.tsx': 'const m = <strong>Подавление эмоций</strong>;\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Подавленность эмоций');

    const ok = runGate('check-schema-terms.mjs', {
      'webapp/src/x.tsx':
        'const m = "Хроническое подавление эмоций истощает так же, как их выплеск.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— «Перфекционист-Гиперконтролёр» — устаревшее двойное имя, канон —
  // просто «Перфекционист» ———
  it('«Перфекционист-Гиперконтролёр»/«-Гиперконтролер» — exit 1, «Перфекционист» — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'shared/src/y.ts':
        'export const m = "Перфекционист-Гиперконтролёр требует безупречности.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Перфекционист');

    const badLatinE = runGate('check-schema-terms.mjs', {
      'shared/src/y2.ts':
        'export const m = "Перфекционист-Гиперконтролер требует безупречности.";\n',
    });
    expect(badLatinE.status).toBe(1);

    const ok = runGate('check-schema-terms.mjs', {
      'shared/src/y.ts':
        'export const m = "Перфекционист требует безупречности.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Слэш-варианты ———
  it('«Недоверие / Жестокое обращение» — exit 1', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'src/s.ts':
        'export const d = "Схема Недоверие / Жестокое обращение — про близких.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('Недоверие / Ожидание жестокого обращения');
  });

  it('«Поиск одобрения / Признания» — exit 1, «Поиск одобрения» без слэша — exit 0', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'src/t.ts': 'export const d = "Схема Поиск одобрения / Признания.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('«Поиск одобрения»');

    const ok = runGate('check-schema-terms.mjs', {
      'src/t.ts': 'export const d = "Схема Поиск одобрения.";\n',
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK_PREFIX);
  });

  // ——— Статика вне src/ (webapp/public, index.html) — правило №14 ———
  it('webapp/index.html и webapp/public/** тоже сканируются', () => {
    const inHtml = runGate('check-schema-terms.mjs', {
      'webapp/index.html': '<html><body>схема «Неудача»</body></html>\n',
    });
    expect(inHtml.status).toBe(1);
    expect(inHtml.stderr).toContain('webapp/index.html:1');

    const inPublic = runGate('check-schema-terms.mjs', {
      'webapp/public/llms.txt': "Термин 'Неудача' используется как пример.\n",
    });
    expect(inPublic.status).toBe(1);
    expect(inPublic.stderr).toContain('webapp/public/llms.txt:1');
  });

  // ——— Игра — тоже в области сканирования ———
  it('game/src сканируется', () => {
    const bad = runGate('check-schema-terms.mjs', {
      'game/src/dialog.ts':
        'export const d = "Гиперкомпенсатор появляется на уровне 3.";\n',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('game/src/dialog.ts:1');
  });

  // ——— Спеки и docs/ вне области сканирования ———
  it('*.spec.ts не сканируется — фикстура теста не роняет гейт', () => {
    const res = runGate('check-schema-terms.mjs', {
      'webapp/src/Card.spec.tsx': "expect(label).toBe('Неудача');\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK_PREFIX);
  });

  it('docs/ и prisma/migrations вне области сканирования', () => {
    const res = runGate('check-schema-terms.mjs', {
      'docs/TERMINOLOGY.md':
        "| Схема | Не писать |\n|---|---|\n| Неуспешность | 'Неудача' |\n",
      'prisma/migrations/20200101_x/migration.sql':
        "INSERT INTO x (name) VALUES ('Неудача');\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK_PREFIX);
  });

  // ——— Чистое дерево целиком ———
  it('ЧИСТОЕ ДЕРЕВО: канонические термины — exit 0', () => {
    const res = runGate('check-schema-terms.mjs', {
      'webapp/src/clean.tsx': [
        'export const Clean = () => (',
        '  <div>',
        '    <h3>Неуспешность</h3>',
        '    <p>Схема «Покорность» — про уступки без выбора.</p>',
        '    <p>Режимы: Сердитый Ребёнок, Здоровый Взрослый, Хороший Родитель.</p>',
        '    <p>Работаю в подходе схема-терапия уже несколько лет.</p>',
        '  </div>',
        ');',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK_PREFIX);
  });
});

// Реестр правил — scripts/schema-terms-rules.mjs — читается напрямую, а не
// только через CLI: у каждого правила свой id, и канонический вариант, который
// правило предлагает взамен, само правило не ловит (иначе гейт требовал бы
// заменить термин на него же, и исправить текст было бы нельзя).
interface TermRule {
  id: string;
  source: string;
  flags: string;
  canonical: string;
}

describe('schema-terms-rules.mjs: реестр правил', () => {
  const RULES = JSON.parse(
    importExport(
      'schema-terms-rules.mjs',
      'RULES',
      '(list) => list.map((r) => ({ id: r.id, source: r.pattern.source, flags: r.pattern.flags, canonical: r.canonical }))',
    ),
  ) as TermRule[];

  it('правил не меньше 30, id уникальны', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it.each(RULES.map((r) => [r.id, r] as const))(
    '%s: канонический вариант правилом не ловится',
    (_id, r) => {
      expect(r.canonical.trim()).not.toBe('');
      for (const variant of r.canonical.split(/\s*[,;]\s*|\s+или\s+/)) {
        expect(
          new RegExp(r.source, r.flags.replace('g', '')).test(variant),
        ).toBe(false);
      }
    },
  );

  // Правила по режимам вынесены в отдельный модуль (правило №10 CLAUDE.md —
  // schema-terms-rules.mjs дошёл бы до 300 строк). Проверяем, что
  // schema-terms-modes.mjs реально существует и его правила не потерялись
  // при склейке в общий RULES выше — иначе главный файл мог бы забыть
  // заспредить MODE_RULES, и гейт молча перестал бы ловить режимы.
  it('MODE_RULES из schema-terms-modes.mjs целиком входят в общий RULES', () => {
    const modeIds = JSON.parse(
      importExport(
        'schema-terms-modes.mjs',
        'MODE_RULES',
        '(list) => list.map((r) => r.id)',
      ),
    ) as string[];
    expect(modeIds.length).toBeGreaterThanOrEqual(10);
    const ruleIds = new Set(RULES.map((r) => r.id));
    for (const id of modeIds) expect(ruleIds.has(id)).toBe(true);
  });
});
