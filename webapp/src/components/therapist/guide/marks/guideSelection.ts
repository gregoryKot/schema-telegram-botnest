// Выделенный в справочнике текст для «Про клиента» без React: что выделено и в каком разделе.
import { GUIDE_MARK_FRAGMENT_MAX } from '../../../../../../shared/src/limits/textLimits';

export interface GuideSelection { text: string; address: string }

const MIN_CHARS = 3;
// Поля ввода и листы отметок: выделение в них — не текст справочника.
const FOREIGN = 'input, textarea, select, [contenteditable="true"], [data-no-guide-mark]';

/** Пробелы схлопнуты; длиннее предела — обрезка по границе слова с «…». */
export function normalizeSelectionText(raw: string, max = GUIDE_MARK_FRAGMENT_MAX): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const elementOf = (n: Node | null): Element | null => (n instanceof Element ? n : n?.parentElement ?? null);

/**
 * Выделение внутри `page` (лист справочника, `.gd-page`) → текст и адрес раздела: ближайший предок с
 * data-address у начала выделения, у мест без своего адреса («Подробнее», «Источники») — первый раздел листа.
 * null: выделения нет, оно короткое, в поле ввода, в чужом листе или у листа нет разделов.
 */
export function readGuideSelection(sel: Selection | null, page: Element | null): GuideSelection | null {
  if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !page) return null;
  const range = sel.getRangeAt(0);
  const common = elementOf(range.commonAncestorContainer);
  if (!common || !page.contains(common) || common.closest(FOREIGN)) return null;
  const text = normalizeSelectionText(sel.toString());
  if (text.replace(/\s/g, '').length < MIN_CHARS) return null;
  const own = elementOf(range.startContainer)?.closest<HTMLElement>('[data-address]');
  const address = (own && page.contains(own) ? own : page.querySelector<HTMLElement>('[data-address]'))?.dataset.address;
  return address ? { text, address } : null;
}
