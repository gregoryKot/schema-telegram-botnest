// Принудитель покрытия шифрования (аудит 2026-07-20, парный к
// auth/table-registry.spec.ts, который так же принуждает реестры удаления/merge).
//
// Правило CLAUDE.md «Шифрование» держалось на честном слове — и дало течь:
// черновики дневников (DiaryDraft.data), ответы YSQ, заявки терапевтов,
// алиасы клиентов и email в magic-link токенах лежали plaintext, хотя весь
// остальной свободный текст шифруется. Правило без механизма принуждения
// не работает.
//
// Механизм: каждое String/Json-поле каждой модели schema.prisma обязано быть
// явно классифицировано здесь — либо `enc` (шифруется; значение — файл
// сервиса, где живёт encrypt, наличие проверяется), либо `plain` (осознанный
// plaintext; значение — причина). Новое неклассифицированное поле роняет
// этот тест → добавление колонки со свободным текстом без решения о
// шифровании невозможно.
import { readFileSync } from 'fs';
import { join } from 'path';
// Реестр вынесен в обычный модуль (правило №4 CLAUDE.md): он нужен в рантайме
// сервису экспорта данных (src/account/data-export.service.ts), чтобы знать,
// какое поле и чем расшифровывать, а не только на этапе теста. Этот спек —
// единственный потребитель, который его ПРОВЕРЯЕТ; поведение не изменилось.
import { FIELD_POLICY } from './encryption-policy';

const ROOT = join(__dirname, '..', '..');
const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

// ── Парсер schema.prisma: все String/Json-поля всех моделей ────────────────
function schemaFields(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const modelRe = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema)) !== null) {
    const fields = [...m[2].matchAll(/^\s*(\w+)\s+(String|Json)\??(\s|$)/gm)];
    if (fields.length) out[m[1]] = fields.map((f) => f[1]);
  }
  return out;
}

describe('Реестр шифрования ↔ schema.prisma', () => {
  const models = schemaFields();

  it('sanity: парсер находит модели и текстовые поля', () => {
    expect(Object.keys(models).length).toBeGreaterThanOrEqual(35);
    expect(models.UserLetter).toEqual(['text']);
  });

  it('каждое String/Json-поле классифицировано (enc или plain с причиной)', () => {
    const missing: string[] = [];
    for (const [model, fields] of Object.entries(models)) {
      for (const f of fields) {
        if (!FIELD_POLICY[model]?.[f]) missing.push(`${model}.${f}`);
      }
    }
    // Новое поле → внеси в FIELD_POLICY: либо шифруй (enc + файл сервиса),
    // либо объясни, почему plaintext допустим. Молча — нельзя.
    expect(missing).toEqual([]);
  });

  it('реестр не содержит устаревших полей', () => {
    const stale: string[] = [];
    for (const [model, fields] of Object.entries(FIELD_POLICY)) {
      for (const f of Object.keys(fields)) {
        if (!models[model]?.includes(f)) stale.push(`${model}.${f}`);
      }
    }
    expect(stale).toEqual([]);
  });

  it('каждое enc-поле реально шифруется в указанном файле', () => {
    const broken: string[] = [];
    for (const [model, fields] of Object.entries(FIELD_POLICY)) {
      for (const [f, policy] of Object.entries(fields)) {
        if (!('enc' in policy)) continue;
        let src: string;
        try {
          src = readFileSync(join(ROOT, policy.enc), 'utf8');
        } catch {
          broken.push(`${model}.${f}: файла ${policy.enc} нет`);
          continue;
        }
        const quoted = src.includes(`'${f}'`) || src.includes(`"${f}"`);
        const assigned = new RegExp(`\\b${f}\\s*[:=]\\s*\\(?\\s*enc`).test(src);
        if (!/encrypt/.test(src) || (!quoted && !assigned))
          broken.push(`${model}.${f}: в ${policy.enc} не видно шифрования`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('каждое plain-поле имеет осмысленную причину', () => {
    const vague: string[] = [];
    for (const [model, fields] of Object.entries(FIELD_POLICY)) {
      for (const [f, policy] of Object.entries(fields)) {
        if ('plain' in policy && policy.plain.length < 10)
          vague.push(`${model}.${f}`);
      }
    }
    expect(vague).toEqual([]);
  });
});
