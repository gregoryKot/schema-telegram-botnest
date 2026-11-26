// Эпилог «Первая встреча» — глава данными. Кабинет терапевта: комната не сбоит, а кресло всё равно не ближе.
// Привычки приходят и сюда — цепляться им не за что, и терапевт замечает каждую вслух (notice), без оценки.
// ПАУЗУ делают вдвоём; конец ведёт на финальную карточку игры (week/finalCard.ts).
import { hm, type Chapter } from './chapter';

export const FIRST: Chapter = {
  id: 'first',
  scenery: 'cabinet',
  invite: 'm_wk_first_invite',
  title: 'm_wk_first_day', about: 'm_wk_first_about', again: 'm_wk_first_again', who: 'm_wk_first_who',
  goal: 'm_wk_goal_tell', targetTag: 'm_wk_therapist_tag',
  worldW: 120000, // до кресла не дойти, пока страх не назван
  startX: 120,
  startClock: hm(19, 0),
  startPace: 'walk',
  clockCap: hm(19, 50), // встреча — пятьдесят минут
  blocks: [],
  hollow: true,
  beats: [
    { x: 300, clock: hm(19, 2), say: 'm_wk_first_hello', atDoor: true },
    { x: 520, clock: hm(19, 5), say: 'm_wk_first_ask', atDoor: true },
    // сбоя в комнате нет — он у Саши внутри: кресло держится впереди
    { x: 640, pace: 'jog', clock: hm(19, 8), glitch: 0.5, say: 'm_wk_first_glitch_thought', goal: 'm_wk_goal_chair' },
    { x: 1700, reveal: 'overwork' },
    { x: 2900, clock: hm(19, 20), glitch: 0.7, reveal: 'scroll' },
    { x: 3800, clock: hm(19, 28), say: 'm_wk_first_tired', atDoor: true },
    { x: 4100, reveal: 'agree' },
    { x: 5300, clock: hm(19, 35), glitch: 1, say: 'm_wk_first_stop', atDoor: true },
  ],
  gates: [],
  people: [],
  art: { pile: 'wk_piles', noise: 'wk_notif_wall', person: 'wk_colleague_box', door: 'wk_therapist', walkers: [] },
  door: { x: 560, keepAway: 330, nearSteps: 300, pauseAfterMs: 5000, peakPileEvery: 900, peakScale: 1 },
  agreeThanks: 'm_wk_first_notice_agree',
  hints: { overwork: 'm_wk_first_try_overwork', scroll: 'm_wk_first_try_scroll', agree: 'm_wk_first_try_agree' },
  notice: { overwork: 'm_wk_first_notice_overwork', scroll: 'm_wk_first_notice_scroll', agree: 'm_wk_first_notice_agree' },
  pause: {
    steps: [
      { kicker: 'm_wk_first_step1', question: 'm_wk_mon_pause_question',
        options: ['m_wk_first_p1_wrong', 'm_wk_first_p1_seen', 'm_wk_first_p1_ready'], correct: 1 },
      { kicker: 'm_wk_first_step2', question: 'm_wk_wed_p2_question',
        options: ['m_wk_first_p2_like', 'm_wk_first_p2_leave', 'm_wk_first_p2_stay'], correct: 2 },
    ],
    between: 'm_wk_first_between', named: 'm_wk_first_named',
  },
  end: { line: 'm_wk_first_end', after: 'm_wk_first_after', card: 'final' },
};
