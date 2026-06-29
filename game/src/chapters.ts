import { GROUND_Y } from './constants';
import type { MsgKey } from './i18n';

// A chapter = pure data. The Game scene is the engine; chapters are config.
export interface TriggerDef {
  x: number; anx?: number; critic?: boolean; say?: MsgKey; overwhelm?: boolean;
  // враги главы 2 — значение = координата спавна
  proc?: number; phone?: number; irrit?: number;
  soothe?: number; mirror?: number; // Акт II: Само-Пройдёт, Кривое зеркало
  seat?: number;  // высота посадки прокрастинации (диван): y = GROUND_Y - seat
  gate?: number;  // боевой гейт: стена на этой x, падает когда враги триггера разрешены
}
export interface EndingLine { text: MsgKey; y: number; color: string; size: number; delay: number; }
export interface ChapterPalette {
  skyTop: number; skyBot: number; glow1: number; glow2: number;
  groundTint: number; platTint: number; fog: number; mote: number;
}
export interface ChapterConfig {
  id: string;
  title: MsgKey;
  tagline: MsgKey;                       // строка-настроение на титульной карточке
  theme: 'street' | 'room';             // декорации (см. decor.ts) и текстуры пола/платформ
  decor?: { couch?: number; tv?: number; lamps?: number[] };
  arenaW: number;
  pits: { s: number; e: number }[];
  checkpoints: number[];
  platforms: { x: number; w: number; y: number }[];
  spikes: { x: number; w: number }[];
  hearts: { x: number; y: number }[];
  memories?: { x: number; y: number }[]; // тёплые воспоминания — коллектиблы, часть на секретных маршрутах
  triggers: TriggerDef[];
  ending: EndingLine[];
  palette: ChapterPalette;
  music: 'day' | 'home';
  overwhelmAnx: number;     // сколько тревог высыпает финал (0 — только текст)
  overwhelmSay: MsgKey;
  next?: string;            // глава после развязки; нет — в начало
  branch?: string;          // конец Акта I: экран-развилка (CTA в терапию ИЛИ продолжить в эту главу)
}

const G = GROUND_Y;

// ── Глава 1 · Обычный день ─────────────────────────────────────────────────
const chapter1: ChapterConfig = {
  id: 'chapter1',
  title: 'm_an_ordinary_day',
  tagline: 'm_evening_just_make_it_home',
  theme: 'street',
  arenaW: 4700,
  // Враги — не «тревога ×3», а разные триггеры дня: тревога, раздражение,
  // и критик-тень, что появляется рано и тянется СКВОЗЬ всю главу, разрастаясь
  // от каждого «рявка». Спираль, которую видно, а не читают в финале.
  pits: [
    { s: 760, e: 900 }, { s: 1300, e: 1520 }, { s: 2050, e: 2210 },
    { s: 2950, e: 3210 }, { s: 3720, e: 3870 },
  ],
  checkpoints: [100, 950, 1620, 2280, 3280, 4000],
  platforms: [
    { x: 360,  w: 120, y: G - 84  },
    { x: 800,  w: 110, y: G - 70  },
    { x: 1120, w: 120, y: G - 92  },
    { x: 1340, w: 96,  y: G - 70  },
    { x: 1460, w: 90,  y: G - 150 },
    { x: 1700, w: 130, y: G - 92  },
    { x: 1900, w: 110, y: G - 150 },
    { x: 2120, w: 100, y: G - 80  },
    { x: 2400, w: 120, y: G - 70  },
    { x: 2560, w: 110, y: G - 120 },
    { x: 2700, w: 100, y: G - 168 },
    { x: 2850, w: 120, y: G - 214 },
    { x: 3060, w: 96,  y: G - 132 },
    { x: 3270, w: 120, y: G - 80  },
    { x: 3540, w: 120, y: G - 134 },
    { x: 3780, w: 110, y: G - 92  },
    { x: 4040, w: 150, y: G - 92  },
  ],
  spikes: [{ x: 1140, w: 120 }, { x: 2300, w: 130 }, { x: 3360, w: 120 }],
  hearts: [
    { x: 420,  y: G - 116 }, { x: 1460, y: G - 188 }, { x: 1900, y: G - 188 },
    { x: 2850, y: G - 252 }, { x: 3110, y: G - 180 }, { x: 4040, y: G - 132 },
  ],
  memories: [
    { x: 560,  y: G - 130 }, { x: 1120, y: G - 132 }, { x: 1700, y: G - 138 },
    { x: 2560, y: G - 168 }, { x: 2850, y: G - 262 }, { x: 3780, y: G - 138 },
  ],
  triggers: [
    { x: 280,  anx: 1, say: 'm_that_feeling_again', gate: 690 }, // учим базовый цикл
    { x: 1180, irrit: 1620, gate: 1760 },                        // вариант: раздражение на улице
    { x: 1980, critic: true },                                   // тень появляется и идёт следом
    { x: 2520, anx: 1, say: 'm_still_right_behind_you' },              // критик растёт за плечом
    { x: 3260, anx: 2, irrit: 3520, gate: 3680 },                // навалилось разом — эскалация
    { x: 4320, overwhelm: true },
  ],
  ending: [
    { text: 'm_you_fought_ran_froze',               y: 120, color: '#d8c8ec', size: 17, delay: 700  },
    { text: 'm_the_critic_caught_up_anyway',                y: 156, color: '#ff8aa6', size: 16, delay: 2200 },
    { text: 'm_it_s_your_own_shadow_and',  y: 226, color: '#e8b8c8', size: 16, delay: 4000 },
    { text: 'm_you_can_t_handle_this_alone',             y: 320, color: '#e8d0dc', size: 16, delay: 6200 },
    { text: 'm_and_you_don_t_have_to',          y: 372, color: '#88ffcc', size: 15, delay: 8200 },
  ],
  palette: {
    // сумеречная улица, но не чёрная — мягкий фиолетовый вечер
    skyTop: 0x2c2348, skyBot: 0x5e4878, glow1: 0x9a6aaa, glow2: 0xb07ab2,
    groundTint: 0xc4b8d8, platTint: 0xbaaed0, fog: 0x2a2040, mote: 0xa898c8,
  },
  music: 'day',
  overwhelmAnx: 3,
  overwhelmSay: 'm_how_long_can_this_go_on',
  next: 'chapter2',
};

