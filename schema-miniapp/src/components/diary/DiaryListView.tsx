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

interface Props {
  type: DiaryType;
  schemaEntries: SchemaDiaryEntry[];
  modeEntries: ModeDiaryEntry[];
  gratitudeEntries: GratitudeDiaryEntry[];
  onBack: () => void;
  onNewEntry: () => void;
  onDelete: (type: DiaryType, id: number) => void;
}

const DIARY_META: Record<
  DiaryType,
  {
    title: string;
    emoji: string;
    color: string;
    emptyLine1: string;
    emptyLine2: string;
    fabLabel: string;
  }
> = {
  schema: {
    title: 'Дневник схем',
    emoji: '📓',
    color: 'var(--accent-red)',
    emptyLine1: 'Пока здесь тихо.',
    emptyLine2: 'Когда что-то триггернёт — можно вернуться и записать.',
    fabLabel: '+ Записать момент',
  },
  mode: {
    title: 'Дневник режимов',
    emoji: '🔄',
    color: 'var(--accent-blue)',
    emptyLine1: 'Пока здесь тихо.',
    emptyLine2: 'Как только замечается знакомое состояние — можно записать.',
    fabLabel: '+ Записать режим',
  },
  gratitude: {
    title: 'Дневник благодарности',
    emoji: '🌱',
    color: 'var(--accent-green)',
    emptyLine1: 'Пока здесь тихо.',
    emptyLine2: 'Можно начать сегодня — достаточно трёх вещей.',
    fabLabel: '+ Записать',
  },
};

function Empty({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '80px 32px 60px',
        color: 'var(--text-sub)',
        fontSize: 14,
        lineHeight: 1.7,
      }}
    >
      <div style={{ fontSize: 42, marginBottom: 16, opacity: 0.4 }}>📭</div>
      <div
        style={{ fontWeight: 500, color: 'var(--text-sub)', marginBottom: 6 }}
      >
        {line1}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{line2}</div>
    </div>
  );
}

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

  function handleDeleteDraft() {
    clearDraft(type);
    setDraftKey((k) => k + 1);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        animation: 'slide-in-right 250ms ease',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          padding: `${safeTop + 12}px 16px 12px`,
          borderBottom: '1px solid rgba(var(--fg-rgb),0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(var(--fg-rgb),0.08)',
              border: 'none',
              borderRadius: 10,
              width: 36,
              height: 36,
              cursor: 'pointer',
              color: 'var(--text)',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ‹
          </button>
          <span style={{ fontSize: 22 }}>{meta.emoji}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {meta.title}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            <DiaryShareButton
              emoji={meta.emoji}
              title={meta.title}
              color={meta.color}
              entries={
                type === 'schema'
                  ? schemaEntries
                  : type === 'mode'
                    ? modeEntries
                    : gratitudeEntries
              }
            />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 120px' }}>
        {hasDraftEntry && (
          <DraftCard
            key={draftKey}
            type={type}
            color={meta.color}
            onContinue={onNewEntry}
            onDelete={handleDeleteDraft}
          />
        )}

        {type === 'schema' &&
          (schemaEntries.length === 0 && !hasDraftEntry ? (
            <Empty line1={meta.emptyLine1} line2={meta.emptyLine2} />
          ) : (
            schemaEntries.map((e) => (
              <SchemaCard
                key={e.id}
                entry={e}
                color={meta.color}
                onDelete={() => onDelete('schema', e.id)}
              />
            ))
          ))}
        {type === 'mode' &&
          (modeEntries.length === 0 && !hasDraftEntry ? (
            <Empty line1={meta.emptyLine1} line2={meta.emptyLine2} />
          ) : (
            modeEntries.map((e) => (
              <ModeCard
                key={e.id}
                entry={e}
                color={meta.color}
                onDelete={() => onDelete('mode', e.id)}
              />
            ))
          ))}
        {type === 'gratitude' &&
          (gratitudeEntries.length === 0 && !hasDraftEntry ? (
            <Empty line1={meta.emptyLine1} line2={meta.emptyLine2} />
          ) : (
            gratitudeEntries.map((e) => (
              <GratitudeCard
                key={e.id}
                entry={e}
                color={meta.color}
                onDelete={() => onDelete('gratitude', e.id)}
              />
            ))
          ))}
      </div>

      <button
        onClick={onNewEntry}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 20,
          background: meta.color,
          border: 'none',
          borderRadius: 20,
          padding: '14px 20px',
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: `0 4px 24px ${meta.color}66`,
        }}
      >
        {meta.fabLabel}
      </button>
    </div>
  );
}
