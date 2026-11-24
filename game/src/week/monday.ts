// «Понедельник. Офис» — хук данными: что стоит на пути, где что звучит и когда открывается.
// Кадры и хронометраж — game/GAME_CONCEPT.md; типы и общие правила глав — week/chapter.ts.
import { LOW, TALL, hm, peakX, pile, type Chapter } from './chapter';

export const MONDAY: Chapter = {
  id: 'mon',
  scenery: 'office',
  title: 'm_wk_intro_day', // крупно в заставке
  about: 'm_wk_intro_about', again: 'm_wk_intro_again', who: 'm_wk_intro_who', targetTag: 'm_wk_door_tag',
  goal: 'm_wk_goal_work',
  worldW: 120000, // коридор не кончается: бега хватит на минуты после пика
  startX: 120,
  startClock: hm(8, 40),
  startPace: 'walk',
  clockCap: hm(14, 58), // встреча в 15:00 — телефон не уносит дальше двери
  // улица: бордюр и ступени учат прыжку; лужа и стол — без столкновений
  blocks: [
    { x: 760, w: 44, h: 22 }, { x: 1500, w: 70, h: 30 }, { x: 1570, w: 70, h: 60 }, { x: 1640, w: 70, h: 30 },
  ],
  puddleX: 1120, cat: { x: 40, lift: 70 },
  hallX: 2860, // опенспейс кончается, дальше коридор: сбой начинается за перегородкой
  beats: [
    { x: 360, pace: 'jog' },                                                        // из квартиры на улицу
    { x: 2160, pace: 'walk' },                                                      // офис, свой стол
    { x: 2330, clock: hm(11, 0), say: 'm_wk_mon_boss_msg', sayAt: 2420, msg: true, goal: 'm_wk_goal_boss' },
    { x: 2900, pace: 'run', glitch: 0.5, say: 'm_wk_mon_glitch_thought', notifs: ['m_wk_mon_notif_report', 'm_wk_mon_notif_urgent'] },
    { x: 4300, clock: hm(11, 30), reveal: 'overwork' },
    { x: 9000, clock: hm(12, 10), glitch: 0.7, reveal: 'scroll',
      notifs: ['m_wk_mon_notif_call', 'm_wk_mon_notif_report', 'm_wk_mon_notif_urgent'] },
    { x: 15000, reveal: 'agree', say: 'm_wk_mon_colleague_ask', sayAt: 15500 },
    { x: 21000, clock: hm(14, 58), glitch: 1, say: 'm_wk_mon_door_thought' },
  ],
  gates: [
    pile(3300, 40), pile(3900, 50),
    pile(4700, TALL), pile(5400, LOW), pile(6100, 55), pile(6800, TALL), pile(7500, LOW), pile(8200, 50),
    { x: 9500, kind: 'noise', h: 260 }, pile(10300, LOW), pile(11000, 55), { x: 11800, kind: 'noise', h: 260 },
    pile(12600, LOW), pile(13400, 50), pile(14200, LOW),
    { x: 15500, kind: 'person', h: 170 },
    pile(16300, 105), // с рюкзаком уже не перепрыгнуть
    pile(17200, 40), { x: 18100, kind: 'noise', h: 260 }, pile(19000, LOW), pile(19900, 40),
  ],
  people: [3600, 8600, 12200, 17700, 20500], // прохожие коридора: лица — только когда сбоя нет
  art: { pile: 'wk_piles', noise: 'wk_notif_wall', person: 'wk_colleague_box', door: 'wk_door',
    walkers: ['wk_colleague_c', 'wk_colleague_b', 'wk_colleague_a'] },
  // дверь начальницы: пока идёт сбой, держится впереди на keepAway; после названия — в десяти шагах
  door: { x: 3400, keepAway: 380, nearSteps: 300, pauseAfterMs: 8000, peakPileEvery: 900 },
  agreeThanks: 'm_wk_mon_colleague_thanks',
  pause: { steps: [{
    question: 'm_wk_mon_pause_question',
    options: ['m_wk_mon_pause_fired', 'm_wk_mon_pause_try_harder', 'm_wk_mon_pause_old_fear'],
    correct: 2,
  }] },
  end: { line: 'm_wk_mon_boss_line', after: 'm_wk_mon_after_thought', card: 'hook' },
};
export const PEAK_X = peakX(MONDAY);

