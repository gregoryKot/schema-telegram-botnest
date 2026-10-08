// Тест гейта check-tap-targets.mjs (правило «Онбординг и очевидность»
// CLAUDE.md, дизайн-аудит 2026-08, К3): пофайловый храповик квадратных
// тап-целей меньше 44×44. Проверяет оба исхода — гейт краснеет на регрессе и
// зеленеет на чистом дереве — и КОНТРОЛЬНЫЕ образцы границ (правило №15 п.2):
// у каждого «не считается» ниже есть парный образец, который по-прежнему
// краснеет, иначе гейт, глухой ко всему, тоже прошёл бы эти проверки.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, cleanupTmp } from './gate-sandbox';

const GATE = 'check-tap-targets.mjs';
const BASELINE = 'scripts/tap-targets-baseline.json';
const CLEAN = '✓ Храповик мелких тап-целей: 0 (без роста)';

// Один tsx-файл на чистом бейслайне: возвращает результат прогона гейта.
function scan(source: string, baseline: Record<string, number> = {}) {
  return runGate(GATE, {
    [BASELINE]: JSON.stringify(baseline),
    'webapp/src/foo.tsx': source,
  });
}

describe('check-tap-targets.mjs', () => {
  describe('что краснеет', () => {
    it('новый файл с <button> 30×30 — exit 1, путь:строка и размеры в отчёте', () => {
      const res = scan(
        [
          'export const x = (',
          '  <button style={{ width: 30, height: 30 }} onClick={() => go()}>',
          '    ×',
          '  </button>',
          ');',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain(
        'webapp/src/foo.tsx: новый файл с 1 мелкими тап-целями',
      );
      expect(res.stderr).toContain('L2 <button> 30×30');
      expect(res.stderr).toContain('hitboxStyle');
      expect(res.stderr).toContain('shared/src/utils/hitbox.ts');
    });

    it('зеленеет на чистом дереве: тот же файл с размерами 44×44', () => {
      const res = scan(
        'export const x = <button style={{ width: 44, height: 44 }} onClick={go} />;\n',
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('строковые размеры ("30px") и пара minWidth/minHeight тоже ловятся', () => {
      const res = scan(
        [
          "export const a = <button style={{ width: '30px', height: '28px' }} />;",
          'export const b = <button style={{ minWidth: 24, minHeight: 24 }} />;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('новый файл с 2 мелкими тап-целями');
      expect(res.stderr).toContain('L1 <button> 30×28');
      expect(res.stderr).toContain('L2 <button> 24×24');
    });

    it('интерактивность — onClick или role="button"/"checkbox"/"slider" на любом теге', () => {
      const res = scan(
        [
          'export const a = <div onClick={go} style={{ width: 20, height: 20 }} />;',
          'export const b = <span role="button" style={{ width: 20, height: 20 }} />;',
          'export const c = <div role="checkbox" style={{ width: 20, height: 20 }} />;',
          'export const d = <div role="slider" style={{ width: 20, height: 20 }} />;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('новый файл с 4 мелкими тап-целями');
    });

    it('многострочный тег, `=>` и `>` внутри onClick не обрывают разбор тега', () => {
      const res = scan(
        [
          'export const x = (',
          '  <button',
          '    onClick={() => setOpen(a > b)}',
          '    aria-label="Закрыть"',
          '    style={{',
          "      background: 'var(--surface)',",
          '      width: 22,',
          '      height: 22,',
          '    }}',
          '  >',
          '    ×',
          '  </button>',
          ');',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('L2 <button> 22×22');
    });
  });

  describe('что осознанно не считается (с контрольным образцом, который краснеет)', () => {
    it('элемент через hitboxStyle не считается, соседняя кнопка без него — считается', () => {
      const res = scan(
        [
          'const hit = hitboxStyle(34, 34);',
          // правильный приём: размер приходит из хелпера
          'export const a = <button style={hit.outer} onClick={go}><i style={hit.inner} /></button>;',
          // даже если рядом с хелпером остался числовой размер — тег прошёл через него
          'export const b = <button onClick={go} style={{ ...hitboxStyle(34, 34).outer, width: 30, height: 30 }} />;',
          // контроль: тот же размер без хелпера обязан краснеть
          'export const c = <button onClick={go} style={{ width: 30, height: 30 }} />;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('новый файл с 1 мелкими тап-целями');
      expect(res.stderr).toContain('L4 <button> 30×30');
      expect(res.stderr).not.toContain('L2');
      expect(res.stderr).not.toContain('L3');
    });

    it('промах по ОДНОЙ стороне не считается (кнопка во всю ширину, padding 8px 0)', () => {
      const res = scan(
        [
          "export const a = <button style={{ padding: '8px 0' }}>Далее</button>;",
          "export const b = <button style={{ width: '100%', height: 33 }}>Далее</button>;",
          'export const c = <button style={{ width: 30, height: 44 }}>Далее</button>;',
          // образец NeedRatingBar: flex: 1 + padding 17px 0, высота не задана числом
          "export const d = <button style={{ flex: 1, padding: '17px 0' }}>5</button>;",
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('minWidth поднимает планку width в любом порядке ключей — это уже одна сторона', () => {
      const res = scan(
        [
          'export const a = <button style={{ width: 30, minWidth: 44, height: 30 }} />;',
          'export const b = <button style={{ minWidth: 44, width: 30, height: 30 }} />;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('неинтерактивный элемент (точка, иконка) не считается', () => {
      const res = scan(
        [
          'export const a = <div style={{ width: 8, height: 8 }} />;',
          'export const b = <span style={{ width: 20, height: 20 }}>i</span>;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('значения-не-числа, переменные и стиль вне инлайна не считаются', () => {
      const res = scan(
        [
          "export const a = <button style={{ width: 'var(--tap)', height: 'var(--tap)' }} />;",
          'export const b = <button style={{ width: size, height: size }} />;',
          "export const c = <button style={{ width: '100%', height: '2rem' }} />;",
          'export const d = <button style={{ width: `${n}px`, height: `${n}px` }} />;',
          'export const e = <button style={{ width: 30 + gap, height: 30 + gap }} />;',
          'export const f = <button style={styles.btn} />;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('вложенное условие в style не угадывается: считается только верхний уровень', () => {
      const res = scan(
        [
          'export const a = (',
          '  <button',
          '    onClick={go}',
          '    style={{ ...(compact ? { width: 20, height: 20 } : {}), color: "red" }}',
          '  />',
          ');',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('закомментированный тег, обобщения и сравнения за JSX не принимаются', () => {
      const res = scan(
        [
          '// <button onClick={go} style={{ width: 20, height: 20 }} />',
          '/* <button onClick={go} style={{ width: 20, height: 20 }} /> */',
          'const [n, setN] = useState<number>(0);',
          'const less = n < 5 && n <= 6;',
          '',
        ].join('\n'),
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });

    it('спеки/тесты и каталоги вне SCAN_DIRS не сканируются', () => {
      const bad = 'export const x = <button style={{ width: 20, height: 20 }} onClick={go} />;\n';
      const res = runGate(GATE, {
        [BASELINE]: JSON.stringify({}),
        'webapp/src/foo.test.tsx': bad,
        'webapp/src/foo.spec.tsx': bad,
        'src/backend.tsx': bad,
        'game/Sign.tsx': bad,
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain(CLEAN);
    });
  });

  describe('храповик', () => {
    const SMALL = 'export const x = <button style={{ width: 20, height: 20 }} onClick={go} />;\n';

    it('рост сверх бейслайна — exit 1 с "было → стало"', () => {
      const res = runGate(GATE, {
        [BASELINE]: JSON.stringify({ 'schema-miniapp/src/known.tsx': 1 }),
        'schema-miniapp/src/known.tsx': SMALL + SMALL,
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('schema-miniapp/src/known.tsx: 1 → 2');
    });

    it('снижение — exit 0, предлагает зафиксировать --update', () => {
      const res = runGate(GATE, {
        [BASELINE]: JSON.stringify({ 'shared/src/known.tsx': 2 }),
        'shared/src/known.tsx': SMALL,
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('1 < 2 — стало лучше');
    });

    it('файл в бейслайне, где тап-цели закончились, — не протухший, а улучшение', () => {
      const res = runGate(GATE, {
        [BASELINE]: JSON.stringify({ 'shared/src/known.tsx': 2 }),
        'shared/src/known.tsx': 'export const x = <button style={{ width: 44, height: 44 }} />;\n',
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('0 < 2 — стало лучше');
    });

    it('протухшая запись (файла из бейслайна больше нет) — exit 1 с понятным текстом', () => {
      const res = runGate(GATE, {
        [BASELINE]: JSON.stringify({ 'webapp/src/gone.tsx': 1 }),
        'webapp/src/other.tsx': 'export const x = 1;\n',
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('webapp/src/gone.tsx: запись протухла');
      expect(res.stderr).toContain('node scripts/check-tap-targets.mjs --update');
    });

    it('точный бейслайн без роста — exit 0', () => {
      const res = runGate(GATE, {
        [BASELINE]: JSON.stringify({ 'webapp/src/known.tsx': 1 }),
        'webapp/src/known.tsx': SMALL,
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('✓ Храповик мелких тап-целей: 1 (без роста)');
    });

    it('--verbose печатает файл:строка и размеры', () => {
      const res = runGate(
        GATE,
        {
          [BASELINE]: JSON.stringify({ 'webapp/src/known.tsx': 1 }),
          'webapp/src/known.tsx': 'const pad = 1;\n' + SMALL,
        },
        { args: ['--verbose'] },
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('webapp/src/known.tsx (1)');
      expect(res.stdout).toContain('L2 <button> 20×20');
    });

    it('нет бейслайна — понятная ошибка, exit 1', () => {
      const res = runGate(GATE, { 'webapp/src/clean.tsx': 'export const x = 1;\n' });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('Нет бейслайна');
    });

    it('--update пишет отсортированный бейслайн с насчитанными значениями', () => {
      const res = runGate(
        GATE,
        {
          'webapp/src/z.tsx': SMALL,
          'webapp/src/a.tsx': SMALL + SMALL,
          'webapp/src/clean.tsx': 'export const x = 1;\n',
        },
        { args: ['--update'], keepTmp: true },
      );
      expect(res.status).toBe(0);
      const written = JSON.parse(readFileSync(join(res.tmp, BASELINE), 'utf8'));
      expect(Object.keys(written)).toEqual(['webapp/src/a.tsx', 'webapp/src/z.tsx']);
      expect(written).toEqual({ 'webapp/src/a.tsx': 2, 'webapp/src/z.tsx': 1 });
      cleanupTmp(res.tmp);
    });
  });
});
