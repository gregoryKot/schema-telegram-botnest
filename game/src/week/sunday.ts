// «Воскресенье. Тишина» — глава данными. Своя квартира, никого. Сбой тихий: комната тянется в пустоту, музыка
// глохнет, в конце сидит маленький Саша (Уязвимый Ребёнок). Преград нет, и привычкам не за что зацепиться:
// дел нет, лента кончилась, соглашаться не с кем. ПАУЗА держится с первого раза — навык уже есть.
import { hm, type Chapter } from './chapter';

export const SUNDAY: Chapter = {
  id: 'sun',
  scenery: 'quiet',
  invite: 'm_wk_sun_invite',
  title: 'm_wk_sun_day', about: 'm_wk_sun_about', again: 'm_wk_sun_again', who: 'm_wk_sun_who',
  goal: 'm_wk_goal_rest', targetTag: 'm_wk_little_tag',
  worldW: 120000, // комната не кончается, пока сбой не назван
  startX: 120,
  startClock: hm(16, 40),
  startPace: 'walk',
  clockCap: hm(23, 50),
  blocks: [],
  cat: { x: 250, lift: 0 },
  hollow: true,
  crisis: true,
  beats: [
    // спокойно: выходной, Мистер на ковре, планов нет
    { x: 440, clock: hm(16, 45), say: 'm_wk_sun_calm' },
    // тихо: комната тянется, впереди проступает маленький Саша — и не приближается
    { x: 640, pace: 'jog', clock: hm(17, 0), glitch: 0.5, say: 'm_wk_sun_glitch_thought', goal: 'm_wk_goal_little' },
    { x: 1700, reveal: 'overwork' },
    { x: 2900, clock: hm(18, 30), glitch: 0.7, reveal: 'scroll' },
    { x: 4100, clock: hm(20, 0), reveal: 'agree' },
    { x: 5300, clock: hm(21, 30), glitch: 1, say: 'm_wk_sun_peak_thought' },
  ],
  gates: [],
  people: [],
  art: { pile: 'wk_piles', noise: 'wk_notif_wall', person: 'wk_colleague_box', door: 'wk_little', walkers: [] },
  door: { x: 1020, keepAway: 380, nearSteps: 300, pauseAfterMs: 5000, peakPileEvery: 900, peakScale: 1 },
  agreeThanks: 'm_wk_sun_cost_agree',
  hints: { overwork: 'm_wk_sun_try_overwork', scroll: 'm_wk_sun_try_scroll', agree: 'm_wk_sun_try_agree' },
  costs: { overwork: 'm_wk_sun_cost_overwork', scroll: 'm_wk_sun_cost_scroll', agree: 'm_wk_sun_cost_agree' },
  pause: {
    steps: [
      { kicker: 'm_wk_pause_step1', question: 'm_wk_mon_pause_question',
        options: ['m_wk_sun_p1_broken', 'm_wk_sun_p1_busy', 'm_wk_sun_p1_lonely'], correct: 2 },
      { kicker: 'm_wk_pause_step2', question: 'm_wk_wed_p2_question',
        options: ['m_wk_sun_p2_near', 'm_wk_sun_p2_wait', 'm_wk_sun_p2_hide'], correct: 0 },
    ],
    between: 'm_wk_sun_between', named: 'm_wk_sun_named',
  },
  end: { line: 'm_wk_sun_friend_msg', after: 'm_wk_sun_after', card: 'end', msg: true },
};
