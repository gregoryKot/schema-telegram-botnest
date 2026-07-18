// Security-трипваер: секреты и PII не попадают в логи (security-таск
// 2026-07-17). Логи Amvera доступны шире, чем БД, и не шифруются. Если в
// logger.* интерполировать значение токена/пароля/ключа или РАСШИФРОВАННЫЙ
// свободный текст — секрет/чужая терапевтическая запись утекут в лог-стрим.
// Инвариант: ни один logger-вызов не интерполирует опасное ЗНАЧЕНИЕ.
// (Имя переменной в текстовом сообщении — 'BOT_TOKEN not set' — безопасно.)
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

// Опасные ЗНАЧЕНИЯ внутри ${...} интерполяции logger-аргумента.
const DANGER_IN_INTERP =
  /\$\{[^}]*(password|refreshToken|accessToken|rawRefresh|JWT_SECRET|ENCRYPTION_KEY|\bdecrypt\(|req\.body|\.initData)[^}]*\}/;

// Захватываем аргументы каждого logger-вызова (могут быть многострочными).
const LOGGER_CALL =
  /logger\.(?:log|warn|error|debug|verbose)\(([\s\S]*?)\)\s*[;,]/g;

describe('трипваер: логи не содержат секретов/расшифрованного текста', () => {
  const files = walk(SRC);

  it('нашлись logger-вызовы (санити)', () => {
    const total = files.reduce(
      (n, f) => n + [...readFileSync(f, 'utf8').matchAll(LOGGER_CALL)].length,
      0,
    );
    expect(total).toBeGreaterThan(50);
  });

  it('ни один logger-вызов не интерполирует опасное значение', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(LOGGER_CALL)) {
        if (DANGER_IN_INTERP.test(m[1])) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${f.replace(SRC, 'src')}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('нет логирования всего req/request body целиком', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(LOGGER_CALL)) {
        // JSON.stringify(req...) / ${req.body} — целиком тело в лог
        if (/JSON\.stringify\(\s*req\b|\$\{\s*req\.body\s*\}/.test(m[1])) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${f.replace(SRC, 'src')}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
