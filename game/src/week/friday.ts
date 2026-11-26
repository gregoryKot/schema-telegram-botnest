// «Пятница. Вечеринка» — глава данными. Квартира друзей, Женя с тортом ждёт в конце комнаты; одна реплика
// задевает — лица становятся масками, пол едет к выходу (Отстранённый Защитник). ПРОЛИСТАТЬ тут сильнее всего
// и дороже всего: вечер проходит мимо. Подводный камень: ПАУЗА срывается — первые удержания не держатся.
import { LOW, TALL, hm, pile, type Chapter } from './chapter';

const wall = (x: number) => ({ x, kind: 'noise' as const, h: 260 });

export const FRIDAY: Chapter = {
  id: 'fri',
  scenery: 'party',
  invite: 'm_wk_fri_invite',
  title: 'm_wk_fri_day', about: 'm_wk_fri_about', again: 'm_wk_fri_again', who: 'm_wk_fri_who',
  goal: 'm_wk_goal_party', targetTag: 'm_wk_friend_tag',
  worldW: 120000, // комната не кончается, пока сбой не назван
  startX: 120,
  startClock: hm(20, 10),
  startPace: 'walk',
  clockCap: hm(23, 50), // два ухода в телефон — и вечер кончился
  blocks: [],
  beats: [
    // спокойно: Женя зовёт к торту, гости с лицами
    { x: 260, clock: hm(20, 15), say: 'm_wk_fri_friend_hi', atDoor: true, goal: 'm_wk_goal_party' },
    { x: 560, say: 'm_wk_fri_friend_meet', atDoor: true },
    { x: 840, say: 'm_wk_fri_guest_poke', sayAt: 1020 },
    // вопрос задел: маски, пол едет к выходу, обрывки разговоров сыплются сверху
    { x: 1100, pace: 'run', clock: hm(20, 20), glitch: 0.5, say: 'm_wk_fri_glitch_thought', goal: 'm_wk_goal_party_glitch',
      notifs: ['m_wk_fri_n_laugh', 'm_wk_fri_n_quiet', 'm_wk_fri_n_remember'] },
    { x: 3400, reveal: 'scroll' },
    { x: 6500, clock: hm(20, 50), glitch: 0.7, reveal: 'overwork' },
    { x: 10700, clock: hm(21, 30), reveal: 'agree', say: 'm_wk_fri_guest_ask', sayAt: 11350 },
    { x: 17050, clock: hm(22, 40), glitch: 1, say: 'm_wk_fri_peak_thought' },
  ],
  gates: [
    pile(2200, 40), pile(2850, 50),
    wall(3950), pile(4750, LOW), wall(5550),
    pile(7200, TALL), pile(8000, LOW), wall(8950), pile(9750, 50),
    { x: 11350, kind: 'person', h: 170 },
    pile(12450, 105), // с поручением в рюкзаке уже не перепрыгнуть
    pile(13400, 40), wall(14350), pile(15300, LOW), pile(16100, 40),
  ],
  people: [420, 700, 1020],
  art: { pile: 'wk_dishes', noise: 'wk_mask_wall', person: 'wk_guest_ask', door: 'wk_friend_cake',
    walkers: ['wk_guest_a', 'wk_guest_b', 'wk_guest_c'] },
  door: { x: 1250, keepAway: 380, nearSteps: 300, pauseAfterMs: 8000, peakPileEvery: 900 },
  agreeThanks: 'm_wk_fri_guest_thanks',
  hints: { overwork: 'm_wk_fri_hint_overwork', scroll: 'm_wk_fri_hint_scroll', agree: 'm_wk_fri_hint_agree' },
  costs: { overwork: 'm_wk_fri_cost_overwork', scroll: 'm_wk_fri_cost_scroll', agree: 'm_wk_fri_cost_agree' },
  pause: {
    // первое удержание срывается почти сразу, второе держится втрое дольше, третье — держится
    slips: [
      { ms: 900, tag: 'm_wk_fri_slip1_tag', thought: 'm_wk_fri_slip1_thought' },
      { ms: 2600, tag: 'm_wk_fri_slip2_tag', thought: 'm_wk_fri_slip2_thought' },
    ],
    steps: [
      { kicker: 'm_wk_fri_step1', question: 'm_wk_mon_pause_question',
        options: ['m_wk_fri_p1_unwelcome', 'm_wk_fri_p1_off', 'm_wk_fri_p1_notmine'], correct: 1 },
      { kicker: 'm_wk_pause_step2', question: 'm_wk_wed_p2_question',
        options: ['m_wk_fri_p2_leave', 'm_wk_fri_p2_stay', 'm_wk_fri_p2_star'], correct: 1 },
    ],
    between: 'm_wk_fri_between',
  },
  end: { line: 'm_wk_fri_friend_warm', after: 'm_wk_fri_after', card: 'end' },
};