// ── Глава 2 · Дома ─────────────────────────────────────────────────────────
// Вечер дома: телефон затягивает, прокрастинация липнет, раздражение жжёт.
// Урок главы: «замри» здесь — ловушка. Телефон выключается ударом,
// прокрастинация снимается только движением (рывок).
const chapter2: ChapterConfig = {
  id: 'chapter2',
  title: 'm_home',
  tagline: 'm_home_but_no_rest',
  theme: 'room',
  decor: { couch: 1560, tv: 3000, lamps: [400, 2450, 4300] },
  arenaW: 4700,
  pits: [{ s: 900, e: 1060 }, { s: 1980, e: 2160 }, { s: 3120, e: 3300 }],
  checkpoints: [100, 1120, 2220, 3360, 4100],
  platforms: [
    { x: 380,  w: 130, y: G - 80  },
    { x: 700,  w: 110, y: G - 140 },
    { x: 920,  w: 120, y: G - 70  },
    { x: 1240, w: 120, y: G - 90  },
    { x: 1480, w: 110, y: G - 150 },
    { x: 1690, w: 130, y: G - 84  },
    { x: 1990, w: 100, y: G - 80  },
    { x: 2120, w: 96,  y: G - 150 },
    { x: 2320, w: 120, y: G - 90  },
    { x: 2540, w: 110, y: G - 140 },
    { x: 2860, w: 140, y: G - 90  },
    { x: 3140, w: 100, y: G - 80  },
    { x: 3260, w: 90,  y: G - 150 },
    { x: 3470, w: 120, y: G - 100 },
    { x: 3690, w: 110, y: G - 160 },
    { x: 3890, w: 120, y: G - 92  },
    { x: 4150, w: 140, y: G - 90  },
  ],
  spikes: [{ x: 1700, w: 110 }, { x: 2880, w: 130 }, { x: 3900, w: 110 }],
  hearts: [
    { x: 440,  y: G - 160 }, { x: 1540, y: G - 190 }, { x: 2180, y: G - 190 },
    { x: 2600, y: G - 180 }, { x: 3320, y: G - 190 }, { x: 4210, y: G - 130 },
  ],
  memories: [
    { x: 700,  y: G - 150 }, { x: 1240, y: G - 130 }, { x: 1480, y: G - 200 },
    { x: 2540, y: G - 190 }, { x: 3140, y: G - 130 }, { x: 3690, y: G - 210 },
  ],
  triggers: [
    { x: 240,  say: 'm_home_finally_a_breath_right' },
    { x: 540,  phone: 820, gate: 900 },             // телефон сразу у входа — мимо не пройти
    { x: 1180, proc: 1560, seat: 64, gate: 1760 },  // диван (couch 1560) держит
    { x: 1760, irrit: 1860 },                       // раздражение в бывшем пустом участке
    { x: 2300, say: 'm_why_is_home_the_hardest_of' },
    { x: 2520, phone: 2820, gate: 3040 },           // телефон возвращается — у TV (3000)
    { x: 3360, irrit: 3640, phone: 3820, gate: 3980 }, // финал: всё разом
    { x: 4420, overwhelm: true },
  ],
  ending: [
    { text: 'm_home_was_supposed_to_be_rest',         y: 120, color: '#c8d4ec', size: 17, delay: 700  },
    { text: 'm_but_the_phone_ate_the_evening',             y: 156, color: '#9fb6d6', size: 15, delay: 2200 },
    { text: 'm_the_couch_held_on_anger_burned',           y: 226, color: '#c8d4ec', size: 16, delay: 4000 },
    { text: 'm_you_re_not_lazy_not_broken',         y: 300, color: '#e8c8a0', size: 16, delay: 6000 },
    { text: 'm_just_alone_for_far_too_long',         y: 338, color: '#e8d0dc', size: 15, delay: 7800 },
    { text: 'm_onward_to_where_it_began',     y: 408, color: '#88ffcc', size: 15, delay: 9800 },
  ],
  palette: {
    // тёплая «вечерняя комната при лампе», не подземелье — чтобы тёплый реквизит читался
    skyTop: 0x342b3e, skyBot: 0x5a4a52, glow1: 0x7a5a5e, glow2: 0x9a6e54,
    groundTint: 0xe8cda0, platTint: 0xeacf9a, fog: 0x241a26, mote: 0x8a7a8a,
  },
  music: 'home',
  overwhelmAnx: 0,
  overwhelmSay: 'm_the_whole_evening_wasted_again',
  branch: 'chapter3', // конец Акта I: воронка-CTA ИЛИ продолжить в Дорогу (гл.3)
};

