import { useState } from 'react';
import { pressable } from '../../../utils/a11y';
import { SchemaDiaryEntry } from '../../../types';
import { EMOTIONS, getSchemaById } from '../../../schemaTherapyData';
import { cm, formatDt, Field, DeleteBtn } from './shared';

// Карточка записи дневника схем. Вынесено из DiaryListView.tsx (правило №10).
export function SchemaCard({
  entry,
  color,
  onDelete,
}: {
  entry: SchemaDiaryEntry;
  color: string;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const emotionMetas = EMOTIONS.filter((e) =>
    entry.emotions.some((em) => em.id === e.id),
  );
  const schemas = entry.schemaIds
    .map((id) => getSchemaById(id))
    .filter(Boolean);

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
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 6,
            lineHeight: 1.4,
          }}
        >
          {entry.trigger.length > 80 && !open
            ? entry.trigger.slice(0, 80) + '…'
            : entry.trigger}
        </div>
        {!open && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {emotionMetas.slice(0, 3).map((e) => (
              <span
                key={e.id}
                style={{ fontSize: 12, color: 'var(--text-sub)' }}
              >
                {e.emoji}
              </span>
            ))}
            {schemas.slice(0, 2).map(
              (s) =>
                s && (
                  <span
                    key={s.id}
                    style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 8,
                      background: cm(color, 13),
                      color,
                    }}
                  >
                    {s.name}
                  </span>
                ),
            )}
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {emotionMetas.length > 0 && (
            <Field
              label="Чувства"
              text={emotionMetas.map((e) => `${e.emoji} ${e.label}`).join(', ')}
            />
          )}
          {entry.thoughts && <Field label="Мысли" text={entry.thoughts} />}
          {entry.bodyFeelings && (
            <Field label="Тело" text={entry.bodyFeelings} />
          )}
          {entry.actualBehavior && (
            <Field label="Поведение" text={entry.actualBehavior} />
          )}
          {schemas.length > 0 && (
            <Field
              label="Схемы"
              text={schemas.map((s) => s?.name).join(', ')}
            />
          )}
          {entry.schemaOrigin && (
            <Field label="Происхождение" text={entry.schemaOrigin} />
          )}
          {entry.healthyView && (
            <Field label="Здоровый взгляд" text={entry.healthyView} />
          )}
          {entry.realProblems && (
            <Field label="Реальные проблемы" text={entry.realProblems} />
          )}
          {entry.excessiveReactions && (
            <Field label="Чрезмерные реакции" text={entry.excessiveReactions} />
          )}
          {entry.healthyBehavior && (
            <Field label="Здоровое поведение" text={entry.healthyBehavior} />
          )}
          <DeleteBtn color={color} onClick={onDelete} />
        </div>
      )}
    </div>
  );
}
