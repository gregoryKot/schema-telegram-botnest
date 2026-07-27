import { useState } from 'react';
import { pressable } from '../../../utils/a11y';
import { ModeDiaryEntry } from '../../../types';
import { getModeById } from '../../../schemaTherapyData';
import { ModeEntryShare } from '../ModeEntryShare';
import { formatDt, Field, DeleteBtn } from './shared';

// Карточка записи дневника режимов. Вынесено из DiaryListView.tsx (правило №10).
export function ModeCard({
  entry,
  color,
  onDelete,
}: {
  entry: ModeDiaryEntry;
  color: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mode = getModeById(entry.modeId);
  const rows: [string, string | null | undefined][] = [
    ['Мысли', entry.thoughts],
    ['Чувства', entry.feelings],
    ['Тело', entry.bodyFeelings],
    ['Действия', entry.actions],
    ['Что было нужно', entry.actualNeed],
    ['Воспоминания', entry.childhoodMemories],
    ['Здоровый Взрослый', entry.healthyResponse],
  ];

  return (
    <div
      className="card"
      style={{ borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}
    >
      <div
        {...pressable(() => setOpen((v) => !v))}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>
            {formatDt(entry.createdAt)}
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
        {mode && (
          <div style={{ fontSize: 13, color, marginBottom: 4 }}>
            {mode.emoji} {mode.name}
          </div>
        )}
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.4,
          }}
        >
          {entry.situation.length > 80 && !open
            ? entry.situation.slice(0, 80) + '…'
            : entry.situation}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {rows
            .filter(([, text]) => text)
            .map(([label, text]) => (
              <Field key={label} label={label} text={text!} />
            ))}
          <DeleteBtn color={color} onClick={onDelete} />
          <ModeEntryShare mode={mode} healthyResponse={entry.healthyResponse} />
        </div>
      )}
    </div>
  );
}
