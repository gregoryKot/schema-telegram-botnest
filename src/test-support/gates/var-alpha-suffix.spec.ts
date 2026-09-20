// Тест гейта check-var-alpha-suffix.mjs: hex-суффикс альфы, дописанный к
// var(). PR #520 вычистил 13 таких значений в 7 файлах, но у класса не
// осталось механизма — следующий автор написал бы `var(--c-rose)18` снова,
// и никто бы не заметил: ошибки в консоли нет, строка в DevTools выглядит
// живой.
//
// Проверяет ОБА исхода (правило «Тестовые храповики и e2e» CLAUDE.md): гейт
// краснеет на регрессе и зеленеет на чистом дереве. Второй не менее важен —
// ложно-красный гейт отключают через неделю.
//
// Фикстуры регресса взяты из трёх РЕАЛЬНЫХ исходов, замеренных в живом
// Chromium: у background, border-color и шортката border поведение браузера
// разное, и регэксп обязан ловить все три.
import { runGate } from './gate-sandbox';

const OK = '✓ hex-суффикс альфы к var(): ни одного';

describe('check-var-alpha-suffix.mjs', () => {
  it('background: var(--c-amber)08 — exit 1 (фона нет совсем)', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/Card.tsx':
        "export const C = () => <div style={{ background: 'var(--c-amber)08' }} />;\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Card.tsx:1');
    expect(res.stderr).toContain('var(--c-amber)08');
  });

  it('borderColor: var(--c-moss)40 — exit 1 (рамка кривая, а не отсутствует)', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'schema-miniapp/src/Panel.tsx':
        "const s = { borderColor: 'var(--c-moss)40' };\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/src/Panel.tsx:1');
    expect(res.stderr).toContain('var(--c-moss)40');
  });

  it('шорткат border: 1px solid var(--c-moss)33 — exit 1 (шорткат мёртв целиком)', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'shared/src/Box.tsx':
        "const s = { border: '1px solid var(--c-moss)33' };\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared/src/Box.tsx:1');
    expect(res.stderr).toContain('var(--c-moss)33');
  });

  it('тот же класс в .css — exit 1 (index.css тоже в области сканирования)', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/index.css':
        '.aside-card {\n  background: var(--c-rose)18;\n}\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/index.css:2');
    expect(res.stderr).toContain('var(--c-rose)18');
  });

  it('форма с фолбэком var(--c-rose, #fff)18 — тоже exit 1', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/Fallback.tsx':
        "const s = { background: 'var(--c-rose, #fff)18' };\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('var(--c-rose, #fff)18');
  });

  it('сообщение называет замену через color-mix', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/Card.tsx': "const s = { background: 'var(--c-rose)18' };\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'color-mix(in srgb, var(--c-rose) 9%, transparent)',
    );
  });

  // ——— КОНТРОЛЬНЫЕ ОБРАЗЦЫ: то, что краснеть НЕ должно ———

  it('ЧИСТОЕ ДЕРЕВО: рабочие приёмы и голые токены — exit 0', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/clean.tsx': [
        // валидный hex с альфой — так можно
        "const a = { background: '#c46b6b18' };",
        // принятый в проекте приём
        "const b = { background: 'color-mix(in srgb, var(--c-rose) 9%, transparent)' };",
        // токены сами по себе
        "const c = { borderRadius: 'var(--r-12)', padding: 'var(--space-8)' };",
        // var() с пробелом и с запятой следом
        "const d = { border: '1px solid var(--c-moss) inset' };",
        "const e = { boxShadow: '0 0 0 1px var(--c-moss), 0 1px 2px #0002' };",
        // подстановка значения, а не hex
        'const f = { background: `var(--c-rose)${alpha}` };',
        '',
      ].join('\n'),
      'schema-miniapp/src/clean.css': [
        '.card {',
        '  background: var(--surface);',
        '  border: 1px solid var(--c-moss);',
        '  padding: var(--space-8) var(--space-12);',
        '  width: calc(var(--w) * 2);',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('поломка только в комментарии не считается (общий gate-strip-comments)', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/commented.tsx': [
        "// было 'var(--c-rose)18', стало color-mix — см. PR #520",
        '/* background: var(--c-amber)08 — так нельзя */',
        "const a = { background: 'var(--c-rose)' };",
        '',
      ].join('\n'),
      // В CSS `//` комментарием НЕ является — режется только /* */.
      'webapp/src/commented.css':
        '/* background: var(--c-moss)40 */\n.x { color: var(--fg); }\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('спеки не сканируются — фикстура теста не роняет гейт', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'webapp/src/Card.spec.tsx':
        "expect(style.background).toBe('var(--c-rose)18');\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('вне SCAN_DIRS (бэкенд src/) не сканируется', () => {
    const res = runGate('check-var-alpha-suffix.mjs', {
      'src/some-backend-file.ts': "const s = 'var(--c-rose)18';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });
});
