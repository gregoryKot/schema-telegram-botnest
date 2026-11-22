// Глава «Недели» — данные: что стоит на пути, где что звучит, когда открывается и чем кончается.
// Сцена (WeekScene) только исполняет список; сценарий глав — game/GAME_CONCEPT.md.
import type { MsgKey } from '../i18n';
import type { Pace } from './run';

export type Act = 'overwork' | 'scroll' | 'agree' | 'pause';
/** Преграда и привычка, которая её убирает: стопка — переработать, шум — пролистать, человек — согласиться. */
export type GateKind = 'pile' | 'noise' | 'person';
export const OPENS: Record<GateKind, Act> = { pile: 'overwork', noise: 'scroll', person: 'agree' };

export interface Gate { x: number; kind: GateKind; h: number }
export interface Beat {
  x: number;        // срабатывает один раз, когда Саша добежал до x
  pace?: Pace;      // с этого места Саша идёт, бежит трусцой или бежит
  clock?: number;   // часы подтягиваются до этого времени
  glitch?: number;  // сколько сбоя с этого места (0..1)
  reveal?: Act;     // появляется кнопка
  say?: MsgKey;     // строка внутри мира…
  sayAt?: number;   // …над этой точкой (нет — мысль над Сашей)
  atDoor?: boolean; // …над целью главы, где бы она ни стояла
  msg?: boolean;    // …сообщение в телефоне, а не реплика вслух
  notifs?: MsgKey[]; // какие строки сыплются сверху дальше
  goal?: MsgKey;    // цель под часами меняется (и цель получает бирку)
}
/** Срыв ПАУЗЫ («Пятница»): мир замирает на ms и срывается сам; tag — плашка после, thought — мысль Саши. */
export interface PauseSlip { ms: number; tag: MsgKey; thought: MsgKey }
/** Шаг ПАУЗЫ: вопрос и названия; kicker — подпись шага, когда шагов больше одного. */
export interface PauseStep { kicker?: MsgKey; question: MsgKey; options: MsgKey[]; correct: number }

export interface Chapter {
  id: 'mon' | 'wed' | 'fri' | 'sun';
  scenery: 'office' | 'flat' | 'party' | 'quiet'; // какой фон рисует сцена (week/scenery.ts)
  invite?: MsgKey;              // кнопка в конце прошлой главы, которая ведёт в эту
  title: MsgKey; about: MsgKey; again: MsgKey; who: MsgKey; // заставка
  goal: MsgKey; targetTag: MsgKey;
  worldW: number; startX: number; startClock: number; startPace: Pace;
  clockCap: number;             // дальше этого времени телефон часы не уносит
  blocks: { x: number; w: number; h: number }[];
  cat?: { x: number; lift: number }; puddleX?: number; hallX?: number;
  beats: Beat[]; gates: Gate[];
  people: number[];             // прохожие: лица — только когда сбоя нет
  art: { pile: string; noise: string; person: string; door: string; walkers: string[] };
  // цель главы: пока идёт сбой, держится впереди на keepAway; после названия — в nearSteps
  // peakScale — во сколько раз цель вырастает на пике (нет — вдвое)
  door: { x: number; keepAway: number; nearSteps: number; pauseAfterMs: number; peakPileEvery: number; peakScale?: number };
  hollow?: boolean;             // привычкам не за что зацепиться («Воскресенье»): срабатывают вхолостую, costs говорят почему
  crisis?: boolean;             // тяжёлая глава: кризисная строка на экране всю главу и в её конце (правило №7)
  agreeThanks: MsgKey;
  hints?: Partial<Record<Act, MsgKey>>; costs?: Partial<Record<Act, MsgKey>>;
  // between — мысль, когда первый шаг пройден, а сбой не ушёл; slips — первые удержания срываются (навык, не кнопка)
  // named — мысль, когда сбой назван и до цели десять шагов
  pause: { steps: PauseStep[]; between?: MsgKey; slips?: PauseSlip[]; named?: MsgKey };
  end: { line: MsgKey; after: MsgKey; card: 'hook' | 'end'; msg?: boolean }; // msg — последняя строка приходит сообщением
}

export const hm = (h: number, m: number) => h * 60 + m;
export const pile = (x: number, h: number): Gate => ({ x, kind: 'pile', h });
export const LOW = 45, TALL = 170; // низкую стопку перепрыгивают, высокую берёт только рывок
export const peakX = (ch: Chapter): number => ch.beats.find(b => b.glitch === 1)!.x;

/** Преграда рядом по ходу, которую убирает эта привычка (ещё не убранная). */
export function gateInReach<G extends { x: number; kind: GateKind; open: boolean }>(
  gates: G[], act: Act, playerX: number, reach: number,
): G | undefined {
  return gates.find(g => !g.open && OPENS[g.kind] === act && Math.abs(g.x - playerX) <= reach);
}

/** Где стоит цель: пока сбой не назван, держится впереди, сколько ни беги; после названия стоит на месте. */
export function doorX(cur: number, playerX: number, glitching: boolean, named: boolean, d: Chapter['door']): number {
  if (named || !glitching) return cur;
  return Math.max(cur, playerX + d.keepAway);
}
