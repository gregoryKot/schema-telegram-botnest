// Тексты экрана паттерна, общие для сайта и мини-аппа (правило №3): подпись
// листа шаринга, текст сообщения и пустое состояние списка записей. Раньше
// жили константами в schema-miniapp PatternSheet.
import type { MyCardsKind } from './useMyCards';

export const PATTERN_SHARE_TITLE: Record<MyCardsKind, string> = {
  schema: 'Карточка схемы',
  mode: 'Карточка режима',
};

export const PATTERN_EMPTY_ENTRIES: Record<MyCardsKind, string> = {
  schema: 'Записей с этой схемой пока нет.',
  mode: 'Записей с этим режимом пока нет.',
};

const NOUN: Record<MyCardsKind, string> = { schema: 'схемы', mode: 'режима' };

export function patternShareText(
  kind: MyCardsKind,
  name: string,
  link: string,
): string {
  return `Моя карточка ${NOUN[kind]} «${name}».\n\n${link}`;
}
