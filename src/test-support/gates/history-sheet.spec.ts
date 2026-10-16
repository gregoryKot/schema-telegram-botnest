// Тест гейта check-history-sheet.mjs — оверлей на весь экран обязан вызывать
// useHistorySheet либо стоять в scripts/history-sheet-baseline.json с причиной.
//
// Родился из находки аудита 2026-10: чек-ин «Режим прямо сейчас» в ModesTab —
// `position: fixed, inset: 0` с голым setShowCheckin(false) вместо хука —
// пережил запись дизайн-аудита «~54 места, одно нарушение»: гейт стоял в списке
// кандидатов. Проверяются оба исхода и контрольные образцы (правило №15:
// похожий, но незаконный случай обязан остаться красным), включая слепую зону
// «оверлей задан классом из CSS, а не инлайном» — 35 из 47 листов такие.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const GATE = 'check-history-sheet.mjs';
const REAL_BASELINE = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'scripts', 'history-sheet-baseline.json'),
    'utf8',
  ),
) as Record<string, { reason: string; since: string }>;

const entry = (reason = 'честная причина длиннее двадцати символов') => ({
  reason,
  since: 'abc1234',
});
const baseline = (o: Record<string, unknown> = {}) => JSON.stringify(o);

const INLINE_NO_HOOK = [
  'export function Sheet({ onClose }: { onClose: () => void }) {',
  '  return (',
  "    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>",
  '      <button onClick={onClose}>Назад</button>',
  '    </div>',
  '  );',
  '}',
  '',
].join('\n');

const WITH_HOOK = [
  "import { useHistorySheet } from '../hooks/useHistorySheet';",
  'export function Sheet({ onClose }: { onClose: () => void }) {',
  '  const goBack = useHistorySheet(onClose);',
  '  return (',
  "    <div style={{ position: 'fixed', inset: 0, zIndex: 400 }}>",
  '      <button onClick={goBack}>Назад</button>',
  '    </div>',
  '  );',
  '}',
  '',
].join('\n');

const CSS = [
  '.ex-screen {',
  '  position: fixed; inset: 0;',
  '  background: var(--bg);',
  '}',
  '.ex-screen::before { content: ""; position: fixed; inset: 0; }',
  '.plain { padding: 8px; }',
  '@media (max-width: 600px) {',
  '  .sidebar-open { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }',
  '}',
  '',
].join('\n');

