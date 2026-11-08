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
  behaviorRowFiles,
  crisisFieldFiles,
} from '../test-support/crisis-field-files';

// Поле с детекцией, у которого поведенческой строки ещё нет, — с причиной.
// Может только СОКРАЩАТЬСЯ (потолок ниже): с 2026-11 покрыты все поля, новый
// вход приезжает со строкой харнесса в своём тесте, а не записью сюда.
const BEHAVIOR_PENDING: Record<string, string> = {};

const FIELDS = crisisFieldFiles();
const ROWS = behaviorRowFiles();

describe('трипваер: кризисная карточка показывается для каждого поля (правило №7)', () => {
  it('у каждого поля с детекцией есть строка describeCrisisField (или запись с причиной)', () => {
    const missing = FIELDS.filter(
      (f) => !ROWS.includes(f) && !BEHAVIOR_PENDING[f],
    );
    expect(missing).toEqual([]);
  });

  it('BEHAVIOR_PENDING не разросся (может только сокращаться)', () => {
    expect(Object.keys(BEHAVIOR_PENDING).length).toBeLessThanOrEqual(0);
  });

  it('записи «ещё не покрыт» не протухли: поле на месте и строки у него нет', () => {
    const stale = Object.keys(BEHAVIOR_PENDING).filter(
      (f) => !FIELDS.includes(f) || ROWS.includes(f),
    );
    expect(stale).toEqual([]);
  });

  it('строки харнесса указывают на существующие поля с детекцией', () => {
    // Переименованный файл или поле, у которого убрали детекцию, оставили бы
    // строку, которая сверяет не то: путь — ключ сверки, он обязан быть живым.
    const orphan = ROWS.filter(
      (f) => !existsSync(join(ROOT, f)) || !FIELDS.includes(f),
    );
    expect(orphan).toEqual([]);
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
