/**
 * Имя режима для показа человеку.
 *
 * В разборе случая человек называет часть своим словом — «Стена», «Гонщик».
 * Своё имя даёт разотождествление («это часть меня, а не весь я») и снимает
 * стыд, поэтому в списках, на карте, в напоминаниях и в шаринге показывается
 * именно оно. Клиническое имя остаётся доступным внутри карточки и портрета —
 * без него человек через полгода не вспомнит, кого так назвал, а терапевт не
 * поймёт, о ком речь.
 *
 * Два имени рядом в одной строке («Стена (Отстранённый Защитник)») запрещены:
 * двойной ярлык ровно вдвое усиливает то, чего мы избегаем.
 *
 * Алиас шифруется в БД (свободный текст), поэтому в `/stats` и в любую
 * аналитику уходит modeId, а не имя.
 */
import { getModeLeafLabel } from './modeFeelGates';

/** Пустой и пробельный алиас — не имя: показываем клиническое. */
function cleanAlias(alias?: string | null): string | null {
  const trimmed = (alias ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Имя режима: своё → клиническое → сам modeId (последнее — страховка от
 * записи о режиме, выпавшем из реестра, чтобы экран не показал пустоту).
 */
export function modeDisplayName(modeId: string, alias?: string | null): string {
  return cleanAlias(alias) ?? getModeLeafLabel(modeId) ?? modeId;
}

/** Показывать ли клиническое имя справкой — только когда своё отличается. */
export function hasOwnName(modeId: string, alias?: string | null): boolean {
  const own = cleanAlias(alias);
  return own !== null && own !== getModeLeafLabel(modeId);
}

/** Клиническое имя для карточки и портрета. */
export function modeClinicalName(modeId: string): string {
  return getModeLeafLabel(modeId) ?? modeId;
}
