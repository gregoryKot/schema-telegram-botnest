// Security-трипваер: нет SSRF через server-side fetch (security-таск
// 2026-07-17). Все исходящие запросы сервера идут на литеральные URL
// (IdP OAuth, Robokassa, Zoom, Resend, Telegram API) либо на адрес из
// конфига (APPLE_CALDAV_URL — задаёт админ/env). Если URL fetch собрать из
// пользовательского ввода (req/body/params/query) — атакующий заставит
// сервер ходить во внутреннюю сеть/метадату облака. Инвариант: ни один
// fetch не строит URL из запроса.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts') && !/\.spec\.ts$/.test(p)) out.push(p);
  }
  return out;
}

// Первый аргумент fetch(...) — до первой запятой верхнего уровня (грубо).
const FETCH_CALL = /\bfetch\(\s*([^,)]*)/g;
// Пользовательский источник URL.
const USER_SOURCED =
  /\breq\b|\brequest\b|\bbody\b|\bparams\b|\.query\b|\bdto\b/;

describe('трипваер: server-side fetch не строит URL из запроса (SSRF)', () => {
  const files = walk(SRC);

  it('нашлись fetch-вызовы (санити)', () => {
    const total = files.reduce(
      (n, f) => n + [...readFileSync(f, 'utf8').matchAll(FETCH_CALL)].length,
      0,
    );
    expect(total).toBeGreaterThan(5);
  });

  it('URL каждого fetch — литерал или конфиг, не пользовательский ввод', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(FETCH_CALL)) {
        if (USER_SOURCED.test(m[1])) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(
            `${f.replace(SRC, 'src')}:${line}: fetch(${m[1].trim()}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
