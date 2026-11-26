// Верх «Паттернов» одним решением: какой лист-герой стоит наверху, какого он вида и как рядом с ним
// показать вход в тест YSQ (строка на телефоне, плитка на компьютере). Ревью g5 r1: под вводной
// «Узнать свои схемы» стояла вторая глиняная плашка теста с тем же «Начать/Продолжить», а под героем
// глины («Покинутость», детские режимы) — плитка теста той же глины: два листа подряд читались одним
// (принципы 2 и «одно главное действие», docs/design/APP_2026-11.md).
import type { WeekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import { INTRO_MODE_ID } from '../../../../shared/src/pattern/weekPatternText';
import { ENTITY_LOOK, type SheetLook } from '../../../../shared/src/theme/entityLook';
import { hueTooNear } from '../../../../shared/src/theme/hueGap';
import { patternLook } from '../../components/patternSheet/patternHue';
import { introStep, type IntroStep } from './introStep';
import { hasLongWord } from '../../components/paper/entryLook';

/** Вид вводной — сущность шага: схемы (глина + слои), режимы — группа Критика (слива + Looming: шаг
 *  ведёт к знакомству с Критиком, а не к режимам вообще), дневник (персик + камешки). */
export const INTRO_LOOK: Record<IntroStep, SheetLook> = {
  schemas: ENTITY_LOOK.schemas,
  modes: patternLook('mode', INTRO_MODE_ID) ?? ENTITY_LOOK.modes,
  diary: ENTITY_LOOK.diary,
};

/** Вид «Паттерна недели»: бумага домена схемы или группы режима (patternLook). */
export function weekLook(top: Pick<WeekPatternTop, 'kind' | 'id'>): SheetLook {
  return patternLook(top.kind, top.id) ?? ENTITY_LOOK[top.kind === 'mode' ? 'modes' : 'schemas'];
}

export type PatternsHero =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'week'; look: SheetLook }
  | { kind: 'intro'; step: IntroStep; look: SheetLook };

interface HeroInput {
  /** Профиль и записи дневника пришли. */
  ready: boolean;
  top: WeekPatternTop | null;
  hasSchemas: boolean;
  hasModes: boolean;
  hasEntries: boolean;
}

/** Есть запись за неделю — «паттерн недели»; нет — вводная шага; всё пройдено и записи есть — ничего. */
export function patternsHero({ ready, top, hasSchemas, hasModes, hasEntries }: HeroInput): PatternsHero {
  if (!ready) return { kind: 'loading' };
  if (top) return { kind: 'week', look: weekLook(top) };
  const step = introStep(hasSchemas, hasModes);
  if (step === 'diary' && hasEntries) return { kind: 'none' };
  return { kind: 'intro', step, look: INTRO_LOOK[step] };
}

/** Вход в тест рядом с героем: hidden — не рисовать, paper — плитка на бумаге теста, white — белый лист
 *  с тенью-слоем глины (как строка теста на телефоне и вход в тест справочника). */
export type YsqEntryLook = 'hidden' | 'paper' | 'white';

/**
 * Вводная схем уже зовёт в тест («Начать тест», «Продолжить тест (N из 116)») — второй такой кнопки нет;
 * вход остаётся, только если он ведёт к результату (тест пройден, незаконченного нет: resultsOnly). Пока
 * герой грузится, вход не рисуется: вид и сама нужность зависят от героя (данные — только реальные).
 * Бумага теста — только если оттенок героя отстоит от глины теста на 40° и больше или героя нет (скрыт
 * в «Настроить экран», всё пройдено).
 */
export function ysqEntryLook(hero: PatternsHero, heroHidden: boolean, resultsOnly = false): YsqEntryLook {
  if (heroHidden || hero.kind === 'none') return 'paper';
  if (hero.kind === 'loading') return 'hidden';
  if (hero.kind === 'intro' && hero.step === 'schemas' && !resultsOnly) return 'hidden';
  return hueTooNear(hero.look.hue, ENTITY_LOOK.ysq.hue) ? 'white' : 'paper';
}

/** Класс листа-героя: слово от 13 букв («Самопожертвование», «Недисциплинированный») не встаёт рядом со знаком
 *  или во всю ширину узкого листа кеглем героя — cs-hero--long берёт кегль по ширине листа и длине слова
 *  (heroWord, client-schemas.css), а не перенос по слогам (ревью g5 r2). */
export const heroClass = (title: string, white = false): string =>
  `cs-hero${hasLongWord(title) ? ' cs-hero--long' : ''}${white ? ' pa-sheet--white' : ''}`;

/** Букв в самом длинном слове заголовка — `--cs-hero-word` для кегля cs-hero--long; ставит его тот, кто ставит
 *  класс (обёртка «Паттерна недели» — `WeekPatternCard`; заголовки вводных короче 13 букв в слове). */
export const heroWord = (title: string): number => Math.max(0, ...(title.match(/\p{L}+/gu) ?? []).map((w) => w.length));

/** Верхняя пара компьютера: «Выраженные схемы» — только с данными (или пока грузятся): пустая карточка звала
 *  «пройти справа» и стояла тусклым листом рядом с плиткой, а в колонку — над ней (ревью g5 r2). Без неё плитка
 *  теста одна во весь ряд, как строка теста на телефоне. */
export function topPair(tile: boolean, loading: boolean, expressedCount: number): { expressed: boolean; tile: boolean } {
  return { expressed: loading || expressedCount > 0, tile };
}
