import { clipPreview } from './entryPreview';

/** Текст записи: в закрытой карточке — начало и «показать ещё», в открытой — целиком. */
export function EntryPreviewText({ text, open }: { text: string; open: boolean }) {
  const clip = clipPreview(text);
  if (open || !clip.clipped) return <>{text}</>;
  // Нажимается вся карточка (EntryShell): подпись — подсказка, а не вторая кнопка.
  return <>{clip.text} <span className="cd-entry-more-hint">показать ещё</span></>;
}
