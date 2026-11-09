// docs/ENV.md обязан быть синхронен с реестром — иначе документация тихо
// протухает (та же болезнь, что нашли гейты пула/дедфайлов у других
// реестров проекта). Не «сгенерировать заново», а сверить: каждая
// переменная реестра упомянута в документе, и наоборот; колонка формата
// называет тот валидатор, что стоит в коде, а назначение начинается с фразы
// реестра (аудит 2026-10: у ADMIN_BOOKING_KEY в таблице было `any` при
// проверке длины в коде, описание JWT_SECRET расходилось с purpose).
import { readFileSync } from 'fs';
import { join } from 'path';
import { ENV_REGISTRY } from './env-registry.entries';
import type { EnvVarSpec } from './env-registry';

const DOC_PATH = join(__dirname, '..', '..', 'docs', 'ENV.md');
const doc = readFileSync(DOC_PATH, 'utf8');

interface DocRow {
  required: string;
  format: string;
  purpose: string;
}

/** Строки таблиц: `| \`NAME\` | обязательность | формат | назначение |`. */
const rows = new Map<string, DocRow>();
for (const line of doc.split('\n')) {
  const m = line.match(/^\| `([A-Z][A-Z0-9_]*)` \| (.*?) \| (.*?) \| (.*) \|$/);
  if (m) rows.set(m[1], { required: m[2], format: m[3], purpose: m[4] });
}

// Имя валидатора в коде → подпись в колонке формата. Стрелка-свойство
// объекта `formats` носит имя ключа (`formats.hex32.name === 'hex32'`);
// именованные валидаторы модулей — своё имя, здесь только переименования.
const LABEL_ALIAS: Record<string, string> = {
  checkSecret32: 'secret32',
  checkTelegramUsername: 'telegramUsername',
  adminKeyFormat: 'adminKey',
};
// Безымянные валидаторы (инлайн-стрелка в записи, замыкание `oneOf`) имени не
// несут — их подпись в доке свободная и сверяется поведением ниже.
const ANONYMOUS = new Set(['', 'format']);

function codeLabel(spec: EnvVarSpec): string | null {
  const name = spec.format.name;
  return ANONYMOUS.has(name) ? null : (LABEL_ALIAS[name] ?? name);
}

// «any» — валидатор, принимающий что угодно. Пробы — значения, которые
// отвергает хотя бы один формат реестра (пусто, пробел, мусор, короткое).
const ANY_PROBES = ['', ' ', 'x', 'not a url', '0', '-1'];
const acceptsAll = (spec: EnvVarSpec) =>
  ANY_PROBES.every((v) => spec.format(v) === null);

const plain = (s: string) => s.replace(/`/g, '').trim();

describe('docs/ENV.md синхронен с ENV_REGISTRY', () => {
  it('каждая переменная реестра упомянута в докe (в code-разметке `NAME`)', () => {
    const missing = ENV_REGISTRY.filter(
      (e) => !doc.includes(`\`${e.name}\``),
    ).map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it('в доке нет переменной, которой больше нет в реестре (протухшая документация)', () => {
    const mentioned = [...doc.matchAll(/\| `([A-Z][A-Z0-9_]*)` \|/g)].map(
      (m) => m[1],
    );
    const known = new Set(ENV_REGISTRY.map((e) => e.name));
    const stale = mentioned.filter((name) => !known.has(name));
    expect(stale).toEqual([]);
  });

  it('таблица не пуста', () => {
    const mentioned = [...doc.matchAll(/\| `([A-Z][A-Z0-9_]*)` \|/g)];
    expect(mentioned.length).toBe(ENV_REGISTRY.length);
    expect(rows.size).toBe(ENV_REGISTRY.length);
  });

  it('колонка «На проде» совпадает с requiredInProd', () => {
    const wrong = ENV_REGISTRY.filter((e) => {
      const want = e.requiredInProd ? '**обязательна**' : 'опциональна';
      return rows.get(e.name)?.required !== want;
    }).map((e) => e.name);
    expect(wrong).toEqual([]);
  });

  it('колонка формата называет валидатор из кода', () => {
    const wrong = ENV_REGISTRY.flatMap((e) => {
      const want = codeLabel(e);
      const got = rows.get(e.name)?.format;
      return want !== null && got !== want
        ? [`${e.name}: ${got} ≠ ${want}`]
        : [];
    });
    expect(wrong).toEqual([]);
  });

  it('формат `any` в доке ⇔ валидатор в коде принимает что угодно', () => {
    const wrong = ENV_REGISTRY.filter(
      (e) => (rows.get(e.name)?.format === 'any') !== acceptsAll(e),
    ).map((e) => e.name);
    expect(wrong).toEqual([]);
  });

  it('`oneOf(a, b)` в доке — ровно те значения, что принимает код', () => {
    const wrong = ENV_REGISTRY.flatMap((e) => {
      const m = rows.get(e.name)?.format.match(/^oneOf\((.*)\)$/);
      if (!m) return [];
      const allowed = m[1].split(',').map((v) => v.trim());
      const ok =
        allowed.every((v) => e.format(v) === null) &&
        e.format('__не_из_списка__') !== null;
      return ok ? [] : [e.name];
    });
    expect(wrong).toEqual([]);
  });

  it('назначение в доке начинается с purpose реестра (дальше — подробности)', () => {
    const wrong = ENV_REGISTRY.filter(
      (e) =>
        !plain(rows.get(e.name)?.purpose ?? '').startsWith(plain(e.purpose)),
    ).map((e) => e.name);
    expect(wrong).toEqual([]);
  });

  // Контроль сверки: подмена формата в строке краснит, а не проходит молча.
  it('контроль: подпись формата, расходящаяся с кодом, ловится', () => {
    const spec = ENV_REGISTRY.find((e) => e.name === 'ENCRYPTION_KEY')!;
    expect(codeLabel(spec)).toBe('hex32');
    expect(
      codeLabel({ ...spec, format: (v: string) => (v ? null : 'x') }),
    ).toBe(null);
    expect(acceptsAll(spec)).toBe(false);
  });
});
