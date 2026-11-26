// Принудитель полноты реестра слияния (парный к table-registry.spec.ts,
// который так же сторожит реестры удаления/переноса ТАБЛИЦ, и к
// encryption-coverage.spec.ts).
//
// Правило без механизма не работает — и это поле уже дало течь: перенос
// строился как «UI-флаги плюс addressForm», а «мои схемы», «мои режимы»,
// настройки уведомлений и кастомизация мини-аппа молча исчезали вместе с
// удаляемой строкой source. Человек сливал аккаунты ради синхронизации и
// терял ровно то, ради чего сливал (разбор 2026-08-29).
//
// Механизм: каждое скалярное поле User в schema.prisma обязано иметь решение
// в USER_MERGE_RULES. Новое поле без решения роняет этот тест.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MERGED_USER_FIELDS,
  USER_MERGE_RULES,
  mergedValue,
  type MergeRule,
} from './merge-user-rules';

const ROOT = join(__dirname, '..', '..');
const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');

const PRISMA_SCALARS = new Set([
  'String',
  'Int',
  'Boolean',
  'DateTime',
  'Json',
  'BigInt',
  'Float',
  'Decimal',
  'Bytes',
]);

function enumNames(): Set<string> {
  return new Set([...schema.matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1]));
}

/** Скалярные поля модели User и их `@default(...)`, если он есть. */
function userScalars(): Array<{ name: string; raw: string }> {
  const model = /model\s+User\s+\{([\s\S]*?)\n\}/.exec(schema);
  if (!model) throw new Error('model User не найдена в schema.prisma');
  const scalars = new Set([...PRISMA_SCALARS, ...enumNames()]);
  const out: Array<{ name: string; raw: string }> = [];
  for (const line of model[1].split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('@@')) continue;
    const parts = t.split(/\s+/);
    if (parts.length < 2) continue;
    const type = parts[1].replace(/[?[\]]/g, '');
    if (scalars.has(type)) out.push({ name: parts[0], raw: t });
  }
  return out;
}

describe('Реестр слияния ↔ schema.prisma', () => {
  const fields = userScalars();

  it('sanity: парсер находит скаляры User и не путает их со связями', () => {
    const names = fields.map((f) => f.name);
    expect(names).toContain('mySchemaIds');
    expect(names).toContain('notifyLocalHour');
    // Связи — не скаляры, решения им не нужны.
    expect(names).not.toContain('notifications');
    expect(names.length).toBeGreaterThanOrEqual(40);
  });

  it('каждое скалярное поле User имеет решение', () => {
    const missing = fields
      .map((f) => f.name)
      .filter((n) => !USER_MERGE_RULES[n]);
    // Новое поле → внеси в USER_MERGE_RULES: переноси или объясни, почему нет.
    // Молча потерять его при слиянии больше нельзя.
    expect(missing).toEqual([]);
  });

  it('реестр не содержит полей, которых в схеме уже нет', () => {
    const known = new Set(fields.map((f) => f.name));
    const stale = Object.keys(USER_MERGE_RULES).filter((f) => !known.has(f));
    expect(stale).toEqual([]);
  });

  it('у каждого skip есть непустая причина', () => {
    const silent = Object.entries(USER_MERGE_RULES)
      .filter(([, r]) => r.kind === 'skip')
      .filter(([, r]) => (r as { reason: string }).reason.trim().length < 10);
    expect(silent).toEqual([]);
  });

  // Значение preference — это признак «пользователь не трогал». Разъедется со
  // схемой — и настройка перестанет переноситься ровно у тех, кто оставил
  // дефолт, то есть молча и незаметно.
  it('fallback у preference совпадает с @default в схеме', () => {
    const mismatched: string[] = [];
    for (const { name, raw } of fields) {
      const rule = USER_MERGE_RULES[name];
      if (!rule || rule.kind !== 'preference') continue;
      const m = /@default\(([^)]*)\)/.exec(raw);
      if (!m) {
        mismatched.push(`${name}: в схеме нет @default`);
        continue;
      }
      const literal = m[1].trim().replace(/^"|"$/g, '');
      const expected = String(rule.fallback);
      if (literal !== expected) {
        mismatched.push(`${name}: схема ${literal} ≠ реестр ${expected}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('ядро продукта переносится, а не теряется', () => {
    // Именно эти два поля пропадали и делали слияние бессмысленным.
    expect(USER_MERGE_RULES.mySchemaIds).toEqual({ kind: 'union' });
    expect(USER_MERGE_RULES.myModeIds).toEqual({ kind: 'union' });
    expect(MERGED_USER_FIELDS).toEqual(
      expect.arrayContaining(['mySchemaIds', 'myModeIds', 'uiPrefs']),
    );
  });

  it('второй фактор и состояние движка не переносятся', () => {
    for (const f of [
      'totpSecret',
      'totpRecoveryCodes',
      'notifyLastEvalDate',
      'notifyReminderSeq',
    ]) {
      expect(USER_MERGE_RULES[f].kind).toBe('skip');
    }
  });
});

describe('mergedValue — семантика правил', () => {
  const rule = (kind: MergeRule['kind']): MergeRule => ({ kind }) as MergeRule;

  it('flag: true побеждает, обратно не откатывается', () => {
    expect(mergedValue(rule('flag'), true, false)).toBe(true);
    expect(mergedValue(rule('flag'), false, true)).toBeUndefined();
    expect(mergedValue(rule('flag'), true, true)).toBeUndefined();
  });

  it('union: объединение без дублей, порядок target сохраняется', () => {
    expect(mergedValue(rule('union'), ['b', 'c'], ['a', 'b'])).toEqual([
      'a',
      'b',
      'c',
    ]);
    // Нечего добавлять — обновления нет, лишний UPDATE не шлём.
    expect(mergedValue(rule('union'), ['a'], ['a', 'b'])).toBeUndefined();
  });

  it('union: у source не массив — target не портится', () => {
    expect(mergedValue(rule('union'), null, ['a'])).toBeUndefined();
  });

  it('fillEmpty: заполняем пустое, чужой выбор не затираем', () => {
    expect(mergedValue(rule('fillEmpty'), 'dark', null)).toBe('dark');
    expect(mergedValue(rule('fillEmpty'), 'dark', 'light')).toBeUndefined();
    expect(mergedValue(rule('fillEmpty'), null, null)).toBeUndefined();
  });

  it('private: побеждает более закрытое значение', () => {
    // Человек закрыл доступ в одном из аккаунтов — слияние не открывает его.
    expect(mergedValue(rule('private'), false, true)).toBe(false);
    // Обратно — никогда.
    expect(mergedValue(rule('private'), true, false)).toBeUndefined();
    expect(mergedValue(rule('private'), false, false)).toBeUndefined();
  });

  it('preference: берём source, только если target остался на дефолте', () => {
    const r: MergeRule = { kind: 'preference', fallback: 21 };
    expect(mergedValue(r, 8, 21)).toBe(8);
    // У target свой выбор — не трогаем.
    expect(mergedValue(r, 8, 9)).toBeUndefined();
    // У source тоже дефолт — переносить нечего.
    expect(mergedValue(r, 21, 21)).toBeUndefined();
  });

  it('skip: не возвращает значения никогда', () => {
    const r: MergeRule = { kind: 'skip', reason: 'причина' };
    expect(mergedValue(r, 'что угодно', null)).toBeUndefined();
  });
});
