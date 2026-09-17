/**
 * Экран узнавания (шаг 8 потока «Разбор случая») — собирает то, что человек
 * видит ПОСЛЕ разбора, целиком из его собственных ответов. Ни одна строка из
 * контент-банков (caseFrames/caseBodyChips/caseImpulses) не имеет права
 * появиться здесь вместо ответа человека — правило CLAUDE.md про
 * хардкод-заглушки касается и этого экрана: то, что человек читает как своё,
 * обязано быть его данными, а не нашей формулировкой за него.
 *
 * Термин «режим» объясняется дословно и один раз — при первом разборе
 * (caseCount === 0). На повторных разборах абзац не повторяется: человек уже
 * знает термин, и повтор читается как «бот меня не помнит» (правило
 * онбординга — объяснение не должно превращаться в шаблонную заглушку).
 *
 * Один источник для webapp/schema-miniapp (правило №3 CLAUDE.md).
 */
import type { CaseAnswers, CaseTraits, Tr } from './caseTypes';
import { modeClinicalName } from '../mode/modeDisplayName';
// caseCriterion.ts — модуль параллельного агента (правило проекта: этот файл
// его не создаёт, только импортирует готовый API критерия Jacob).
import { caseVerdict, buildVerdictReply } from './caseCriterion';

export interface RecognitionView {
  /** Цепочка «сцена → тело → порыв» из его ответов. */
  chain: { scene: string; body: string; impulse: string };
  /** Абзац «что такое режим» — ТОЛЬКО при первом разборе. */
  termParagraph: string | null;
  /** Отклик по вердикту критерия. */
  verdictReply: string;
  /** Клиническое имя режима — для справки, не заголовком. */
  clinicalName: string;
  /** Приметы для карточки. */
  traits: CaseTraits;
}

export interface RecognitionCtx {
  /** Сколько разборов уже было ДО этого — 0 = самый первый. */
  caseCount: number;
  tr: Tr;
  /** Подписи выбранных телесных чипов, в порядке bodyChipIds. */
  bodyLabels: string[];
  /** Подписи выбранных чипов порыва, в порядке impulseChipIds. */
  impulseLabels: string[];
}

/** Дословный текст термина — вставляется как есть, не перефразируется. */
const TERM_PARAGRAPH =
  'Полчаса назад было нормально — сейчас внутри пусто. За полчаса человек не ' +
  'меняется. Просто вперёд вышла одна часть и забрала управление: тело, ' +
  'мысли и порыв разом. Такие части называют режимами.';

const TRIGGER_LIMIT = 60;

/** Плейсхолдер «своего» чипа в контент-банках — единственный признак, по
 *  которому узнаём место для bodyOwn/impulseOwn среди уже готовых подписей. */
const isOwnPlaceholder = (label: string): boolean => /^своё/i.test(label);

const lowerFirst = (text: string): string =>
  text ? text[0].toLowerCase() + text.slice(1) : text;

/**
 * Список подписей чипов → одна строка для примет/цепочки: склеены через
 * «, », каждая опущена в нижний регистр первой буквы, а плейсхолдер «Своё…»
 * заменён на слова самого человека (если он их вписал). Пустой список даёт
 * пустую строку — не бросает исключение.
 */
function joinTraitLabels(
  labels: string[],
  ownText: string | undefined,
): string {
  return labels
    .map((raw) => {
      const label = raw.trim();
      if (!label) return '';
      if (isOwnPlaceholder(label)) return ownText?.trim() ?? '';
      return lowerFirst(label);
    })
    .filter(Boolean)
    .join(', ');
}

/** Обрезка сцены человека до ~limit символов по границе слова — без обрыва
 *  посреди слова и без хардкода чужого текста вместо его формулировки. */
function truncateAtWord(text: string, limit: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  const cut = trimmed.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  const boundary = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${boundary.trimEnd()}…`;
}

/**
 * Собирает экран узнавания. Чистая функция — вся вариативность приходит
 * через answers/ctx, ничего не читается извне.
 */
export function buildRecognition(
  answers: CaseAnswers,
  ctx: RecognitionCtx,
): RecognitionView {
  const bodyText = joinTraitLabels(ctx.bodyLabels, answers.bodyOwn);
  const impulseText = joinTraitLabels(ctx.impulseLabels, answers.impulseOwn);
  const scene = answers.scene.trim();

  const verdict = caseVerdict(answers.criterion);

  return {
    chain: { scene, body: bodyText, impulse: impulseText },
    termParagraph: ctx.caseCount === 0 ? TERM_PARAGRAPH : null,
    verdictReply: buildVerdictReply(ctx.tr)[verdict],
    clinicalName: modeClinicalName(answers.modeId),
    traits: {
      body: bodyText,
      trigger: truncateAtWord(scene, TRIGGER_LIMIT),
      impulse: impulseText,
    },
  };
}

/**
 * Итоговый экран — «зачем дневник» опытом, а не обещанием: сколько уже
 * заняло и что покажет вторая запись.
 */
export function buildDiaryPayoff(tr: Tr): string {
  return tr(
    'Это была первая запись в дневнике — заняла три минуты. Вторая покажет, что у тебя повторяется.',
    'Это была первая запись в дневнике — заняла три минуты. Вторая покажет, что у вас повторяется.',
  );
}

export interface CardPayoff {
  /** Почему приметы стоит собрать именно сейчас. */
  headline: string;
  /** Что это даст на следующем разборе. */
  detail: string;
}

/**
 * «Зачем карточка» — показывается на ВТОРОМ случае с тем же режимом: часть
 * повторилась, и это повод перестать выбирать её из тридцати пяти заново.
 *
 * Имя режиму даёт человек, и рода его мы не знаем: «Стена» женского, «Гонщик»
 * мужского, «Пусто» среднего. Поэтому фразы построены так, чтобы согласования
 * с именем не возникало вовсе — никаких «её приметы» и «встаёт первой».
 */
export function buildCardPayoff(tr: Tr, alias: string): CardPayoff {
  return {
    headline: tr(
      `${alias} приходит второй раз. Пора собрать приметы в одном месте — так узнаёшь этот режим за секунду, а не задним числом.`,
      `${alias} приходит второй раз. Пора собрать приметы в одном месте — так узнаёте этот режим за секунду, а не задним числом.`,
    ),
    detail:
      `Когда приметы записаны, дневник предлагает ${alias} сразу — ` +
      'выбирать из тридцати пяти больше не придётся.',
  };
}
