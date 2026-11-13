import { IS_TOUCH } from './controls';

// На тач-устройствах канвас меньше → FIT растягивает сильнее → текст и кот
// крупнее (~20%). Уровни строятся от GROUND_Y, поэтому переживают любую высоту.
export const W = IS_TOUCH ? 640 : 960;
export const H = IS_TOUCH ? 360 : 540; // 360 — целый масштаб 1:1 на телефоне высотой 360
export const GROUND_Y = H - 110; // десктоп: 430 — персонаж ~12% высоты как Марио
export const S = 2; // pixel art scale

export const PHYS = {
  gravity:      900,   // чуть сильнее для чёткого ощущения веса
  jumpVel:     -480,   // px/s
};
