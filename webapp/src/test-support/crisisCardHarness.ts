// Поведенческая проверка кризисного пути (правило №7): для поля свободного
// текста ввод кризисной фразы показывает карточку с телефоном доверия и
// детской линией, обычная фраза — нет. Одна механика на все поля: строка
// `describeCrisisField('<путь файла с полем>', { open, enter })` в тесте
// компонента, рядом с его моками.
//
// Трипваер `src/security/crisis-card-behavior.invariants.spec.ts` читает
// первый аргумент каждого вызова и сверяет: у каждого файла с полем и
// детекцией есть такая строка (или запись «ещё не покрыт» с причиной). До
// этого трипваер засчитывал упоминание detectCrisis* в тексте файла, а не
// показ карточки для ЭТОГО поля (docs/open/audit-2026-10.md).
//
// Сравнение — с числом телефонов на экране ДО ввода: у части экранов есть
// постоянный блок помощи с тем же номером, и «номер где-то в DOM» ничего не
// доказывал бы.
import { describe, it, expect } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { CRISIS_HOTLINES, detectCrisis } from '../utils/crisisMarkers';

/** Фраза, которую ловит crisisMarkers (образец — crisisMarkers.test.ts). */
export const CRISIS_PHRASE = 'не хочу жить';
/** Контрольный образец: обычная фраза без кризисных маркеров. */
export const NEUTRAL_PHRASE = 'Сегодня был спокойный день';

export type CrisisFieldScenario = {
  /** Что за поле, если в файле их несколько. */
  label?: string;
  /** Отрисовать экран и дойти до поля. */
  open: () => unknown;
  /** Ввести текст в поле (и сделать шаг, после которого карточка обязана быть видна). */
  enter: (text: string) => unknown;
};

const hotlineCounts = () =>
  CRISIS_HOTLINES.map((h) => screen.queryAllByText(h.display).length);

const flush = () => act(async () => {});

async function openAndEnter(s: CrisisFieldScenario, text: string): Promise<number[]> {
  await s.open();
  await flush();
  const before = hotlineCounts();
  await s.enter(text);
  await flush();
  return before;
}

/**
 * Кризисная фраза → на экране прибавились обе линии (взрослая и детская).
 * `timeout` — только для самопроверки харнесса: красный исход ждёт полный бюджет waitFor.
 */
export async function expectCrisisCardShown(s: CrisisFieldScenario, timeout?: number): Promise<void> {
  expect(detectCrisis(CRISIS_PHRASE), 'фраза харнесса больше не ловится crisisMarkers').toBe(true);
  const before = await openAndEnter(s, CRISIS_PHRASE);
  await waitFor(() => {
    const now = hotlineCounts();
    CRISIS_HOTLINES.forEach((h, i) =>
      expect(now[i], `после кризисной фразы нет ${h.display}`).toBeGreaterThan(before[i]),
    );
  }, { timeout });
}

/** Обычная фраза → телефонов на экране столько же, сколько до ввода. */
export async function expectNoCrisisCard(s: CrisisFieldScenario): Promise<void> {
  expect(detectCrisis(NEUTRAL_PHRASE), 'контрольная фраза ловится crisisMarkers').toBe(false);
  const before = await openAndEnter(s, NEUTRAL_PHRASE);
  expect(hotlineCounts(), 'карточка на обычной фразе').toEqual(before);
}

/**
 * Пара тестов на поле: кризисная фраза → карточка, обычная → нет.
 * `field` — путь файла с полем от корня репозитория, по нему сверяет трипваер.
 */
export function describeCrisisField(field: string, s: CrisisFieldScenario): void {
  const name = field.split('/').pop() + (s.label ? ` — ${s.label}` : '');
  describe(`кризисный путь: ${name}`, () => {
    it('кризисная фраза → телефон доверия и детская линия на экране', () => expectCrisisCardShown(s));
    it('обычная фраза → карточки нет', () => expectNoCrisisCard(s));
  });
}
