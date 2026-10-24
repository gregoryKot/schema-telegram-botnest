/**
 * «Что дальше» для карты себя — чистый форматтер, ровно одна кнопка. Правил
 * много, побеждает первая сработавшая (человеку в моменте нужен один
 * следующий шаг, а не список из девяти вариантов — правило онбординга про
 * «одно очевидное главное действие на экран»).
 *
 * Имя режима всегда берём как `alias ?? getModeLeafLabel(modeId) ?? modeId` —
 * имя, которое человек придумал сам, важнее клинического ярлыка (та же
 * логика, что у RecognitionView.clinicalName в caseRecognition.ts).
 *
 * Классификация «копинг/детский» по семье режима переиспользует
 * findTestGroupByModeId (modeTest.ts) — тот же источник семей, что и в
 * modeChain.ts (буквы COPING_FAMILIES ниже намеренно дублируют его набор:
 * modeChain.ts их не экспортирует, а трогать чужой файл вне ТЗ этой задачи
 * нельзя — правило №11 про денормализацию просит тест-сверку, а не запрет
 * дублировать константу там, где вынести её некуда).
 *
 * Один источник для webapp/schema-miniapp (правило №3 CLAUDE.md).
 */
import type { Tr } from './caseTypes';
import { modeDisplayName } from '../mode/modeDisplayName';
import { findTestGroupByModeId } from '../mode/modeTest';

export type NextStepId =
  | 'first_case'
  | 'another_case'
  | 'build_card'
  | 'coping_child'
  | 'healthy_response'
  | 'ysq_test'
  | 'needs_week'
  | 'reread_map';

export interface ModeStat {
  modeId: string;
  alias?: string;
  count: number;
  hasCard: boolean;
  /** YYYY-MM-DD — последняя дата разбора этого режима. */
  lastAt: string;
}

export interface NextStepInput {
  /** всего разборов. */
  caseCount: number;
  modeStats: ModeStat[];
  /** на карте есть детский режим. */
  hasChildMode: boolean;
  /** на карте есть копинг. */
  hasCopingMode: boolean;
  /** разборов с ответом Здорового Взрослого. */
  healthyResponseCount: number;
  /** триггер повторился. */
  repeatedTrigger: boolean;
  /** потребность повторилась в трёх разборах. */
  repeatedNeed: boolean;
  ysqDone: boolean;
  /** YYYY-MM-DD. */
  today: string;
}

export interface NextStepView {
  id: NextStepId;
  label: string;
  time?: string;
  hint?: string;
}

const COPING_FAMILIES = new Set(['avoid', 'surrender', 'control', 'grandiose']);

const FIRST_CASE_VIEW: NextStepView = {
  id: 'first_case',
  label: 'Разобрать случай',
  hint: 'Карта пустая. Первый разбор поставит первую метку.',
};

const modeName = (m: Pick<ModeStat, 'modeId' | 'alias'>): string =>
  modeDisplayName(m.modeId, m.alias);

const isCoping = (modeId: string): boolean => {
  const family = findTestGroupByModeId(modeId);
  return !!family && COPING_FAMILIES.has(family.id);
};

/** Самый заметный режим из подмножества — больше случаев, при равенстве
 *  более свежий. undefined, если под predicate ничего не подошло. */
function pickTop(
  stats: ModeStat[],
  predicate: (m: ModeStat) => boolean = () => true,
): ModeStat | undefined {
  return stats
    .filter(predicate)
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))[0];
}

/**
 * Ровно одна кнопка «что дальше» — первая подошедшая ветка побеждает.
 */
