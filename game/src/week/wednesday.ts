// «Среда. Звонок маме» — глава данными. Вечер дома, видеозвонок: обычные вопросы задевают старое,
// квартира тянется в лабиринт, реплики мамы встают стенами. Подводный камень: назвать мало —
// у ПАУЗЫ второй шаг, «что мне сейчас нужно». Мама не злодей: в конце обычная тёплая фраза.
import { LOW, TALL, hm, pile, type Chapter } from './chapter';

const wall = (x: number) => ({ x, kind: 'noise' as const, h: 260 });

export const WEDNESDAY: Chapter = {
  id: 'wed',
  scenery: 'flat',
  title: 'm_wk_wed_day', about: 'm_wk_wed_about', again: 'm_wk_wed_again', who: 'm_wk_wed_who',
  goal: 'm_wk_goal_mom', targetTag: 'm_wk_mom_tag',
  worldW: 120000, // квартира не кончается, пока сбой не назван
  startX: 120,
  startClock: hm(19, 40),
  startPace: 'walk',
  clockCap: hm(23, 40),
  blocks: [],
  cat: { x: 300, lift: 0 },
  beats: [
    // спокойно: звонок и первые обычные вопросы звучат от телефона впереди
    { x: 300, clock: hm(19, 45), say: 'm_wk_wed_call', atDoor: true, msg: true, goal: 'm_wk_goal_mom' },
    { x: 600, say: 'm_wk_wed_mom_hi', atDoor: true },
    { x: 880, say: 'm_wk_wed_mom_work', atDoor: true },
    // вопрос задел: телефон уезжает вперёд, мамины слова сыплются сверху
    { x: 1100, pace: 'run', clock: hm(19, 50), glitch: 0.5, notifs: ['m_wk_wed_n_others', 'm_wk_wed_n_tired'] },
    { x: 3400, reveal: 'overwork' },
    { x: 6500, clock: hm(20, 30), glitch: 0.7, reveal: 'scroll' },
    { x: 10700, clock: hm(21, 10), reveal: 'agree', say: 'm_wk_wed_mom_ask', sayAt: 11350 },
    { x: 17050, clock: hm(22, 40), glitch: 1, say: 'm_wk_wed_peak_thought' },
  ],
  gates: [
    pile(2200, 40), pile(2850, 50),
    pile(3950, TALL), pile(4750, LOW), pile(5550, 55),
    wall(7200), pile(8000, LOW), wall(8950), pile(9750, 50),
    { x: 11350, kind: 'person', h: 170 },
    pile(12450, 105), // с обещанием в рюкзаке уже не перепрыгнуть
    pile(13400, 40), wall(14350), pile(15300, LOW), pile(16100, 40),
  ],
  people: [],
  art: { pile: 'wk_piles', noise: 'wk_call_wall', person: 'wk_mom_screen', door: 'wk_mom_call', walkers: [] },
  door: { x: 1250, keepAway: 380, nearSteps: 300, pauseAfterMs: 8000, peakPileEvery: 900 },
  agreeThanks: 'm_wk_wed_mom_thanks',
  hints: { overwork: 'm_wk_wed_hint_overwork', scroll: 'm_wk_wed_hint_scroll', agree: 'm_wk_wed_hint_agree' },
  costs: { agree: 'm_wk_wed_cost_agree' },
  pause: {
    steps: [
      { kicker: 'm_wk_pause_step1', question: 'm_wk_mon_pause_question',
        options: ['m_wk_wed_p1_unloved', 'm_wk_wed_p1_voice', 'm_wk_wed_p1_lazy'], correct: 1 },
      { kicker: 'm_wk_pause_step2', question: 'm_wk_wed_p2_question',
        options: ['m_wk_wed_p2_more', 'm_wk_wed_p2_proud', 'm_wk_wed_p2_warmth'], correct: 2 },
    ],
    between: 'm_wk_wed_between',
  },
  end: { line: 'm_wk_wed_mom_warm', after: 'm_wk_wed_after', card: 'end' },
};
