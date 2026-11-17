import lRoadUrl from './assets/ledge_road.png';
import signUrl from './assets/prop_signpost.png';
import doorUrl from './assets/door_therapist.png';
import cabinetUrl from './assets/bg_cabinet.png';
import sootheUrl from './assets/enemy_soothe.png';
import bargUrl from './assets/enemy_bargainer.png';
import mirrorUrl from './assets/enemy_mirror.png';

// Арт глав терапии в сетке ×2: дорога гл.3 (game/art/road.py, ledges.py, hawkers.py) и кабинет гл.4 (cabinet.py); грузит props.ts.
export const ROAD_IMAGES: Record<string, string> = { ledge_road: lRoadUrl, prop_signpost: signUrl, door_therapist: doorUrl, bg_cabinet: cabinetUrl };

// Зазывалы: [ключ листа, ключ анимации, кадров в секунду]
export const HAWKER_ANIMS: [string, string, number][] = [
  ['soothe', 'soothe-idle', 5], ['bargainer', 'bargainer-idle', 6], ['crookedmirror', 'mirror-shimmer', 5],
];
/** Ключ текстуры — лист зазывалы гл.3 (Само-Утешение, Торговец, Кривое Зеркало). */
export const isHawker = (key?: string) => !!key && key in HAWKER_SHEETS;
export const HAWKER_SHEETS: Record<string, { url: string; fw: number; fh: number; frames: number }> = {
  soothe: { url: sootheUrl, fw: 28, fh: 44, frames: 4 },
  bargainer: { url: bargUrl, fw: 46, fh: 42, frames: 4 },
  crookedmirror: { url: mirrorUrl, fw: 44, fh: 70, frames: 4 },
};