export function caseNextStep(input: NextStepInput, tr: Tr): NextStepView {
  const {
    caseCount,
    modeStats,
    hasChildMode,
    hasCopingMode,
    healthyResponseCount,
    repeatedTrigger,
    repeatedNeed,
    ysqDone,
  } = input;

  // 1. пустая карта.
  if (caseCount === 0) return FIRST_CASE_VIEW;

  // 2. один режим, один случай — ещё рано предлагать что-то, кроме второго.
  if (modeStats.length === 1 && caseCount === 1) {
    return { id: 'another_case', label: 'Разобрать ещё один случай' };
  }

  // 3. режим повторился, а карточка ещё не собрана.
  const needsCard = pickTop(modeStats, (m) => m.count >= 2 && !m.hasCard);
  if (needsCard) {
    return {
      id: 'build_card',
      label: `Собрать приметы: ${modeName(needsCard)}`,
      time: '≈ 2 мин',
    };
  }

  // 4. на карте есть копинг без опознанного детского режима за ним.
  if (hasCopingMode && !hasChildMode) {
    const coping = pickTop(modeStats, (m) => isCoping(m.modeId));
    if (coping) {
      return {
        id: 'coping_child',
        label: `Разобрать, кто стоит за ${modeName(coping)}`,
        time: '3 мин',
      };
    }
  }

  // 5. достаточно разборов, но ни разу не пробовали ответ Здорового Взрослого.
  if (caseCount >= 3 && healthyResponseCount === 0) {
    const top = pickTop(modeStats);
    if (top) {
      return { id: 'healthy_response', label: `Ответить: ${modeName(top)}` };
    }
  }

  // 6. триггер повторяется достаточно долго, а тест на схемы ещё не пройден.
  if (caseCount >= 5 && repeatedTrigger && !ysqDone) {
    return {
      id: 'ysq_test',
      label: 'Пройти тест на схемы',
      hint: tr(
        'Пройди — узнаешь, какие схемы стоят за этим чаще всего.',
        'Пройдите — узнаете, какие схемы стоят за этим чаще всего.',
      ),
    };
  }

  // 7. одна и та же потребность видна в нескольких разборах подряд.
  if (repeatedNeed) {
    return { id: 'needs_week', label: 'Посмотреть потребности за неделю' };
  }

  // 8. накопилась история, и все точечные поводы выше уже закрыты — предлагаем
  // оглянуться на карту целиком (тот же порог caseCount, что и в ветке 6:
  // за пять+ разборов накапливается на что оглядываться).
  if (caseCount >= 5) {
    return {
      id: 'reread_map',
      label: 'Перечитать карту — что изменилось за месяц',
    };
  }

  // 9. фолбэк — то же самое, что при пустой карте.
  return FIRST_CASE_VIEW;
}

/**
 * «Где я сейчас» — фраза о том, что УЖЕ видно на карте, никогда голый
 * счётчик. Данные не придумываются: если самый частый режим виден меньше
 * двух раз, про «частого гостя» не говорим.
 */
export function buildWhereIAm(input: NextStepInput, tr: Tr): string {
  const { caseCount, modeStats } = input;
  if (caseCount === 0 || modeStats.length === 0) return FIRST_CASE_VIEW.hint!;

  const top = pickTop(modeStats);
  if (!top) return FIRST_CASE_VIEW.hint!;
  const name = modeName(top);
  const word = caseWord(caseCount);

  if (caseCount === 1) {
    return `Один случай. ${name} — первая метка на карте.`;
  }

  if (top.count >= 2) {
    return tr(
      `${caseCount} ${word}. ${name} — самый частый гость: видно в ${top.count} из ${caseCount}. Обрати внимание, когда это повторяется.`,
      `${caseCount} ${word}. ${name} — самый частый гость: видно в ${top.count} из ${caseCount}. Обратите внимание, когда это повторяется.`,
    );
  }

  return `${caseCount} ${word}. Пока без повторов — каждый случай на своей метке.`;
}

/** Русское согласование «случай/случая/случаев» с числительным. */
function caseWord(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'случаев';
  if (mod10 === 1) return 'случай';
  if (mod10 >= 2 && mod10 <= 4) return 'случая';
  return 'случаев';
}
