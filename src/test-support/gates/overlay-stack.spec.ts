// Тест гейта check-overlay-stack.mjs: под-лист с z-index ниже родителя
// (инцидент 2026-11-05: PatternSheet стоял на zIndex={205}, а опросник
// «Дополнить» (.ex2-screen, 200) и «О схеме» (SsSheet, 200) рисовались ПОД
// ним — кнопка «не работает», в DOM всё на месте).
//
// Проверяет ОБА исхода (правило «Тестовые храповики и e2e»): краснеет на
// фикстуре «родитель 205, ребёнок 200» и зеленеет на чистом дереве.
import { existsSync } from 'fs';
import { join } from 'path';
import { cleanupTmp, runGate } from './gate-sandbox';

const OK = '✓ стек оверлеев: под-листов ниже родителя нет';

const CSS = {
  'webapp/src/styles/sheet-schemas.css':
    '.ss-sheet {\n  position: fixed; inset: 0; z-index: 200; background: var(--bg);\n}\n',
  'webapp/src/styles/sheet-exercises.css':
    '.ex2-screen { position: fixed; inset: 0; z-index: 200; }\n',
};

const SHELL = {
  'webapp/src/components/SsSheet.tsx': [
    'export function SsSheet({ zIndex, children }: { zIndex?: number; children: React.ReactNode }) {',
    '  return <div className="ss-sheet" style={zIndex ? { zIndex } : undefined}>{children}</div>;',
    '}',
    "export { SsHead } from './SsHead';",
    '',
  ].join('\n'),
  'webapp/src/components/SsHead.tsx':
    'export function SsHead({ title }: { title: string }) { return <h1 className="ss-title">{title}</h1>; }\n',
  'webapp/src/components/ExScreen.tsx':
    'export function ExScreen({ children }: { children: React.ReactNode }) { return <div className="ex2-screen">{children}</div>; }\n',
  'webapp/src/components/FlashcardEx.tsx': [
    "import { ExScreen } from './ExScreen';",
    'export function ModeEx() { return <ExScreen>вопросы</ExScreen>; }',
    '',
  ].join('\n'),
};

const patternSheet = (shellTag: string) =>
  [
    "import { lazy } from 'react';",
    "import { SsSheet, SsHead } from './SsSheet';",
    "const ModeEx = lazy(() => import('./FlashcardEx').then((m) => ({ default: m.ModeEx })));",
    'export function PatternSheet({ sub }: { sub: string | null }) {',
    '  return (',
    '    <>',
    `      ${shellTag}`,
    '        <SsHead title="Покинутость" />',
    '      </SsSheet>',
    "      {sub === 'edit' && <ModeEx />}",
    '    </>',
    '  );',
    '}',
    '',
  ].join('\n');

describe('check-overlay-stack.mjs', () => {
  it('родитель zIndex={205}, ленивый под-лист .ex2-screen 200 — exit 1 с путём и строкой', () => {
    const res = runGate('check-overlay-stack.mjs', {
      ...CSS,
      ...SHELL,
      'webapp/src/components/PatternSheet.tsx': patternSheet(
        '<SsSheet zIndex={205}>',
      ),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/components/PatternSheet.tsx:10: <ModeEx> z=200 под родителем z=205',
    );
  });

  it('явный zIndex={190} на теге ребёнка ниже родителя-по-классу 200 — exit 1', () => {
    const res = runGate('check-overlay-stack.mjs', {
      ...CSS,
      ...SHELL,
      'webapp/src/components/Parent.tsx': [
        "import { SsSheet } from './SsSheet';",
        'export function Parent() {',
        '  return <SsSheet><SsSheet zIndex={190}>под</SsSheet></SsSheet>;',
        '}',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'webapp/src/components/Parent.tsx:3: <SsSheet> z=190 под родителем z=200',
    );
  });

  // Разбор вынесен в scripts/overlay-stack-scan.mjs (лимит размера, правило
  // №10); песочница копирует его вместе с гейтом — иначе гейт в тесте падал
  // бы с ERR_MODULE_NOT_FOUND, а движок был бы кодом без теста
  // (check-unwatched-code).
  it('движок scripts/overlay-stack-scan.mjs уезжает в песочницу вместе с гейтом', () => {
    const res = runGate('check-overlay-stack.mjs', CSS, { keepTmp: true });
    try {
      expect(existsSync(join(res.tmp, 'scripts/overlay-stack-scan.mjs'))).toBe(
        true,
      );
      expect(res.status).toBe(0);
    } finally {
      cleanupTmp(res.tmp);
    }
  });

  // ——— КОНТРОЛЬНЫЕ ОБРАЗЦЫ: то, что краснеть НЕ должно ———

  it('ЧИСТОЕ ДЕРЕВО: родитель без zIndex, под-листы 200 и 320 — exit 0', () => {
    const res = runGate('check-overlay-stack.mjs', {
      ...CSS,
      ...SHELL,
      'webapp/src/components/PatternSheet.tsx': patternSheet('<SsSheet>'),
      // Реэкспорт SsHead из SsSheet.tsx — не оболочка 200, а заголовок.
      'webapp/src/components/Share.tsx': [
        "import { SsSheet } from './SsSheet';",
        'export function Share({ zIndex = 320 }: { zIndex?: number }) { return <SsSheet zIndex={zIndex}>карточка</SsSheet>; }',
        '',
      ].join('\n'),
      'webapp/src/components/WithShare.tsx': [
        "import { SsSheet } from './SsSheet';",
        "import { Share } from './Share';",
        'export function WithShare() { return <><SsSheet>лист</SsSheet><Share zIndex={320} /></>; }',
        '',
      ].join('\n'),
      // Страница, которая просто рисует оверлеи (самозакрывающиеся теги),
      // оболочкой не считается — App с баннером не становится родителем 9999.
      'webapp/src/App.tsx': [
        "import { ModeEx } from './components/FlashcardEx';",
        "import { Share } from './components/Share';",
        'export function App() { return <main><Share /><ModeEx /></main>; }',
        '',
      ].join('\n'),
      // Спек с нарушением не считается.
      'webapp/src/components/Bad.test.tsx': patternSheet(
        '<SsSheet zIndex={205}>',
      ),
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });
});
