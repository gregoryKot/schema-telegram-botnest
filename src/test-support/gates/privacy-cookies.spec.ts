// Глава 10 политики конфиденциальности («Cookie-файлы», таблицы —
// webapp/src/pages/privacy/cookies.ts) ↔ куки, которые бэкенд ставит на самом
// деле (правило №4: два места, обязанных совпадать).
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
const POLICY_COOKIES = 'webapp/src/pages/privacy/cookies.ts';

/**
 * Кука названа в политике, но ставит её не бэкенд, а чужой скрипт на странице
 * сайта, — с причиной и условием, при котором запись протухает.
 */
const SET_BY_THIRD_PARTY: Record<
  string,
  { reason: string; stillTrue: () => boolean }
> = {
  g_state: {
    reason:
      'ставит скрипт Google на странице входа (окно «Продолжить как…», #863); ' +
      'грузит его webapp/src/hooks/gsiScript.ts. Скрипт убран — убери и строку',
    stillTrue: () =>
      read('webapp/src/hooks/gsiScript.ts').includes(
        'https://accounts.google.com/gsi/client',
      ),
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
const policy = cookiesNamedInPolicy(read(POLICY_COOKIES));

describe('глава 10 политики ↔ куки бэкенда', () => {
  it('сборщик видит куки входа — иначе пин зелёный впустую', () => {
    for (const n of [
      'refresh_token',
      'refresh_cross',
      'oauth_state',
      'gsi_nonce',
      'tg_link_user',
      'link_token',
    ]) {
      expect(code).toContain(n);
    }
  });

  it('каждая кука из кода названа в политике', () => {
    expect([...code].filter((n) => !policy.has(n))).toEqual([]);
  });

  it('каждая кука из политики ставится кодом или названным чужим скриптом', () => {
    const orphans = [...policy].filter(
      (n) => !code.has(n) && !(n in SET_BY_THIRD_PARTY),
    );
    expect(orphans).toEqual([]);
  });

  it('исключения не протухли: у каждого есть причина, условие ещё верно', () => {
    for (const [name, { reason, stillTrue }] of Object.entries(
      SET_BY_THIRD_PARTY,
    )) {
      expect(policy.has(name)).toBe(true);
      expect(code.has(name)).toBe(false);
      expect(reason.length).toBeGreaterThan(40);
      expect(stillTrue()).toBe(true);
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
