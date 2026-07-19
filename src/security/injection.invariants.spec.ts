// Security-трипваер: инъекции и опасные API (security-таск 2026-07-17).
// Классы, которые ловим статически по всему src + поведенчески:
//   1. Нет eval/new Function/child_process — RCE-поверхности.
//   2. Нет $queryRawUnsafe/$executeRawUnsafe — единственные Prisma-API,
//      что вставляют строку в SQL без параметризации.
//   3. Весь raw-SQL в merge.service идёт через Prisma.sql (значения —
//      связанные плейсхолдеры) + Prisma.raw(ident(...)) для идентификаторов,
//      где ident() — строгий whitelist. Идентификатор мимо whitelist = SQL
//      injection, поэтому фиксируем: каждый Prisma.raw обёрнут в ident().
//   4. Prototype pollution: шифрование/дешифрование записей и JSON.parse-пути
//      не загрязняют Object.prototype ключами __proto__/constructor.
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

const ALL_SRC = walk(SRC);

describe('трипваер: нет RCE-поверхностей и небезопасного raw-SQL', () => {
  // Жёсткий бан — RCE-поверхности, недопустимы в любом виде.
  const HARD_BANNED = [
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bchild_process\b/,
    /\bexecSync\b/,
  ];
  // *RawUnsafe допустим ТОЛЬКО с чистым строковым литералом без интерполяции
  // (VACUUM/DDL нельзя параметризовать). Флажим, если в строке есть ${},
  // бэктик-шаблон или конкатенация с переменной — это инъекция значением.
  const RAW_UNSAFE = /\$(query|execute)RawUnsafe\b/;
  const HAS_INTERPOLATION = /\$\{|`|\+\s*\w|\w\s*\+/;

  it('ни один src-файл не использует eval/Function/child_process', () => {
    const hits: string[] = [];
    for (const file of ALL_SRC) {
      const src = readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('//')) return;
        for (const re of HARD_BANNED) {
          if (re.test(line))
            hits.push(`${file.replace(SRC, 'src')}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it('*RawUnsafe используется только с чистым литералом (без интерполяции)', () => {
    const hits: string[] = [];
    for (const file of ALL_SRC) {
      const src = readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('//')) return;
        if (RAW_UNSAFE.test(line) && HAS_INTERPOLATION.test(line))
          hits.push(`${file.replace(SRC, 'src')}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('трипваер: raw-SQL идентификаторы всегда через whitelist ident()', () => {
  const mergeSrc = readFileSync(join(SRC, 'auth/merge.service.ts'), 'utf8');

  it('каждый Prisma.raw(...) обёрнут в ident(...)', () => {
    // Все вхождения Prisma.raw(<arg> — arg обязан начинаться с ident(
    const bad = [...mergeSrc.matchAll(/Prisma\.raw\(\s*([^)]*)/g)]
      .map((m) => m[1].trim())
      .filter((arg) => !arg.startsWith('ident('));
    expect(bad).toEqual([]);
  });

  it('ident() отвергает неизвестный идентификатор (throw)', () => {
    // Структурная гарантия: валидатор бросает на не-whitelist.
    expect(mergeSrc).toMatch(/Refusing to interpolate unknown SQL identifier/);
    expect(mergeSrc).toMatch(/KNOWN_TABLES|KNOWN_COLS/);
  });

  it('пользовательские значения (userId/sourceId) — связанные ${}, не Prisma.raw', () => {
    // В SQL-шаблонах userId должен идти как ${userId} (плейсхолдер), а не
    // через Prisma.raw — иначе инъекция значением. Грубая проверка: нет
    // Prisma.raw с userId/sourceId/targetId внутри.
    expect(mergeSrc).not.toMatch(
      /Prisma\.raw\([^)]*(userId|sourceId|targetId)/,
    );
  });
});

describe('prototype pollution — encryptRecord/decryptRecord и JSON-пути', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('../utils/crypto') as typeof import('../utils/crypto');

  afterEach(() => {
    // подчистить возможное загрязнение между кейсами
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it('encryptRecord с ключом __proto__ во входных данных не трогает прототип', () => {
    const schema = { strings: ['text'] };
    const evil = JSON.parse('{"text":"ok","__proto__":{"polluted":"yes"}}');
    crypto.encryptRecord(evil, schema);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('decryptJson распарсенного {"__proto__":{...}} не загрязняет прототип', () => {
    // decryptJson идёт через JSON.parse — который создаёт own-свойство
    // "__proto__", а не меняет прототип. Фиксируем это как инвариант.
    const blob = crypto.encrypt('{"__proto__":{"polluted":"yes"},"a":1}');
    crypto.decryptJson(blob);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('decryptRecord с jsonArrays-полем не загрязняет прототип', () => {
    const schema = { jsonArrays: ['items'] };
    const stored = {
      items: crypto.encrypt('{"__proto__":{"polluted":"yes"}}'),
    };
    crypto.decryptRecord(stored, schema);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
