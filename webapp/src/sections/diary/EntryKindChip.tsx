import { Pebbles } from '../../components/art/PaperArt';
import { SignArt } from '../../components/art/SignArt';
import { ENTRY_KIND_LABEL, type EntryKind } from './entryKind';
import type { FeedLook } from './feedLook';

/** Знак записи по её виду (feedLook): благодарность — камешки по числу «спасибо», остальное — знак по ключу. */
export function FeedSign({ look }: { look: FeedLook }) {
  const art = look.filled !== undefined ? <Pebbles size="row" filled={look.filled} /> : <SignArt sign={look.sign} size="row" />;
  return <span className="pp-row-art cd-sign" aria-hidden="true">{art}</span>;
}

/** Ярлык типа — тоном бумаги своего типа (`--h` карточки), без обводки и «конфетной» заливки. */
export function EntryKindChip({ kind }: { kind: EntryKind }) {
  return <span className="pp-tag cd-kind">{ENTRY_KIND_LABEL[kind]}</span>;
}
