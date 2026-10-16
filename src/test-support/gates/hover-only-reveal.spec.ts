// Тест гейта check-hover-only-reveal.mjs: элемент, спрятанный через
// opacity: 0 и раскрываемый только по :hover, на телефоне не существует.
// Находка аудита 2026-10: `.evi-x` («удалить доказательство») в
// webapp/src/index.css.
//
// Оба исхода (правило «Тестовые храповики и e2e»): красные образцы — то, что
// гейт обязан ронять; зелёные контрольные — законные паттерны проекта
// (.mm-handle через .selected, .evi-add-go через .ready, .mode-check через
// .is-selected), чтобы гейт не краснел на правильном коде (правило №15 п.2).
import { runGate } from './gate-sandbox';

const SCRIPT = 'check-hover-only-reveal.mjs';
const OK = '✓ раскрытие только по :hover: ни одного';
const css = (...lines: string[]) => lines.join('\n') + '\n';
const run = (file: string, content: string) =>
  runGate(SCRIPT, { [file]: content });

describe('check-hover-only-reveal.mjs — красные образцы', () => {
  it('точная копия пары до починки (.evi-x) — exit 1', () => {
    const res = run(
      'webapp/src/index.css',
      css(
        '.evi-x { width: 22px; height: 22px; opacity: 0; transition: opacity .12s; }',
        '.evi-row:hover .evi-x { opacity: 1; }',
        '.evi-x:hover { background: var(--surface-3); }',
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/index.css:1');
    expect(res.stderr).toContain('.evi-x');
    expect(res.stderr).toContain('@media (hover: none)');
  });

  it('visibility: hidden вместо opacity — exit 1', () => {
    const res = run(
      'schema-miniapp/src/a.css',
      css(
        '.x { visibility: hidden; }',
        '.row:hover .x { visibility: visible; }',
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/src/a.css:1');
  });

  it('hover на самом элементе — exit 1', () => {
    const res = run(
      'shared/src/a.css',
      css('.x { opacity: 0; }', '.x:hover { opacity: 1; }'),
    );
    expect(res.status).toBe(1);
  });

  it('@media (hover: hover) раскрытие без :hover в селекторе — всё равно только для мыши, exit 1', () => {
    const res = run(
      'webapp/src/a.css',
      css(
        '.x { opacity: 0; }',
        '@media (hover: hover) { .row .x { opacity: 1; } }',
        '.row:hover .x { opacity: 1; }',
      ),
    );
    expect(res.status).toBe(1);
  });

  it('список селекторов: hover-раскрытие в одной ветке запятой не спасает, если вторая тоже hover', () => {
    const res = run(
      'webapp/src/a.css',
      css('.x { opacity: 0; }', '.a:hover .x, .b:hover .x { opacity: 1; }'),
    );
    expect(res.status).toBe(1);
  });
});

describe('check-hover-only-reveal.mjs — зелёные контрольные образцы', () => {
  it('.mm-handle: раскрытие и по hover, и по .selected — exit 0', () => {
    const res = run(
      'webapp/src/index.css',
      css(
        '.mm-handle { opacity: 0; transition: opacity 0.12s ease; }',
        '.react-flow__node:hover .mm-handle,',
        '.react-flow__node.selected .mm-handle { opacity: 1; }',
        '.react-flow.connecting .mm-handle { opacity: 0.85; }',
      ),
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('.evi-add-go.ready и .mode-check через класс состояния — exit 0', () => {
    const res = run(
      'webapp/src/index.css',
      css(
        '.evi-add-go { opacity: 0; }',
        '.evi-add-go.ready { opacity: 1; }',
        '.evi-add-go.ready:hover { background: red; }',
        '.mode-check { opacity: 0; }',
        '.mode-card.is-selected .mode-check { opacity: 1; }',
      ),
    );
    expect(res.status).toBe(0);
  });

  it(':focus-within и :focus-visible рядом с hover — exit 0', () => {
    const res = run(
      'webapp/src/index.css',
      css(
        '.evi-x { opacity: 0; }',
        '.evi-row:hover .evi-x,',
        '.evi-row:focus-within .evi-x,',
        '.evi-x:focus-visible { opacity: 1; }',
      ),
    );
    expect(res.status).toBe(0);
  });

  it('@media (hover: none) и (pointer: coarse) — exit 0', () => {
    for (const q of [
      '(hover: none)',
      '(pointer: coarse)',
      '(hover: none), (pointer: coarse)',
    ]) {
      const res = run(
        'webapp/src/index.css',
        css(
          '.x { opacity: 0; }',
          '.row:hover .x { opacity: 1; }',
          `@media ${q} { .x { opacity: 1; } }`,
        ),
      );
      expect(res.status).toBe(0);
    }
  });

  it('@keyframes { from { opacity: 0 } } — анимация, а не сокрытие, exit 0', () => {
    const res = run(
      'webapp/src/index.css',
      css(
        '@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }',
        '@keyframes slide {',
        '  0% { opacity: 0; }',
        '  100% { opacity: 1; }',
        '}',
      ),
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('спрятан, но раскрытия нет вообще (включает JS через inline-стиль) — exit 0', () => {
    const res = run('webapp/src/a.css', css('.x { opacity: 0; }'));
    expect(res.status).toBe(0);
  });

  it('закомментированная пара не считается', () => {
    const res = run(
      'webapp/src/a.css',
      css(
        '/* .x { opacity: 0; }',
        '.row:hover .x { opacity: 1; } */',
        '.y { color: red; }',
      ),
    );
    expect(res.status).toBe(0);
  });

  it('`;` и `{` внутри url("data:…") не ломают разбор правил', () => {
    const res = run(
      'webapp/src/a.css',
      css(
        ':root { --c: url("data:image/svg+xml,%3Csvg a=\'1\';{x}%3E") 6 20, grab; }',
        '.x { opacity: 0; }',
        '.row:hover .x { opacity: 1; }',
      ),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/a.css:2');
  });

  it('вне SCAN_DIRS и не .css не сканируется', () => {
    const res = runGate(SCRIPT, {
      'src/a.css': css('.x { opacity: 0; }', '.r:hover .x { opacity: 1; }'),
      'webapp/src/a.ts': '.x { opacity: 0; } .r:hover .x { opacity: 1; }\n',
    });
    expect(res.status).toBe(0);
  });
});