// ── Глава 3 · «Само пройдёт» (Акт II — дорога в терапию) ────────────────────
// Понял, что так нельзя — и тут же начал себя отговаривать. Враги не нападают,
// а УБАЮКИВАЮТ: Само-Пройдёт замедляет и темнит экран, шепчет «да всё норм».
const chapter3: ChapterConfig = {
  id: 'chapter3',
  title: 'm_it_ll_pass',
  tagline: 'm_realised_this_can_t_go_on',
  theme: 'street',
  arenaW: 2600,
  pits: [{ s: 1250, e: 1400 }],
  checkpoints: [100, 1450],
  platforms: [
    { x: 360,  w: 120, y: G - 84  }, { x: 700,  w: 110, y: G - 140 },
    { x: 1050, w: 120, y: G - 90  }, { x: 1500, w: 120, y: G - 100 },
    { x: 1800, w: 120, y: G - 150 }, { x: 2150, w: 130, y: G - 90  },
  ],
  spikes: [],
  hearts: [{ x: 420, y: G - 120 }, { x: 1800, y: G - 188 }, { x: 2300, y: G - 120 }],
  memories: [{ x: 560, y: G - 130 }, { x: 1500, y: G - 138 }],
  triggers: [
    { x: 240,  say: 'm_i_need_to_change_something_or' },
    { x: 600,  soothe: 820 },
    { x: 1500, say: 'm_see_easier_already_maybe_it_ll' },
    { x: 1700, mirror: 1950 },   // поворот: ЗАМРИ = посмотреть честно
    { x: 2350, overwhelm: true },
  ],
  ending: [
    { text: 'm_the_slyest_enemy_never_attacked',       y: 120, color: '#d8c8ec', size: 17, delay: 700  },
    { text: 'm_it_just_whispered_not_today',       y: 156, color: '#bfe0ff', size: 15, delay: 2200 },
    { text: 'm_and_day_after_day_slips_by',              y: 226, color: '#d8c8ec', size: 16, delay: 4000 },
    { text: 'm_until_you_say_it_honestly_it',       y: 320, color: '#88ffcc', size: 15, delay: 6200 },
  ],
  palette: {
    skyTop: 0x3a3458, skyBot: 0x6a5a82, glow1: 0x8a7aba, glow2: 0xa890c8,
    groundTint: 0xc8bcdc, platTint: 0xc0b4d4, fog: 0x342a4a, mote: 0xb0a0d0,
  },
  music: 'home',
  overwhelmAnx: 0,
  overwhelmSay: 'm_talked_myself_out_again_another_day',
};

export const CHAPTERS: Record<string, ChapterConfig> = { chapter1, chapter2, chapter3 };
export const DEFAULT_CHAPTER = 'chapter1';
