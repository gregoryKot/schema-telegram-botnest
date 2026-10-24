// Глава 10 политики конфиденциальности («Cookie-файлы») ↔ куки, которые
// бэкенд ставит на самом деле (правило №4: два места, обязанных совпадать).
//
// До сверки 2026-10-22 политика объявляла `tg_pkce_verifier` — куку входа
// `/api/auth/telegram-oidc`, удалённого в #725, — и строку «сессионные cookie»,
// которых нет (токен доступа живёт в памяти страницы), а `tg_link_user`,
// `link_token` и `refresh_cross` не называла вовсе. Куку добавляет бэкенд-PR,
// юридический текст живёт в другом пакете — расхождение не видел никто
// (AUDIT_2026-10, «куки в §10 политики ↔ все `res.cookie(`»). Пин проверяет
// оба направления: кука из кода названа в политике, кука из политики есть в коде.
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { collectSourceFiles } from '../../security/collect-source-files';

const ROOT = resolve(__dirname, '..', '..', '..');
const PRIVACY_PAGE = 'webapp/src/pages/PrivacyPage.tsx';

/**
 * Кука есть в коде, но в политике её нет — осознанно, с причиной и условием,
 * при котором запись протухает.
 */
const NOT_SET_IN_PROD: Record<
  string,
  { reason: string; stillTrue: () => boolean }
> = {
  gsi_nonce: {
    reason:
      'Google One Tap выключен: VITE_GOOGLE_CLIENT_ID не передаётся в сборку ' +
      'сайта (Dockerfile), кнопка не рисуется и ручку с этой кукой никто не ' +
      'зовёт. Включаешь One Tap — назови куку в главе 10',
    stillTrue: () => !read('Dockerfile').includes('VITE_GOOGLE_CLIENT_ID'),
  },
};

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Имена кук из кода: литерал в `res.cookie('…'` и константы `*_COOKIE = '…'`. */
function cookiesSetByCode(sources: string[]): Set<string> {
  const names = new Set<string>();
  for (const text of sources) {
    for (const m of text.matchAll(/\.cookie\(\s*'([a-z0-9_]+)'/g))
      names.add(m[1]);
    for (const m of text.matchAll(/_COOKIE\s*=\s*'([a-z0-9_]+)'/g))
      names.add(m[1]);
  }
  return names;
}

/** Имена из строк таблицы главы 10: `['… cookie (a, b)', '…']`. */
function cookiesNamedInPolicy(policy: string): Set<string> {
  const names = new Set<string>();
  for (const m of policy.matchAll(/\['[^']*cookie[^']*\(([^)]+)\)'/gi)) {
    for (const n of m[1].split(',')) names.add(n.trim());
  }
  return names;
}

const code = cookiesSetByCode(
  collectSourceFiles(join(ROOT, 'src')).map((p) => readFileSync(p, 'utf8')),
);
const policyText = read(PRIVACY_PAGE);
const policy = cookiesNamedInPolicy(policyText);

describe('глава 10 политики ↔ куки бэкенда', () => {
  it('сборщик видит куки входа — иначе пин зелёный впустую', () => {
    for (const n of [
      'refresh_token',
      'refresh_cross',
      'oauth_state',
      'tg_link_user',
      'link_token',
    ]) {
      expect(code).toContain(n);
    }
  });

  it('каждая кука из кода названа в политике', () => {
    const missing = [...code].filter(
      (n) => !(n in NOT_SET_IN_PROD) && !policy.has(n),
    );
    expect(missing).toEqual([]);
  });

  it('каждая кука из политики ставится кодом', () => {
    expect([...policy].filter((n) => !code.has(n))).toEqual([]);
  });

  it('исключения не протухли: у каждого есть причина, условие ещё верно', () => {
    for (const [name, { reason, stillTrue }] of Object.entries(
      NOT_SET_IN_PROD,
    )) {
      expect(code).toContain(name);
      expect(reason.length).toBeGreaterThan(40);
      expect(stillTrue()).toBe(true);
      expect(policy.has(name)).toBe(false);
    }
  });

  it('контрольный образец: прежняя строка с удалённой кукой краснеет', () => {
    const old = cookiesNamedInPolicy(
      "['OAuth-cookie (oauth_state, tg_pkce_verifier)', 'Временные…'],",
    );
    expect([...old].filter((n) => !code.has(n))).toEqual(['tg_pkce_verifier']);
    // и новая кука в коде без строки в политике — тоже
    const extra = cookiesSetByCode(["res.cookie('new_cookie', v, {})"]);
    expect([...extra].filter((n) => !policy.has(n))).toEqual(['new_cookie']);
  });
});
