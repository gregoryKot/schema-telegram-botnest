import { useState } from 'react';
import { pressable } from '../../../utils/a11y';
import { SchemaDiaryEntry } from '../../../types';
import { EMOTIONS, getSchemaById } from '../../../schemaTherapyData';
import { formatDt, Field, DeleteBtn } from './shared';

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
    <div className="d-entry">
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
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>
            {formatDt(entry.createdAt)}
          </span>
          <span style={{ fontSize: 13, color: 'var(--chevron)' }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
        {schemas.length > 0 && (
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 4,
            }}
          >
            {schemas
              .slice(0, 2)
              .map((s) => s?.name)
              .join(' · ')}
          </div>
        )}
        <div
          className={open ? undefined : 'd-clamp'}
          style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}
        >
          {entry.trigger}
        </div>
        {!open && emotionMetas.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 5 }}>
            {emotionMetas
              .slice(0, 3)
              .map((e) => e.label)
              .join(', ')}
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {emotionMetas.length > 0 && (
            <Field
              label="Чувства"
              text={emotionMetas.map((e) => e.label).join(', ')}
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
