import { GROUND_Y } from './constants';

// A chapter = pure data. The Game scene is the engine; chapters are config.
export interface TriggerDef {
  x: number; anx?: number; critic?: boolean; say?: string; overwhelm?: boolean;
  // враги главы 2 — значение = координата спавна
  proc?: number; phone?: number; irrit?: number;
  seat?: number;  // высота посадки прокрастинации (диван): y = GROUND_Y - seat
  gate?: number;  // боевой гейт: стена на этой x, падает когда враги триггера разрешены
}
export interface EndingLine { text: string; y: number; color: string; size: number; delay: number; }
export interface ChapterPalette {
  skyTop: number; skyBot: number; glow1: number; glow2: number;
  groundTint: number; platTint: number; fog: number; mote: number;
}
export interface ChapterConfig {
  id: string;
  title: string;
  tagline: string;                       // строка-настроение на титульной карточке
  theme: 'street' | 'room';             // декорации (см. decor.ts) и текстуры пола/платформ
  decor?: { couch?: number; tv?: number; lamps?: number[] };
  arenaW: number;
  pits: { s: number; e: number }[];
  checkpoints: number[];
  platforms: { x: number; w: number; y: number }[];
  spikes: { x: number; w: number }[];
  hearts: { x: number; y: number }[];
  triggers: TriggerDef[];
  ending: EndingLine[];
  palette: ChapterPalette;
  music: 'day' | 'home';
  overwhelmAnx: number;     // сколько тревог высыпает финал (0 — только текст)
  overwhelmSay: string;
  next?: string;            // глава после развязки; нет — в начало
}

const G = GROUND_Y;

// ── Глава 1 · Обычный день ─────────────────────────────────────────────────
const chapter1: ChapterConfig = {
  id: 'chapter1',
  title: 'Обычный день',
  tagline: 'вечер. просто дойти до дома.',
  theme: 'street',
  arenaW: 4700,
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
  triggers: [
    { x: 280,  anx: 1, say: '...это ещё что?', gate: 690 },   // не пройти, пока не понял тревогу
    { x: 1780, anx: 1 },
    { x: 2520, critic: true },
    { x: 3520, anx: 1, say: 'сколько можно...', gate: 3960 }, // спавн ~3880 — стена за ним
    { x: 4320, overwhelm: true },
  ],
  ending: [
    { text: 'Ты бежал. Искал, куда спрятаться.',               y: 116, color: '#d8c8ec', size: 17, delay: 700 },
    { text: 'Звал на помощь. Помощь не пришла.',               y: 150, color: '#b9a6d6', size: 15, delay: 2000 },
    { text: 'Что бы ты ни делал —\nдрался, замирал, убегал —', y: 226, color: '#d8c8ec', size: 16, delay: 4000 },
    { text: 'внутренний критик всегда догонял.',               y: 278, color: '#ff8aa6', size: 16, delay: 5400 },
    { text: 'Твоя же тень. И била больнее всех.',              y: 312, color: '#e8b8c8', size: 15, delay: 6700 },
    { text: 'Один на один с этим — так не живут.',             y: 382, color: '#e8d0dc', size: 16, delay: 8800 },
    { text: 'Но справляться в одиночку и не нужно.',           y: 420, color: '#a8e8d0', size: 15, delay: 10600 },
    { text: 'Этому учит терапия. Она — дальше.',               y: 462, color: '#88ffcc', size: 14, delay: 12200 },
  ],
  palette: {
    skyTop: 0x161228, skyBot: 0x3a2c4e, glow1: 0x7a4a8a, glow2: 0x8a5a9a,
    groundTint: 0xa49abf, platTint: 0x9a8fb8, fog: 0x1a1226, mote: 0x8a7aaa,
  },
  music: 'day',
  overwhelmAnx: 3,
  overwhelmSay: 'сколько можно... я так больше не могу.',
  next: 'chapter2',
};

// ── Глава 2 · Дома ─────────────────────────────────────────────────────────
// Вечер дома: телефон затягивает, прокрастинация липнет, раздражение жжёт.
// Урок главы: «замри» здесь — ловушка. Телефон выключается ударом,
// прокрастинация снимается только движением (рывок).
const chapter2: ChapterConfig = {
  id: 'chapter2',
  title: 'Дома',
  tagline: 'наконец-то дома. но и тут не отдых.',
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
  triggers: [
    { x: 240,  say: 'дома. наконец можно выдохнуть... да?' },
    { x: 540,  phone: 800, gate: 878 },           // телефон надо выключить, мимо не пройти
    { x: 1180, proc: 1560, seat: 64, gate: 1940 }, // сидит на диване; гейт до ямы
    { x: 2240, say: 'почему дома — тяжелее всего?' },
    { x: 2380, irrit: 2760, gate: 3080 },
    { x: 3340, phone: 3720, gate: 3866 },
    { x: 3640, irrit: 4080 },                      // финальный участок — без гейта
    { x: 4420, overwhelm: true },
  ],
  ending: [
    { text: 'Дом должен был быть отдыхом.',                       y: 116, color: '#c8d4ec', size: 17, delay: 700 },
    { text: 'Но телефон съел вечер.',                             y: 150, color: '#9fb6d6', size: 15, delay: 2000 },
    { text: 'Диван держал крепче, чем хотелось.\nА злость вспыхивала из ничего.', y: 226, color: '#c8d4ec', size: 16, delay: 4000 },
    { text: 'Ты не ленивый. И не сломанный.',                     y: 296, color: '#e8c8a0', size: 16, delay: 6400 },
    { text: 'Ты просто очень давно борешься один.',               y: 334, color: '#e8d0dc', size: 15, delay: 8200 },
    { text: 'Дальше — глубже.',                                   y: 404, color: '#a8e8d0', size: 16, delay: 10400 },
    { text: 'Туда, где это началось.',                            y: 442, color: '#88ffcc', size: 14, delay: 11800 },
  ],
  palette: {
    skyTop: 0x141625, skyBot: 0x2a2438, glow1: 0x3a4a6a, glow2: 0x4a5a7a,
    groundTint: 0xc8b090, platTint: 0xd0b890, fog: 0x0c1018, mote: 0x5a7a9a,
  },
  music: 'home',
  overwhelmAnx: 0,
  overwhelmSay: 'весь вечер... опять в никуда.',
};

export const CHAPTERS: Record<string, ChapterConfig> = { chapter1, chapter2 };
export const DEFAULT_CHAPTER = 'chapter1';