describe('check-history-sheet.mjs — инлайновые оверлеи', () => {
  it('чистое дерево: оверлей с хуком — exit 0', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx': WITH_HOOK,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт оверлеев');
  });

  it('оверлей fixed + inset: 0 без хука и без записи — красный, с путём и строкой', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx': INLINE_NO_HOOK,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Sheet.tsx');
    expect(res.stderr).toContain('L3');
  });

  it('четыре стороны в нуле вместо inset: 0 — тоже оверлей', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx': INLINE_NO_HOOK.replace(
        'inset: 0',
        'top: 0, left: 0, right: 0, bottom: 0',
      ),
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
  });

  it('контроль: fixed и inset: 0 в РАЗНЫХ объектах — не оверлей (плавающая кнопка)', () => {
    const res = runGate(GATE, {
      'webapp/src/Fab.tsx': [
        'export const Fab = () => (',
        '  <div>',
        "    <button style={{ position: 'fixed', bottom: 16, right: 16 }}>+</button>",
        '    <div style={{ inset: 0 }} />',
        '  </div>',
        ');',
        '',
      ].join('\n'),
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('контроль: хук только в комментарии не считается вызовом', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx':
        '// TODO useHistorySheet(onClose)\n' + INLINE_NO_HOOK,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
  });

  it('тестовые файлы не сканируются', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.test.tsx': INLINE_NO_HOOK,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('мини-апп вне зоны гейта (там нет роутера, свой механизм)', () => {
    const res = runGate(GATE, {
      'schema-miniapp/src/Sheet.tsx': INLINE_NO_HOOK,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });
});

describe('check-history-sheet.mjs — оверлей, заданный классом из CSS', () => {
  const USES_CLASS = [
    'export const Screen = () => (',
    '  <div className="ex-screen">',
    '    <button>Назад</button>',
    '  </div>',
    ');',
    '',
  ].join('\n');

  it('className с классом, у которого в CSS fixed + inset: 0, без хука — красный', () => {
    const res = runGate(GATE, {
      'webapp/src/index.css': CSS,
      'webapp/src/Screen.tsx': USES_CLASS,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/Screen.tsx');
    expect(res.stderr).toContain('ex-screen');
  });

  it('тот же класс, файл вызывает хук — зелёный', () => {
    const res = runGate(GATE, {
      'webapp/src/index.css': CSS,
      'webapp/src/Screen.tsx':
        'const goBack = useHistorySheet(onClose);\n' + USES_CLASS,
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('класс из @media-правила с четырьмя сторонами в нуле тоже ловится', () => {
    const res = runGate(GATE, {
      'webapp/src/index.css': CSS,
      'webapp/src/Screen.tsx': USES_CLASS.replace(
        'ex-screen',
        'a sidebar-open',
      ),
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('sidebar-open');
  });

  it('контроль: класс без fixed в CSS и класс-подстрока (ex-screen-title) — не оверлей', () => {
    const res = runGate(GATE, {
      'webapp/src/index.css': CSS,
      'webapp/src/Screen.tsx': [
        'export const Screen = () => (',
        '  <div className="plain ex-screen-title">x</div>',
        ');',
        '',
      ].join('\n'),
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('контроль: правило на псевдоэлемент (::before) не делает класс оверлеем', () => {
    const res = runGate(GATE, {
      'webapp/src/index.css': '.decor::before { position: fixed; inset: 0; }\n',
      'webapp/src/Screen.tsx':
        'export const S = () => <div className="decor" />;\n',
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });

  it('CSS в комментарии не создаёт класс-оверлей', () => {
    const res = runGate(GATE, {
      'webapp/src/index.css': '/* .ghost { position: fixed; inset: 0; } */\n',
      'webapp/src/Screen.tsx':
        'export const S = () => <div className="ghost" />;\n',
      'scripts/history-sheet-baseline.json': baseline(),
    });
    expect(res.status).toBe(0);
  });
});

describe('check-history-sheet.mjs — бейслайн', () => {
  it('оверлей без хука, но с записью и внятной причиной — зелёный', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx': INLINE_NO_HOOK,
      'scripts/history-sheet-baseline.json': baseline({
        'webapp/src/Sheet.tsx': entry(),
      }),
    });
    expect(res.status).toBe(0);
  });

  it('протухшая запись: файл получил хук — красный', () => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx': WITH_HOOK,
      'scripts/history-sheet-baseline.json': baseline({
        'webapp/src/Sheet.tsx': entry(),
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшая запись');
  });

  it('протухшая запись: файл исчез или перестал быть оверлеем — красный', () => {
    const res = runGate(GATE, {
      'webapp/src/Plain.tsx': 'export const P = () => <div />;\n',
      'scripts/history-sheet-baseline.json': baseline({
        'webapp/src/Plain.tsx': entry(),
        'webapp/src/Gone.tsx': entry(),
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Plain.tsx');
    expect(res.stderr).toContain('Gone.tsx');
  });

  it.each([
    ['короткая причина', { reason: 'мало', since: 'abc1234' }],
    [
      'причина-отписка',
      { reason: 'legacy, потом разберёмся с этим файлом', since: 'abc1234' },
    ],
    ['нет since', { reason: 'честная причина длиннее двадцати символов' }],
  ])('запись с дефектом (%s) — красный', (_name, bad) => {
    const res = runGate(GATE, {
      'webapp/src/Sheet.tsx': INLINE_NO_HOOK,
      'scripts/history-sheet-baseline.json': baseline({
        'webapp/src/Sheet.tsx': bad,
      }),
    });
    expect(res.status).toBe(1);
  });
});

// Каждая запись настоящего бейслайна — не «вес», а решение: причина внятная, у
// записи есть since. Протухание (файл получил хук/исчез) настоящий гейт ловит в
// CI на реальном дереве; здесь пинится форма записей.
describe('scripts/history-sheet-baseline.json — форма записей', () => {
  it.each(Object.entries(REAL_BASELINE))(
    '%s: причина и since на месте',
    (_file, e) => {
      expect(e.reason.trim().length).toBeGreaterThanOrEqual(20);
      expect(e.since.trim()).not.toBe('');
    },
  );

  it('бейслайн — только webapp/ и shared/ (мини-апп вне зоны гейта)', () => {
    for (const file of Object.keys(REAL_BASELINE)) {
      expect(file).toMatch(/^(webapp|shared)\/src\/.+\.tsx$/);
    }
  });
});
