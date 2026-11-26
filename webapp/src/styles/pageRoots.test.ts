// @vitest-environment node
// Корни страниц вне кабинета занимают всю ширину #root (аудит b26). `#root { display: flex }`
// (index.css) — ряд: корень без `flex: 1` и `width: 100%` сжимается по содержимому — на 1280
// вход 2FA и служебные страницы липли к левому краю, на 390 силуэт прыгал 180 → 358px по мере
// загрузки. CSS в jsdom не исполняется — сверяем исходники. Список расширяемый: новая страница
// вне AppShell (b27 — аккаунт и привязка, b28 — оплата, установка, юридические) дописывает свой
// корень строкой в ROOTS.
import { describe, it, expect } from 'vitest';
import { cssBundle } from './cssBundle.test-helpers';

/** Файл стилей → классы корней страниц, которые лежат прямо в #root. */
const ROOTS: Record<string, readonly string[]> = {
  'auth-login.css': ['.al-root', '.al-expired'], // вход и 2FA (AuthShell), протухший вызов 2FA
  'auth-service.css': ['.as-root'], // служебные страницы (ServicePage, ServiceLoading)
  'auth-account.css': ['.aa-root', '.am-root'], // /account; /link и /account/merge (MergeSpread)
  'auth-pay.css': ['.ap-page', '.ap-skel', '.ap-failed'], // подписка и донат (PayLayout), силуэт загрузки, сбой загрузки
  'install-page.css': ['.ip-root'], // /install (InstallFrame)
  'legal.css': ['.lg-root'], // юридические страницы (LegalPage)
  'paper-app.css': ['.pa-outcome'], // исходы: 404, /auth/error, автовход в мессенджере, сбои
};

const css = (f: string) => cssBundle(f).replace(/\/\*[\s\S]*?\*\//g, '');
/** Объявления правил, где селектор стоит отдельным пунктом списка (вне зависимости от @media). */
const body = (src: string, sel: string) =>
  [...src.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].split(',').map((s) => s.trim()).includes(sel)).map((m) => m[2]).join(';');

describe('корни страниц вне кабинета — во всю ширину #root', () => {
  const rows = Object.entries(ROOTS).flatMap(([file, classes]) => classes.map((cls) => [file, cls] as const));
  it.each(rows)('%s %s: flex: 1 и width: 100%', (file, cls) => {
    const decl = body(css(file), cls);
    expect(decl, `${cls} объявлен в ${file}`).not.toBe('');
    expect(decl).toMatch(/(^|;)\s*flex:\s*1(\s|;|$)/);
    expect(decl).toMatch(/(^|;)\s*width:\s*100%/);
  });

  it('контроль: правило без flex: 1 не проходит сверку', () => {
    expect(body('.x { display: flex; width: 100%; }', '.x')).not.toMatch(/(^|;)\s*flex:\s*1(\s|;|$)/);
  });
});

// Корень растянут по высоте #root (`height: 100vh`): `align-items: center` у высокого содержимого уводил верх
// за край окна — недостижимо (ревью b27: /link и /account/merge на 1280; b26: /auth/confirm на 320).
// Центр — только `safe center`, и у содержимого запасное `margin-block: auto` (браузер без `safe`).
const CENTER_SLOTS: Record<string, readonly (readonly [string, string])[]> = {
  'auth-login.css': [['.al-side', '.al-side > .al-form']],
  'auth-service.css': [['.as-root', '.as-root > .as-card']],
  'auth-account.css': [['.am-root', '.am-root > .am-spread']],
  'paper-app.css': [['.pa-outcome', '.pa-outcome-card']],
};
const UNSAFE_CENTER = /(^|;)\s*align-items:\s*center\s*(;|$)/;

describe('корни страниц центрируют безопасно', () => {
  const roots = [...Object.entries(ROOTS), ...Object.entries(CENTER_SLOTS).map(([f, pairs]) => [f, pairs.map((p) => p[0])] as const)]
    .flatMap(([file, classes]) => classes.map((cls) => [file, cls] as const));
  it.each(roots)('%s %s: без небезопасного align-items: center', (file, cls) => {
    expect(body(css(file), cls)).not.toMatch(UNSAFE_CENTER);
  });

  const slots = Object.entries(CENTER_SLOTS).flatMap(([file, pairs]) => pairs.map(([root, child]) => [file, root, child] as const));
  it.each(slots)('%s %s: safe center и запасное margin-block: auto у %s', (file, root, child) => {
    expect(body(css(file), root)).toMatch(/align-items:\s*safe center/);
    expect(body(css(file), child)).toMatch(/margin-block:\s*auto/);
  });

  it('контроль: небезопасный центр ловится, safe — нет', () => {
    expect(body('.x { display: flex; align-items: center; }', '.x')).toMatch(UNSAFE_CENTER);
    expect(body('.x { display: flex; align-items: safe center; }', '.x')).not.toMatch(UNSAFE_CENTER);
  });
});

// #root — flex-ряд высотой 100vh: растянутый (stretch) корень держит ровно 100vh, а высокое содержимое
// вылезает за него — нижние поля и тень листа срезались (ревью b26: /auth/confirm на 320). Корень растёт с
// содержимым: align-self: flex-start при min-height окна.
describe('корни страниц растут с содержимым', () => {
  const rows = Object.entries(ROOTS).flatMap(([file, classes]) => classes.map((cls) => [file, cls] as const));
  it.each(rows)('%s %s: align-self: flex-start', (file, cls) => {
    expect(body(css(file), cls)).toMatch(/align-self:\s*flex-start/);
  });
});
