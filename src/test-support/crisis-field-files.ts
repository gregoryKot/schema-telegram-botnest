// Какие файлы фронтенда держат поле свободного текста и где у них кризисный
// путь (правило №7) — общая выборка двух трипваеров:
//   `src/security/crisis-path.invariants.spec.ts` — классификация по тексту
//     файла (детекция, allowlist, дочерний контрол);
//   `src/security/crisis-card-behavior.invariants.spec.ts` — у каждого поля с
//     детекцией есть поведенческий тест (ввод фразы → телефон доверия в DOM).
// Одна выборка на оба, иначе списки разъехались бы (правило №4).
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from '../security/collect-source-files';
import { hasFreeTextInput } from './free-text-inputs';

export const ROOT = join(__dirname, '..', '..');

// Директории фронтендов, где вообще может жить пользовательский ввод.
const FRONTEND_DIRS = ['webapp/src', 'shared/src'];

// `<LimitedTextarea` — общая обёртка поля с пределом длины (shared): без неё в
// регэкспе все поля, переехавшие на обёртку, выпали бы из-под трипваера.
const TEXTAREA_RE = /<(?:textarea|LimitedTextarea)/i;
// Детекцией считается и прямой вызов detectCrisis*, и общий гейт-примитив
// <BookingCrisisNote> (webapp/src/components/booking/BookingCrisisNote.tsx,
// форма записи на визитке) — он инкапсулирует detectCrisisAny + карточку; что
// сам он реально зовёт detectCrisis, фиксирует отдельный тест трипваера.
export const DETECT_CRISIS_RE = /detectCrisis|BookingCrisisNote/;

const rel = (abs: string) => abs.replace(ROOT + '/', '');
const read = (relPath: string) => readFileSync(join(ROOT, relPath), 'utf8');

const frontendTsx = (includeTests = false) =>
  FRONTEND_DIRS.flatMap((dir) =>
    collectSourceFiles(join(ROOT, dir), { extensions: ['.tsx'], includeTests }),
  ).map(rel);

/** .tsx-файлы с <textarea> (свободный текст пользователя), путь от корня репозитория. */
export const TEXTAREA_FILES = frontendTsx().filter((f) =>
  TEXTAREA_RE.test(read(f)),
);

/** .tsx-файлы с <input> свободного текста (признак — free-text-inputs.ts). */
export const FREE_INPUT_FILES = frontendTsx().filter((f) =>
  hasFreeTextInput(read(f)),
);

// (C1) Дочерний контрол: поле живёт в одном файле, детекция — в другом, и
// названный файл-детектор проверяет ИМЕННО этот текст (как — в `why`).
export const INPUT_CHILD_CONTROLS: Record<
  string,
  { detector: string; why: string }
> = {
  'webapp/src/components/exercises/beliefCheck/EviList.tsx': {
    detector: 'webapp/src/components/exercises/BeliefCheckEx.tsx',
    why: 'доводы за/против: detectCrisisAny(forInput, ...forList) у родителя',
  },
  'webapp/src/components/caseFlow/CaseChipGrid.tsx': {
    detector: 'shared/src/case/quick/useCaseQuickFlow.ts',
    why: '«своё» тело/импульс пишется в поля быстрого потока на каждый ввод (bodyOwn/impulseOwn): detectCrisisAny(scene, bodyOwn, impulseOwn)',
  },
};

/**
 * Поля, которые обязаны показывать карточку: файл со свободным текстом и
 * детекцией в нём самом, плюс дочерние контролы с детектором у родителя.
 */
export function crisisFieldFiles(): string[] {
  const own = [...new Set([...TEXTAREA_FILES, ...FREE_INPUT_FILES])].filter(
    (f) => DETECT_CRISIS_RE.test(read(f)),
  );
  return [...own, ...Object.keys(INPUT_CHILD_CONTROLS)].sort();
}

// Строка харнесса webapp/src/test-support/crisisCardHarness.ts: первый
// аргумент — путь файла с полем.
const BEHAVIOR_ROW_RE = /describeCrisisField\(\s*'([^']+)'/g;

/** Файлы полей, у которых в тестах фронтенда есть поведенческая строка харнесса. */
export function behaviorRowFiles(): string[] {
  const rows = frontendTsx(true)
    .filter((f) => /\.test\.tsx$/.test(f))
    .flatMap((f) => [...read(f).matchAll(BEHAVIOR_ROW_RE)].map((m) => m[1]));
  return [...new Set(rows)].sort();
}

/**
 * Разбор сверки: поля без поведенческой строки (и без записи «ещё не покрыт»),
 * протухшие записи «ещё не покрыт» и строки, указывающие не на поле с детекцией.
 * Чистая функция — оба исхода пинятся на синтетике в спеке трипваера.
 */
export function behaviorGaps(
  fields: string[],
  rows: string[],
  pending: Record<string, string>,
  exists: (f: string) => boolean,
): { missing: string[]; stale: string[]; orphan: string[] } {
  return {
    missing: fields.filter((f) => !rows.includes(f) && !pending[f]),
    stale: Object.keys(pending).filter(
      (f) => !fields.includes(f) || rows.includes(f),
    ),
    orphan: rows.filter((f) => !exists(f) || !fields.includes(f)),
  };
}
