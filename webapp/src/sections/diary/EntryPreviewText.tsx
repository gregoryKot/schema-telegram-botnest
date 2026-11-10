import { clipPreview } from './entryPreview';
import { glue } from '../../../../shared/src/utils/typo';

/** Текст записи: закрытая карточка (жмётся вся, EntryShell) — начало и «показать ещё», открытая — целиком; склеен (glue). */
export function EntryPreviewText({ text, open }: { text: string; open: boolean }) {
  const clip = clipPreview(text);
  if (open || !clip.clipped) return <>{glue(text)}</>;
  return <>{glue(clip.text)} <span className="cd-entry-more-hint">показать ещё</span></>;
}
