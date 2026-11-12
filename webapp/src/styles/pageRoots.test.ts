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
