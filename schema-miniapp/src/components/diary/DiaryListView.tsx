import { useState } from 'react';
import {
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
  DiaryType,
} from '../../types';
import { useSafeTop } from '../../utils/safezone';
import { loadDraft, clearDraft } from '../../utils/drafts';
import { DiaryShareButton } from '../../share/DiaryShareButton';
import { SchemaCard } from './diaryCards/SchemaCard';
import { ModeCard } from './diaryCards/ModeCard';
import { GratitudeCard } from './diaryCards/GratitudeCard';
import { DraftCard } from './diaryCards/DraftCard';
import { DiaryEmptyExplainer } from './DiaryEmptyExplainer';
import { DiaryPanel } from './diaryUi';

interface Props {
  type: DiaryType;
  schemaEntries: SchemaDiaryEntry[];
  modeEntries: ModeDiaryEntry[];
  gratitudeEntries: GratitudeDiaryEntry[];
  onBack: () => void;
  onNewEntry: () => void;
  onDelete: (type: DiaryType, id: number) => void;
}

const ACCENT = 'var(--accent)';

const DIARY_META: Record<
  DiaryType,
  {
    title: string;
    /** Только для картинки-шеринга: на самом экране эмодзи нет. */
    shareEmoji: string;
    fabLabel: string;
  }
> = {
  schema: {
    title: 'Дневник схем',
    shareEmoji: '📓',
    fabLabel: 'Записать момент',
  },
  mode: {
    title: 'Дневник режимов',
    shareEmoji: '🔄',
    fabLabel: 'Записать режим',
  },
  gratitude: {
    title: 'Дневник благодарности',
    shareEmoji: '🌱',
    fabLabel: 'Записать',
  },
};

export function DiaryListView({
  type,
  schemaEntries,
  modeEntries,
  gratitudeEntries,
  onBack,
  onNewEntry,
  onDelete,
}: Props) {
  const meta = DIARY_META[type];
  const safeTop = useSafeTop();
  const [draftKey, setDraftKey] = useState(0); // force re-render after draft delete

  const hasDraftEntry = !!loadDraft(type);
  const entries =
    type === 'schema'
      ? schemaEntries
      : type === 'mode'
        ? modeEntries
        : gratitudeEntries;
  const isEmpty = entries.length === 0 && !hasDraftEntry;

  return (
    <div
      className="diary-skin"
      style={{ minHeight: '100vh', animation: 'slide-in-right 250ms ease' }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          padding: `${safeTop + 12}px 16px 14px`,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            aria-label="Назад"
            style={{
              background: 'none',
              border: 'none',
              width: 40,
              height: 48,
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: 26,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ‹
          </button>
          <span className="d-display" style={{ fontSize: 20, flex: 1 }}>
            {meta.title}
          </span>
          <DiaryShareButton
            emoji={meta.shareEmoji}
            title={meta.title}
            color={ACCENT}
            entries={entries}
          />
        </div>
      </div>

      <div style={{ padding: '16px 16px 120px' }}>
        {hasDraftEntry && (
          <DraftCard
            key={draftKey}
            type={type}
            color={ACCENT}
            onContinue={onNewEntry}
            onDelete={() => {
              clearDraft(type);
              setDraftKey((k) => k + 1);
            }}
          />
        )}

        {isEmpty ? (
          <DiaryEmptyExplainer type={type} />
        ) : (
          <DiaryPanel>
            {type === 'schema' &&
              schemaEntries.map((e) => (
                <SchemaCard
                  key={e.id}
                  entry={e}
                  color={ACCENT}
                  onDelete={() => onDelete('schema', e.id)}
                />
              ))}
            {type === 'mode' &&
              modeEntries.map((e) => (
                <ModeCard
                  key={e.id}
                  entry={e}
                  color={ACCENT}
                  onDelete={() => onDelete('mode', e.id)}
                />
              ))}
            {type === 'gratitude' &&
              gratitudeEntries.map((e) => (
                <GratitudeCard
                  key={e.id}
                  entry={e}
                  color={ACCENT}
                  onDelete={() => onDelete('gratitude', e.id)}
                />
              ))}
          </DiaryPanel>
        )}
      </div>

      <button
        onClick={onNewEntry}
        style={{
          position: 'fixed',
          bottom: 'calc(80px + var(--safe-bottom))',
          right: 20,
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 16,
          minHeight: 48,
          padding: '14px 20px',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(34,30,27,0.04)',
        }}
      >
        {meta.fabLabel}
      </button>
    </div>
  );
}
