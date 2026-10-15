// Тест гейта check-webvisor-fields.mjs (security#27, аудит 2026-10): текстовые
// поля на страницах визитки обязаны нести `ym-disable-keys`. Проверяет ОБА
// исхода (CLAUDE.md, «Тестовые храповики и e2e»): краснеет на регрессе и
// зеленеет на чистом дереве, включая законные случаи — ложно-красный гейт
// отключают через неделю.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runGate } from './gate-sandbox';
import { importExport } from './pattern-loader';

const APP = `
import { Navigate } from 'react-router-dom';
import { lazy } from 'react';
import { HomePage } from './pages/HomePage';
import { PayPage } from './pages/PayPage';
import { CookieBanner } from './components/CookieBanner';
import { LoginPage } from './pages/LoginPage';
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
function Root() { return (<div><CookieBanner /></div>); }
const personalRoutes = [
  { path: '/', element: <HomePage /> },
  { path: '/pay', element: <PayPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];
const appRoutes = [
  { path: '/login', element: <LoginPage /> },
];
`;
const BASE: Record<string, string> = {
  'webapp/src/App.tsx': APP,
  'webapp/src/pages/HomePage.tsx':
    'export const HomePage = () => <div>home</div>;\n',
  'webapp/src/pages/PayPage.tsx':
    'export const PayPage = () => <div>pay</div>;\n',
  'webapp/src/components/CookieBanner.tsx':
    'export const CookieBanner = () => <div>cookie</div>;\n',
  'webapp/src/pages/AdminPage.tsx':
    'export const AdminPage = () => <div className="ym-hide-content">admin</div>;\n',
  'webapp/src/pages/LoginPage.tsx':
    'export const LoginPage = () => <input type="text" />;\n',
};
const OK = '✓ Вебвизор: все текстовые поля визитки помечены';
const run = (files: Record<string, string>) =>
  runGate('check-webvisor-fields.mjs', { ...BASE, ...files });

describe('check-webvisor-fields.mjs — краснеет', () => {
  it('email без метки на странице визитки — exit 1 с файлом и строкой', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => (\n  <div>\n    <input type="email" value={e} onChange={(x) => set(x.target.value)} />\n  </div>\n);\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/pages/PayPage.tsx:3');
    expect(res.stderr).toContain('ym-disable-keys');
  });

  it('textarea без метки — exit 1', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => <textarea value={t} />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('PayPage.tsx:1');
  });

  it('поле во вложенном компоненте (через импорт) — exit 1', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        "import { F } from '../components/F';\nexport const PayPage = () => <F />;\n",
      'webapp/src/components/F.tsx':
        'export const F = () => <input placeholder="Имя" />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/components/F.tsx:1');
  });

  it('поле в общем коде shared/, импортированном страницей — exit 1', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        "import { F } from '../../../shared/src/F';\nexport const PayPage = () => <F />;\n",
      'shared/src/F.tsx': 'export const F = () => <input type="tel" />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared/src/F.tsx:1');
  });

  it('поле в компоненте вокруг страниц (Root) — exit 1', () => {
    const res = run({
      'webapp/src/components/CookieBanner.tsx':
        'export const CookieBanner = () => <input type="text" />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('CookieBanner.tsx:1');
  });

  it('метка только в комментарии не считается — exit 1', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        '// ym-disable-keys\nexport const PayPage = () => <input type="email" />;\n',
    });
    expect(res.status).toBe(1);
  });

  it('метка у ДРУГОГО поля не прикрывает соседнее — exit 1', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => (<div><input className="ym-disable-keys" type="text" /><input type="email" /></div>);\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('PayPage.tsx:1');
    expect(res.stderr).toContain('<input type="email" />'); // помечено только первое поле
    expect(res.stderr).not.toContain('<input className');
  });

  it('number без метки — exit 1: политика обещает «поля ввода не записываются» без исключений (сумма доната)', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => <input type="number" min={10} />;\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('PayPage.tsx:1');
  });

  it('data-type не принимается за type (поле с data-type="checkbox") — exit 1', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => <input data-type="checkbox" />;\n',
    });
    expect(res.status).toBe(1);
  });

  it('гейт ослеп (в App.tsx нет personalRoutes) — exit 1, а не тихий зелёный', () => {
    const res = run({
      'webapp/src/App.tsx': 'export default function App() { return null; }\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('personalRoutes');
  });
});

