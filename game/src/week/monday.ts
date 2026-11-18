// «Понедельник. Офис» — глава данными: что стоит на пути, где что звучит и когда открывается.
// Кадры и хронометраж — game/GAME_CONCEPT.md; сцена (WeekScene) только исполняет этот список.
import type { MsgKey } from '../i18n';

export type Act = 'overwork' | 'scroll' | 'agree' | 'pause';
/** Преграда и привычка, которая её убирает: стопка — переработать, шум — пролистать, человек — согласиться. */
export type GateKind = 'pile' | 'noise' | 'person';
export const OPENS: Record<GateKind, Act> = { pile: 'overwork', noise: 'scroll', person: 'agree' };

export interface Gate { x: number; kind: GateKind; h: number }
export interface Beat {
  x: number;        // срабатывает один раз, когда Саша дошёл до x
  clock?: number;   // часы подтягиваются до этого времени
  glitch?: number;  // сколько сбоя с этого места (0..1)
  reveal?: Act;     // появляется кнопка
  say?: MsgKey;     // строка внутри мира…
  sayAt?: number;   // …над этой точкой (нет — мысль над Сашей)
  notifs?: MsgKey[]; // какие уведомления сыплются дальше
}

const hm = (h: number, m: number) => h * 60 + m;

export const MONDAY = {
  id: 'mon',
  title: 'm_wk_mon_title' as MsgKey,
  worldW: 14000,
  startX: 120,
  startClock: hm(8, 40),
  // утро: бордюр и ступени учат прыжку; лужа и стол — без столкновений
  blocks: [
    { x: 520, w: 44, h: 22 }, { x: 1080, w: 70, h: 30 }, { x: 1150, w: 70, h: 60 }, { x: 1220, w: 70, h: 30 },
  ],
  puddleX: 800, catX: 40, deskX: 1700,
  beats: [
    { x: 1640, clock: hm(11, 0), glitch: 0.5, say: 'm_wk_mon_boss_msg', sayAt: 1700 },
    { x: 2250, clock: hm(11, 30), reveal: 'overwork', notifs: ['m_wk_mon_notif_report', 'm_wk_mon_notif_urgent'] },
    { x: 3150, clock: hm(12, 10), glitch: 0.7, reveal: 'scroll',
      notifs: ['m_wk_mon_notif_call', 'm_wk_mon_notif_report', 'm_wk_mon_notif_urgent'] },
    { x: 4100, reveal: 'agree', say: 'm_wk_mon_colleague_ask', sayAt: 4400 },
    { x: 5000, clock: hm(14, 58), glitch: 1, say: 'm_wk_mon_door_thought' },
  ] as Beat[],
  gates: [
    { x: 2500, kind: 'pile', h: 170 },
    { x: 2900, kind: 'pile', h: 50 },
    { x: 3500, kind: 'noise', h: 260 },
    { x: 4400, kind: 'person', h: 170 },
    { x: 4750, kind: 'pile', h: 105 }, // с рюкзаком уже не перепрыгнуть
  ] as Gate[],
  people: [2100, 3000, 3900, 5300], // прохожие коридора: лица — только когда сбоя нет
  // дверь начальницы: на пике убегает и огромная; после названия — в десяти шагах
  door: { x: 5600, peakX: 5000, keepAway: 240, nearSteps: 300, pauseAfterMs: 8000 },
  agreeThanks: 'm_wk_mon_colleague_thanks' as MsgKey,
  pause: {
    question: 'm_wk_mon_pause_question' as MsgKey,
    options: ['m_wk_mon_pause_fired', 'm_wk_mon_pause_try_harder', 'm_wk_mon_pause_old_fear'] as MsgKey[],
    correct: 2,
  },
  end: { bossLine: 'm_wk_mon_boss_line' as MsgKey, afterThought: 'm_wk_mon_after_thought' as MsgKey },
};
export type Chapter = typeof MONDAY;

/** Преграда рядом по ходу, которую убирает эта привычка (ещё не убранная). */
export function gateInReach<G extends { x: number; kind: GateKind; open: boolean }>(
  gates: G[], act: Act, playerX: number, reach: number,
): G | undefined {
  return gates.find(g => !g.open && OPENS[g.kind] === act && Math.abs(g.x - playerX) <= reach);
}

/** Где стоит дверь: до названия на пике держится впереди, после — в десяти шагах от места паузы. */
export function doorX(cur: number, playerX: number, peak: boolean, named: boolean, d: Chapter['door']): number {
  if (named || !peak) return cur;
  return Math.max(cur, playerX + d.keepAway);
}
