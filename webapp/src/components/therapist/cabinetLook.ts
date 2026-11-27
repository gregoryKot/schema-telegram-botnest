// Вид кабинета терапевта (b29; docs/design/APP_2026-11.md, «ENTITY_LOOK словами», абзац «Кабинет
// терапевта»): какая бумага и какой знак у счётчиков «Сегодня», колонок доски и плиток дисклеймера.
// Одна таблица на экраны кабинета — экран не выбирает вид на месте.
import type { Look, PaperHue, SignKey } from '../../../../shared/src/theme/entityLook';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

/** «Сегодня»: счётчики — плитки бумаги со знаком; соседние дальше 40° (135 / 240 / 45). */
export const TODAY_COUNTER_LOOK = {
  active: { hue: 135, sign: 'strokes' },
  sessions: { hue: 240, sign: 'talk' },
  attention: { hue: 45, sign: 'heart' },
} as const satisfies Record<string, Look>;

/** «Сессии сегодня» — небо терапевта с Talk один раз на блок (не в каждой строке). */
export const SESSIONS_LOOK: Look = ENTITY_LOOK.therapist;

/** Знак плитки дисклеймера: ключ реестра SignArt или знак продукта (вход — BrandMark). */
export type PrivacySign = SignKey | 'brand';
export type PrivacyTile = 'encrypt' | 'access' | 'login' | 'delete';
/** Плитки 2×2 дисклеймера приватности: шифрование Limits 240, доступ Talk 135, вход
 *  BrandMark 70, удаление Check 45. Порядок сетки — по рядам: солома 70 и персик 45 (25°) стоят по
 *  диагонали, иначе соседние плитки читались бы одним листом. */
export const PRIVACY_TILE_LOOK: readonly { key: PrivacyTile; hue: PaperHue; sign: PrivacySign }[] = [
  { key: 'encrypt', hue: 240, sign: 'limits' },
  { key: 'login', hue: 70, sign: 'brand' },
  { key: 'delete', hue: 45, sign: 'check' },
  { key: 'access', hue: 135, sign: 'talk' },
];

/** Приглашения («Ждут подключения») — Talk; «тот же человек» (сверка карточки) — Join. */
export const INVITE_SIGN: SignKey = 'talk';
export const CLAIM_SIGN: SignKey = 'join';