describe('check-webvisor-fields.mjs — зеленеет на законном', () => {
  it('чистое дерево — exit 0', () => {
    const res = run({});
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('поле с ym-disable-keys (в том числе многострочный тег со стрелкой в onChange) — exit 0', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => (\n  <input\n    type="email"\n    onChange={(e) => set(e.target.value)}\n    className="ym-disable-keys"\n  />\n);\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });

  it('checkbox, radio, range, hidden, кнопка и aria-hidden-ловушка не требуют метки', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => (<div><input type="checkbox" /><input type="radio" /><input type="range" />' +
        '<input type="hidden" /><input type="submit" /><input type="text" aria-hidden="true" tabIndex={-1} /></div>);\n',
    });
    expect(res.status).toBe(0);
  });

  it('экран под ym-hide-content (в том числе всё, что он импортирует) покрыт предком — exit 0', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'import { F } from \'../components/F\';\nexport const PayPage = () => <div className="ym-hide-content"><F /></div>;\n',
      'webapp/src/components/F.tsx': 'export const F = () => <textarea />;\n',
    });
    expect(res.status).toBe(0);
  });

  it('поле на странице вне личного сайта (appRoutes) не требует метки — Вебвизор там выключен', () => {
    const res = run({
      'webapp/src/pages/LoginPage.tsx':
        'export const LoginPage = () => <input type="email" />;\n',
    });
    expect(res.status).toBe(0);
  });

  it('number с ym-disable-keys — exit 0', () => {
    const res = run({
      'webapp/src/pages/PayPage.tsx':
        'export const PayPage = () => <input type="number" className="ym-disable-keys" />;\n',
    });
    expect(res.status).toBe(0);
  });

  it('недостижимый с визитки файл с полем не краснит гейт', () => {
    const res = run({
      'webapp/src/components/Orphan.tsx':
        'export const Orphan = () => <input type="text" />;\n',
    });
    expect(res.status).toBe(0);
  });
});

// Модуль разбора webvisor-fields-scan.mjs исполняется самим тестом, а не только
// как зависимость песочницы: его логику (тип поля, импорты, резолв) гейт-CLI
// проверяет лишь косвенно, через итоговый exit-код.
const SCAN = 'webvisor-fields-scan.mjs';
const callScan = (exportName: string, args: unknown[]): unknown =>
  JSON.parse(
    importExport(SCAN, exportName, `(fn) => fn(...${JSON.stringify(args)})`),
  );

describe('webvisor-fields-scan.mjs — разбор напрямую', () => {
  type Field = { line: number; tag: string };
  const fields = (text: string) =>
    callScan('unmarkedFields', [text]) as Field[];

  it('unmarkedFields: возвращает строку и тег поля без метки', () => {
    const out = fields('<div>\n<input type="email" />\n</div>');
    expect(out).toEqual([{ line: 2, tag: '<input type="email" />' }]);
  });

  it('unmarkedFields: тип в выражении {"text"} читается как тип, checkbox пропускается', () => {
    expect(fields('<input type={"checkbox"} />')).toEqual([]);
    expect(fields('<input type={"text"} />')).toHaveLength(1);
  });

  it('unmarkedFields: type="number" — текстовое поле (требует метки)', () => {
    expect(fields('<input type="number" />')).toHaveLength(1);
    expect(
      fields('<input type="number" className="ym-disable-keys" />'),
    ).toEqual([]);
  });

  it('unmarkedFields: > внутри {выражения} не обрывает тег раньше срока', () => {
    const out = fields(
      '<input value={a > b ? 1 : 2} className="ym-disable-keys" />',
    );
    expect(out).toEqual([]);
  });

  describe('резолв файлов и импортов', () => {
    let root: string;
    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'wv-scan-'));
      mkdirSync(join(root, 'a', 'dir'), { recursive: true });
      writeFileSync(join(root, 'a', 'one.tsx'), '');
      writeFileSync(join(root, 'a', 'two.ts'), '');
      writeFileSync(join(root, 'a', 'dir', 'index.tsx'), '');
      writeFileSync(join(root, 'a', 'style.css'), '');
    });
    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it('resolveFile: .tsx, .ts и index.tsx находятся, css и отсутствующий — null', () => {
      expect(callScan('resolveFile', [root, 'a', './one'])).toBe(
        join('a', 'one.tsx'),
      );
      expect(callScan('resolveFile', [root, 'a', './two'])).toBe(
        join('a', 'two.ts'),
      );
      expect(callScan('resolveFile', [root, 'a', './dir'])).toBe(
        join('a', 'dir', 'index.tsx'),
      );
      expect(callScan('resolveFile', [root, 'a', './style.css'])).toBeNull();
      expect(callScan('resolveFile', [root, 'a', './nope'])).toBeNull();
    });

    it('relativeImports: статические, import() и side-effect; пакеты и несуществующие пропускаются', () => {
      const text = [
        "import { X } from './one';",
        "const Y = lazy(() => import('./two'));",
        "import './dir';",
        "import React from 'react';",
        "import { Z } from './nope';",
      ].join('\n');
      expect(
        callScan('relativeImports', [root, join('a', 'host.tsx'), text]),
      ).toEqual([
        join('a', 'one.tsx'),
        join('a', 'two.ts'),
        join('a', 'dir', 'index.tsx'),
      ]);
    });
  });
});
