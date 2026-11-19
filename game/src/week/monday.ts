// «Понедельник. Офис» — глава данными: что стоит на пути, где что звучит и когда открывается.
// Саша бежит сам; кадры и хронометраж — game/GAME_CONCEPT.md; сцена (WeekScene) только исполняет этот список.
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
  msg?: boolean;    // …сообщение в телефоне, а не реплика вслух
  notifs?: MsgKey[]; // какие уведомления сыплются дальше
}

const hm = (h: number, m: number) => h * 60 + m;
const pile = (x: number, h: number): Gate => ({ x, kind: 'pile', h });
const LOW = 45, TALL = 170; // низкую стопку перепрыгивают, высокую берёт только рывок

export const MONDAY = {
  id: 'mon',
  title: 'm_wk_mon_title' as MsgKey,
  worldW: 120000, // коридор не кончается: бега хватит на минуты после пика
  startX: 120,
  startClock: hm(8, 40),
  startPace: 'walk' as Pace,
  // улица: бордюр и ступени учат прыжку; лужа и стол — без столкновений
  blocks: [
    { x: 760, w: 44, h: 22 }, { x: 1500, w: 70, h: 30 }, { x: 1570, w: 70, h: 60 }, { x: 1640, w: 70, h: 30 },
  ],
  puddleX: 1120, catX: 40, deskX: 2420,
  hallX: 2860, // опенспейс кончается, дальше коридор: сбой начинается за перегородкой
  beats: [
    { x: 360, pace: 'jog' },                                                        // из квартиры на улицу
    { x: 2160, pace: 'walk' },                                                      // офис, свой стол
    { x: 2330, clock: hm(11, 0), say: 'm_wk_mon_boss_msg', sayAt: 2420, msg: true },
    { x: 2900, pace: 'run', glitch: 0.5, notifs: ['m_wk_mon_notif_report', 'm_wk_mon_notif_urgent'] },
    { x: 4300, clock: hm(11, 30), reveal: 'overwork' },
    { x: 9000, clock: hm(12, 10), glitch: 0.7, reveal: 'scroll',
      notifs: ['m_wk_mon_notif_call', 'm_wk_mon_notif_report', 'm_wk_mon_notif_urgent'] },
    { x: 15000, reveal: 'agree', say: 'm_wk_mon_colleague_ask', sayAt: 15500 },
    { x: 21000, clock: hm(14, 58), glitch: 1, say: 'm_wk_mon_door_thought' },
  ] as Beat[],
  gates: [
    pile(3300, 40), pile(3900, 50),
    pile(4700, TALL), pile(5400, LOW), pile(6100, 55), pile(6800, TALL), pile(7500, LOW), pile(8200, 50),
    { x: 9500, kind: 'noise', h: 260 }, pile(10300, LOW), pile(11000, 55), { x: 11800, kind: 'noise', h: 260 },
    pile(12600, LOW), pile(13400, 50), pile(14200, LOW),
    { x: 15500, kind: 'person', h: 170 },
    pile(16300, 105), // с рюкзаком уже не перепрыгнуть
    pile(17200, 40), { x: 18100, kind: 'noise', h: 260 }, pile(19000, LOW), pile(19900, 40),
  ] as Gate[],
  people: [3600, 8600, 12200, 17700, 20500], // прохожие коридора: лица — только когда сбоя нет
  // дверь начальницы: пока идёт сбой, держится впереди на keepAway; после названия — в десяти шагах
  door: { x: 3400, keepAway: 380, nearSteps: 300, pauseAfterMs: 8000, peakPileEvery: 900 },
  agreeThanks: 'm_wk_mon_colleague_thanks' as MsgKey,
  pause: {
    question: 'm_wk_mon_pause_question' as MsgKey,
    options: ['m_wk_mon_pause_fired', 'm_wk_mon_pause_try_harder', 'm_wk_mon_pause_old_fear'] as MsgKey[],
    correct: 2,
  },
  end: { bossLine: 'm_wk_mon_boss_line' as MsgKey, afterThought: 'm_wk_mon_after_thought' as MsgKey },
};
export type Chapter = typeof MONDAY;
export const PEAK_X = MONDAY.beats.find(b => b.glitch === 1)!.x;

/** Преграда рядом по ходу, которую убирает эта привычка (ещё не убранная). */
export function gateInReach<G extends { x: number; kind: GateKind; open: boolean }>(
  gates: G[], act: Act, playerX: number, reach: number,
): G | undefined {
  return gates.find(g => !g.open && OPENS[g.kind] === act && Math.abs(g.x - playerX) <= reach);
}

/** Где стоит дверь: пока сбой не назван, держится впереди, сколько ни беги; после названия стоит на месте. */
export function doorX(cur: number, playerX: number, glitching: boolean, named: boolean, d: Chapter['door']): number {
  if (named || !glitching) return cur;
  return Math.max(cur, playerX + d.keepAway);
}
