// Трипваер: у каждого поля свободного текста с кризисной детекцией есть
// ПОВЕДЕНЧЕСКИЙ тест — рендер, ввод кризисной фразы, телефон доверия и детская
// линия в DOM; обычная фраза — карточки нет (правило №7).
//
// Зачем поверх crisis-path.invariants.spec.ts: тот засчитывает упоминание
// detectCrisis* в тексте файла, а не показ карточки для ЭТОГО поля. Так поле
// «Запрос» формы записи жило в allowlist как «лид-форма», а «своё слово» на
// экране имени части проверялось только после отправки (docs/open/audit-2026-10.md).
//
// Как устроено: строка `describeCrisisField('<путь файла с полем>', …)` в тесте
// компонента (харнесс webapp/src/test-support/crisisCardHarness.ts) — vitest
// гоняет её в CI; здесь сверка, что строка есть у каждого файла из выборки
// (src/test-support/crisis-field-files.ts) либо файл стоит в
// BEHAVIOR_PENDING с причиной. Новое поле с детекцией без строки — красное.
import { existsSync } from 'fs';
import { join } from 'path';
import {
  ROOT,
  behaviorGaps,
  behaviorRowFiles,
  crisisFieldFiles,
} from '../test-support/crisis-field-files';

// Поле с детекцией, у которого поведенческой строки ещё нет, — с причиной.
// Может только СОКРАЩАТЬСЯ (потолок ниже): с 2026-11 покрыты все поля, новый
// вход приезжает со строкой харнесса в своём тесте, а не записью сюда.
const BEHAVIOR_PENDING: Record<string, string> = {};

const FIELDS = crisisFieldFiles();
const ROWS = behaviorRowFiles();
const GAPS = behaviorGaps(FIELDS, ROWS, BEHAVIOR_PENDING, (f) =>
  existsSync(join(ROOT, f)),
);

describe('трипваер: кризисная карточка показывается для каждого поля (правило №7)', () => {
  it('у каждого поля с детекцией есть строка describeCrisisField (или запись с причиной)', () => {
    expect(GAPS.missing).toEqual([]);
  });

  it('BEHAVIOR_PENDING не разросся (может только сокращаться)', () => {
    expect(Object.keys(BEHAVIOR_PENDING).length).toBeLessThanOrEqual(0);
  });

  it('записи «ещё не покрыт» не протухли: поле на месте и строки у него нет', () => {
    expect(GAPS.stale).toEqual([]);
  });

  it('строки харнесса указывают на существующие поля с детекцией', () => {
    // Переименованный файл или поле, у которого убрали детекцию, оставили бы
    // строку, которая сверяет не то: путь — ключ сверки, он обязан быть живым.
    expect(GAPS.orphan).toEqual([]);
  });

  it('выборка не ослепла: известные поля и строки на месте', () => {
    // Контрольный образец: сломанный регэксп дал бы две пустые выборки и
    // зелёную сверку выше.
    for (const f of [
      'webapp/src/components/NoteSheet.tsx',
      'webapp/src/components/exercises/beliefCheck/EviList.tsx',
    ]) {
      expect(FIELDS).toContain(f);
      expect(ROWS).toContain(f);
    }
  });
});

// Оба исхода самой сверки на синтетике (выборка на настоящем дереве пуста
// по BEHAVIOR_PENDING и могла бы молча пропускать всё).
describe('behaviorGaps — оба исхода', () => {
  const fields = ['a/Field.tsx', 'a/Covered.tsx'];
  const all = () => true;

  it('поле с детекцией без строки и без записи — в missing', () => {
    const g = behaviorGaps(fields, ['a/Covered.tsx'], {}, all);
    expect(g.missing).toEqual(['a/Field.tsx']);
  });

  it('контроль: строка или запись с причиной закрывают поле', () => {
    expect(behaviorGaps(fields, fields, {}, all).missing).toEqual([]);
    const pending = { 'a/Field.tsx': 'причина' };
    expect(
      behaviorGaps(fields, ['a/Covered.tsx'], pending, all).missing,
    ).toEqual([]);
  });

  it('протухшая запись (строка появилась или поля нет) и строка-сирота — красные', () => {
    const g = behaviorGaps(
      fields,
      [...fields, 'a/Gone.tsx'],
      { 'a/Covered.tsx': 'x', 'a/Old.tsx': 'y' },
      (f) => f !== 'a/Gone.tsx',
    );
    expect(g.stale.sort()).toEqual(['a/Covered.tsx', 'a/Old.tsx']);
    expect(g.orphan).toEqual(['a/Gone.tsx']);
  });
});
