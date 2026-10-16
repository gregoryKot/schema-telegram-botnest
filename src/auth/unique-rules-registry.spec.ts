// Сверка UNIQUE_RULES (merge.service.ts) со schema.prisma — правило №4
// (аудит 2026-10-11, «Долг с механизмом»).
//
// merge() перед переносом строк сначала удаляет у source те, что столкнутся
// по unique-констрейнту с target. Таблица с @@unique([userId, …]), которой нет
// в UNIQUE_RULES, роняет merge 23505 внутри транзакции — у тех, у кого больше
// всего данных. Раньше константу сверяла только литеральная копия в
// merge.service.rules.spec.ts (то есть код с самим собой), а схему не читал
// никто. Здесь правила выводятся из schema.prisma и сравниваются в обе стороны.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  UNIQUE_RULES,
  USER_OWNED_TABLES,
  SECURITY_SENSITIVE_TABLES,
} from './merge.service';

type Rule = { table: string; cols: string[] };

const schemaText = readFileSync(
  join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
  'utf8',
);

/** Первая пара [...] из `@@unique(...)` / `@@id(...)`, в том числе с
 * именованными аргументами (`fields: [a, b], map: "m"`). */
function fieldList(attrArgs: string): string[] {
  const m = /\[([^\]]*)\]/.exec(attrArgs);
  return m
    ? m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/** Констрейнты с userId по тексту schema.prisma → правила «таблица + прочие
 * колонки ключа». Комментарии срезаются: в них встречаются `@@unique`. */
function deriveUniqueRules(schema: string): Rule[] {
  const out: Rule[] = [];
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) {
    const body = m[2].replace(/\/\/.*$/gm, '');
    const keys: string[][] = [];
    for (const a of body.matchAll(/@@(?:unique|id)\(([^)]*)\)/g)) {
      keys.push(fieldList(a[1]));
    }
    // userId BigInt @id / @unique — ключ из одной колонки userId.
    if (/^\s*userId\s+BigInt\??[^\n]*@(?:id|unique)\b/m.test(body)) {
      keys.push(['userId']);
    }
    for (const k of keys) {
      if (k.includes('userId')) {
        out.push({ table: m[1], cols: k.filter((c) => c !== 'userId') });
      }
    }
  }
  return out;
}

/** Порядок колонок ключа на семантику DELETE…EXISTS не влияет — сравниваем как
 * множество; порядок таблиц тоже не важен. */
const normalize = (rules: Rule[]) =>
  rules.map((r) => `${r.table}[${[...r.cols].sort().join(',')}]`).sort();

describe('UNIQUE_RULES ↔ schema.prisma', () => {
  describe('парсер (контрольные образцы: молчащий парсер сделал бы сверку вечнозелёной)', () => {
    it('реальная схема: найдены правила, в том числе известные', () => {
      const rules = normalize(deriveUniqueRules(schemaText));
      expect(rules.length).toBeGreaterThanOrEqual(12);
      expect(rules).toEqual(
        expect.arrayContaining(['Rating[date,needId]', 'TherapistRequest[]']),
      );
    });

    it('читает все формы констрейнта и игнорирует лишнее', () => {
      const fixture = [
        'model A {',
        '  userId BigInt',
        '  x String',
        '  @@unique(fields: [userId, x], map: "m")',
        '}',
        'model B {',
        '  userId BigInt',
        '  type String',
        '  @@id([userId, type])',
        '}',
        'model C {',
        '  userId BigInt @id',
        '}',
        'model D {',
        '  userId BigInt? @unique',
        '}',
        'model E {',
        '  provider String',
        '  providerId String',
        '  userId BigInt',
        '  @@unique([provider, providerId])',
        '  @@index([userId, provider])',
        '}',
        'model F {',
        '  userId BigInt',
        '  // @@unique([userId, ghost])',
        '}',
      ].join('\n');
      expect(normalize(deriveUniqueRules(fixture))).toEqual([
        'A[x]',
        'B[type]',
        'C[]',
        'D[]',
      ]);
    });
  });

  it('правила совпадают с констрейнтами схемы в обе стороны', () => {
    const derived = new Set(normalize(deriveUniqueRules(schemaText)));
    const declared = new Set(normalize(UNIQUE_RULES));
    const noRule = [...derived].filter((r) => !declared.has(r));
    const noConstraint = [...declared].filter((r) => !derived.has(r));
    expect({
      'констрейнт со userId есть в schema.prisma, правила в UNIQUE_RULES нет (merge упадёт 23505)':
        noRule,
      'правило есть в UNIQUE_RULES, констрейнта в schema.prisma нет':
        noConstraint,
    }).toEqual({
      'констрейнт со userId есть в schema.prisma, правила в UNIQUE_RULES нет (merge упадёт 23505)':
        [],
      'правило есть в UNIQUE_RULES, констрейнта в schema.prisma нет': [],
    });
  });

  it('таблица с unique по userId переносится merge-ем (USER_OWNED_TABLES), а не теряется', () => {
    const owned = new Set<string>(USER_OWNED_TABLES);
    // Эти таблицы удаляются целиком на шаге 0 и правил не требуют.
    const sensitive = new Set<string>(SECURITY_SENSITIVE_TABLES);
    const stray = deriveUniqueRules(schemaText)
      .map((r) => r.table)
      .filter((t) => !owned.has(t) && !sensitive.has(t));
    expect(stray).toEqual([]);
  });
});
