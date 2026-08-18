// Тест метагейта check-gate-exemptions.mjs (правило №15 CLAUDE.md: «гейт
// про гейты» — закрывает класс «список исключений внесли, а тест на него не
// написали, и гейт молча замолчал шире, чем нужно»).
//
// Проверяются оба исхода: гейт краснеет на списке-исключении без теста на
// своё имя И зеленеет, когда тест есть (или список пуст, или он в
// KNOWN_EXEMPTIONS). Второй не менее важен — ложно-красный гейт отключают
// через неделю (CLAUDE.md, правило №11).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, REAL_SCRIPTS_DIR } from './gate-sandbox';

const FAKE_GATE = 'export const ALLOW = [/foo/, /bar/];\n';
const FAKE_GATE_SPEC = [
  "import { loadRegexList } from './pattern-loader';",
  '',
  "const ALLOW = loadRegexList('fake-gate.mjs', 'ALLOW');",
  "it('покрыт', () => { expect(ALLOW.length).toBeGreaterThan(0); });",
  '',
].join('\n');

describe('check-gate-exemptions.mjs', () => {
  it('непустой список без теста на своё имя — exit 1, называет файл и имя', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs': FAKE_GATE,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('scripts/fake-gate.mjs: ALLOW');
  });

  it('тот же список, но с тестом через loadRegexList(файл, имя) — exit 0', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs': FAKE_GATE,
      'src/test-support/gates/fake-gate.spec.ts': FAKE_GATE_SPEC,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт про гейты:');
  });

  it('покрытие прямым импортом экспорта — тоже засчитывается, exit 0', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs': FAKE_GATE,
      'src/test-support/gates/fake-gate.spec.ts': [
        "import { ALLOW } from '../../../scripts/fake-gate.mjs';",
        "it('покрыт', () => { expect(ALLOW.length).toBeGreaterThan(0); });",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('упоминание имени и файла ТОЛЬКО в комментарии — не считается покрытием, exit 1', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs': FAKE_GATE,
      'src/test-support/gates/fake-gate.spec.ts':
        "// см. ALLOW в fake-gate.mjs — когда-нибудь напишу тест\nit('пусто', () => 1);\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('scripts/fake-gate.mjs: ALLOW');
  });

  it('пустой список — не считается нарушением даже без единого теста', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs': 'export const ALLOW = [];\n',
    });
    expect(res.status).toBe(0);
  });

  it('локальная переменная в camelCase (не SCREAMING_SNAKE) не считается списком-правилом', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs':
        "function f() {\n  const excludedPaths = ['a', 'b'];\n  return excludedPaths;\n}\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 непустых списков');
  });

  it('вложенные regex-литералы с символьными классами не ломают подсчёт глубины', () => {
    // Реальная форма ALLOW в gendered-forms-patterns.mjs/check-robot-phrases.mjs:
    // сами элементы списка — регэкспы с `[...]` внутри. Наивный счётчик
    // глубины принял бы их за настоящие скобки массива и оборвал бы список
    // раньше времени (или никогда не нашёл закрытие).
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs':
        'export const ALLOW = [\n  /[Ээ]то\\s+не\\s+каприз/,\n  /живой\\s+человек/,\n];\n',
      'src/test-support/gates/fake-gate.spec.ts': FAKE_GATE_SPEC,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 непустых списков');
  });

  it('несколько списков в разных файлах — каждый учитывается по отдельности', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/fake-gate.mjs': FAKE_GATE,
      'scripts/fake-gate-2.mjs': "export const EXCLUDE = ['x/'];\n",
      'src/test-support/gates/fake-gate.spec.ts': FAKE_GATE_SPEC,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('scripts/fake-gate-2.mjs: EXCLUDE');
    expect(res.stderr).not.toContain('scripts/fake-gate.mjs: ALLOW');
  });
});

// KNOWN_EXEMPTIONS — собственный (пустой на 2026-08-18) список структурных
// исключений метагейта. Правим не тестовую копию, а реальный файл
// (surgical string-replace), чтобы тест не разошёлся с фактическим кодом.
describe('KNOWN_EXEMPTIONS check-gate-exemptions.mjs', () => {
  const REAL_SOURCE = readFileSync(
    join(REAL_SCRIPTS_DIR, 'check-gate-exemptions.mjs'),
    'utf8',
  );
  const MARKER = 'export const KNOWN_EXEMPTIONS = [];';

  it('маркер реально есть в текущем скрипте (иначе следующие тесты — пустое совпадение)', () => {
    expect(REAL_SOURCE).toContain(MARKER);
  });

  function withExemptions(entries: string): string {
    return REAL_SOURCE.replace(
      MARKER,
      `export const KNOWN_EXEMPTIONS = [${entries}];`,
    );
  }

  it('список в KNOWN_EXEMPTIONS с причиной гасит нарушение без теста', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/check-gate-exemptions.mjs': withExemptions(
        "{ file: 'fake-gate.mjs', name: 'ALLOW', reason: 'тест метагейта' }",
      ),
      'scripts/fake-gate.mjs': FAKE_GATE,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 структурных исключений');
  });

  it('протухшая запись KNOWN_EXEMPTIONS (списка больше нет) — exit 1', () => {
    const res = runGate('check-gate-exemptions.mjs', {
      'scripts/check-gate-exemptions.mjs': withExemptions(
        "{ file: 'ghost.mjs', name: 'ALLOW', reason: 'файл давно удалён' }",
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Протухшие KNOWN_EXEMPTIONS');
    expect(res.stderr).toContain('ghost.mjs: ALLOW');
  });
});
