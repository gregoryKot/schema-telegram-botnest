// Вид кабинета терапевта (b29; docs/design/APP_2026-11.md, «ENTITY_LOOK словами», абзац «Кабинет
// терапевта»): какая бумага и какой знак у счётчиков «Сегодня», колонок доски, плиток дисклеймера
// и у клиента в списке. Одна таблица на экраны кабинета — экран не выбирает вид на месте.
import type { Look, PaperHue, SignKey } from '../../../../shared/src/theme/entityLook';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { DOMAIN_HUE } from '../../lib/tone';
import { isVirtualClient } from '../../../../shared/src/therapy/clientSheetHelpers';
import type { UserId } from '../../api';
import { domainBar } from './rosterModel';

/** «Сегодня»: счётчики — плитки бумаги со знаком; соседние дальше 40° (135 / 240 / 45). */
export const TODAY_COUNTER_LOOK = {
  active: { hue: 135, sign: 'strokes' },
  sessions: { hue: 240, sign: 'talk' },
  attention: { hue: 45, sign: 'heart' },
} as const satisfies Record<string, Look>;

/** «Сессии сегодня» — небо терапевта с Talk один раз на блок (не в каждой строке). */
export const SESSIONS_LOOK: Look = ENTITY_LOOK.therapist;

/** Доска «Задания»: бумага колонки; знак — только у «Выполнено» (Check). */
export const BOARD_COLUMN_LOOK = {
  open: { hue: 70 },
  done: { hue: 135, sign: 'check' },
  failed: { hue: 45 },
} as const satisfies Record<string, { hue: PaperHue; sign?: SignKey }>;

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

/** Ведущий домен схем клиента: домен, где схем больше всех. Схем нет или домены равны —
 *  ведущего нет (null): знак не выдумывается. */
export function leadingDomain(schemaIds: string[]): string | null {
  const segs = domainBar(schemaIds);
  if (segs.length === 0) return null;
  const max = Math.max(...segs.map((s) => s.count));
  const top = segs.filter((s) => s.count === max);
  return top.length === 1 ? top[0].domainId : null;
}

type ClientSign =
  | { kind: 'offline' }
  | { kind: 'domain'; domainId: string; hue: number };

/** Знак клиента в списке и на доске: офлайн-клиент — знак продукта (BrandMark), иначе — знак
 *  ведущего домена его схем; ни того, ни другого — без знака. */
export function clientSign(c: { telegramId: UserId; schemaIds?: string[] }): ClientSign | null {
  if (isVirtualClient(c)) return { kind: 'offline' };
  const domainId = leadingDomain(c.schemaIds ?? []);
  return domainId ? { kind: 'domain', domainId, hue: DOMAIN_HUE[domainId] } : null;
}
