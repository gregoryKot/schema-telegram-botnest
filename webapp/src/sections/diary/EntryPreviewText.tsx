import { clipPreview } from './entryPreview';
import { glueSpaces } from '../../../../shared/src/utils/typo';

/** Текст записи: закрытая карточка — начало и «показать ещё», открытая — целиком; текст пользователя — glueSpaces. */
export function EntryPreviewText({ text, open }: { text: string; open: boolean }) {
  const clip = clipPreview(text);
  if (open || !clip.clipped) return <>{glueSpaces(text)}</>;
  return <>{glueSpaces(clip.text)} <span className="cd-entry-more-hint">показать ещё</span></>;
}
