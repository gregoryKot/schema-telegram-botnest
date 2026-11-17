import lRoadUrl from './assets/ledge_road.png';
import signUrl from './assets/prop_signpost.png';
import doorUrl from './assets/door_therapist.png';
import sootheUrl from './assets/enemy_soothe.png';
import bargUrl from './assets/enemy_bargainer.png';
import mirrorUrl from './assets/enemy_mirror.png';

// Арт дороги гл.3 в сетке ×2 (game/art/road.py, ledges.py, hawkers.py); грузит props.ts.
export const ROAD_IMAGES: Record<string, string> = { ledge_road: lRoadUrl, prop_signpost: signUrl, door_therapist: doorUrl };

// Зазывалы: [ключ листа, ключ анимации, кадров в секунду]
export const HAWKER_ANIMS: [string, string, number][] = [
  ['soothe', 'soothe-idle', 5], ['bargainer', 'bargainer-idle', 6], ['crookedmirror', 'mirror-shimmer', 5],
];
export const HAWKER_SHEETS: Record<string, { url: string; fw: number; fh: number; frames: number }> = {
  soothe: { url: sootheUrl, fw: 28, fh: 44, frames: 4 },
  bargainer: { url: bargUrl, fw: 46, fh: 42, frames: 4 },
  crookedmirror: { url: mirrorUrl, fw: 44, fh: 70, frames: 4 },
};
