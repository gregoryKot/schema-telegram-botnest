import { GuideLinkRows, type GuideLink } from './GuideLinkRows';

/** Часть «Подробнее» с переходами: тап открывает лист; без `onOpen` — названия строкой. */
export function guideLinksPart(title: string, items: GuideLink[], address: string, onOpen?: (id: string) => void) {
  if (!onOpen) return { title, text: items.map((i) => i.name).join(', '), address };
  return { title, address, children: items.length > 0 ? <GuideLinkRows items={items} onOpen={onOpen} /> : undefined };
}
