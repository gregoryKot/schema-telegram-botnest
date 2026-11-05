import { Pebbles, Ribbon, Strokes } from '../../components/art/PaperArt';
import { ENTRY_KIND_LABEL, type EntryKind } from './entryKind';

/** Мотив записи по типу: трекер — полоски, разбор («Что случилось») — лента, записи дневников — камешки. */
export function EntryArt({ kind }: { kind: EntryKind }) {
  const Art = kind === 'tracker' ? Strokes : kind === 'case' ? Ribbon : Pebbles;
  return <span className="pp-row-art"><Art size="row" /></span>;
}

/** Мотив и ярлык типа записи в шапке карточки. */
export function EntryKindChip({ kind }: { kind: EntryKind }) {
  return (
    <>
      <EntryArt kind={kind} />
      <span className="ds-chip ds-chip--sm tone-tint">{ENTRY_KIND_LABEL[kind]}</span>
    </>
  );
}
