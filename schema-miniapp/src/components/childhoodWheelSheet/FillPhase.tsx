import { NeedFillRow } from './NeedFillRow';
import { IdealizationNote } from './IdealizationNote';
import { unratedHint } from '../../../../shared/src/childhoodWheel/useChildhoodDraft';
import {
  NEED_IDS,
  type NeedId,
  type NeedMetaEntry,
  type Ratings,
} from './types';

export function FillPhase({
  NEED_META,
  ratings,
  unrated,
  onRate,
  openExampleId,
  setOpenExampleId,
  openExampleIdx,
  setOpenExampleIdx,
  saving,
  onSave,
}: {
  NEED_META: Record<NeedId, NeedMetaEntry>;
  ratings: Ratings;
  /** Ещё не выставленные руками — «не оценено», сохранить нельзя. */
  unrated: NeedId[];
  onRate: (id: NeedId, v: number) => void;
  openExampleId: NeedId | null;
  setOpenExampleId: React.Dispatch<React.SetStateAction<NeedId | null>>;
  openExampleIdx: number | null;
  setOpenExampleIdx: React.Dispatch<React.SetStateAction<number | null>>;
  saving: boolean;
  onSave: () => void;
}) {
  const blocked = saving || unrated.length > 0;
  return (
    <div>
      <IdealizationNote />

      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginBottom: 20,
          lineHeight: 1.5,
        }}
      >
        0 — совсем нет, 10 — в полной мере
      </div>

      {NEED_IDS.map((id) => (
        <NeedFillRow
          key={id}
          id={id}
          meta={NEED_META[id]}
          value={unrated.includes(id) ? undefined : ratings[id]}
          onChange={(v) => onRate(id, v)}
          openExampleId={openExampleId}
          setOpenExampleId={setOpenExampleId}
          openExampleIdx={openExampleIdx}
          setOpenExampleIdx={setOpenExampleIdx}
        />
      ))}

      {unrated.length > 0 && (
        <div
          role="status"
          className="u-sub12-lh15"
          style={{ textAlign: 'center', marginBottom: 10 }}
        >
          {unratedHint(unrated.length)}
        </div>
      )}
      <button
        onClick={onSave}
        disabled={blocked}
        style={{
          width: '100%',
          padding: '15px 0',
          borderRadius: 'var(--r-14)',
          border: 'none',
          background: blocked
            ? 'rgba(var(--fg-rgb),0.1)'
            : 'linear-gradient(135deg, var(--accent), var(--accent-hi))',
          color: 'var(--text)',
          fontSize: 16,
          fontWeight: 600,
          cursor: blocked ? 'default' : 'pointer',
        }}
      >
        {saving ? '...' : 'Посмотреть результат'}
      </button>
    </div>
  );
}
