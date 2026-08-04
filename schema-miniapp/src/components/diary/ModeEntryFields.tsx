import { useState } from 'react';
import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { DiaryTextArea } from './DiaryTextArea';
import { PrimaryAction } from './diaryFlowUi';
import {
  buildModeDiarySteps,
  MODE_PRIMARY_FIELD_KEYS,
  MODE_EXTRA_FIELD_KEYS,
  type ModeDiaryFieldKey,
} from '../../../../shared/src/mode/modeDiarySteps';

/**
 * Шаг 3 дневника режимов: одна обязательная ситуация плюс три необязательных
 * вопроса на экране. Тело, действия, детские воспоминания и ответ Здорового
 * Взрослого живут за раскрытием «Добавить ещё» — поля сохраняются как
 * раньше, форма данных не меняется, но первый вход перестал быть анкетой из
 * восьми вопросов.
 */
function Field({
  title,
  hint,
  example,
  rows,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  example: string;
  rows?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--muted)',
          lineHeight: 1.45,
          marginBottom: 10,
        }}
      >
        {hint}
      </div>
      <DiaryTextArea
        value={value}
        onChange={onChange}
        placeholder={example}
        rows={rows}
      />
    </div>
  );
}

export function ModeEntryFields({
  values,
  onChange,
  healthyResponse,
  onHealthyChange,
  healthyHint,
  canSave,
  saving,
  onSave,
}: {
  values: Record<ModeDiaryFieldKey, string>;
  onChange: (key: ModeDiaryFieldKey, value: string) => void;
  healthyResponse: string;
  onHealthyChange: (value: string) => void;
  healthyHint: string;
  canSave: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const tr = useTr();
  const [showExtra, setShowExtra] = useState(false);
  const steps = buildModeDiarySteps(tr);
  const byKey = (key: ModeDiaryFieldKey) => steps.find((s) => s.key === key)!;

  return (
    <div>
      {MODE_PRIMARY_FIELD_KEYS.map((key) => {
        const s = byKey(key);
        return (
          <Field
            key={key}
            title={s.title}
            hint={s.hint}
            example={s.example}
            rows={s.rows}
            value={values[key]}
            onChange={(v) => onChange(key, v)}
          />
        );
      })}

      <button
        onClick={() => {
          haptic.tap();
          setShowExtra((v) => !v);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 2px 18px',
          minHeight: 48,
        }}
      >
        Добавить ещё {showExtra ? '▲' : '▼'}
      </button>

      {showExtra && (
        <>
          {MODE_EXTRA_FIELD_KEYS.map((key) => {
            const s = byKey(key);
            return (
              <Field
                key={key}
                title={s.title}
                hint={s.hint}
                example={s.example}
                rows={s.rows}
                value={values[key]}
                onChange={(v) => onChange(key, v)}
              />
            );
          })}
          <Field
            title={tr(
              'Что бы сказал твой Здоровый Взрослый?',
              'Что бы сказал ваш Здоровый Взрослый?',
            )}
            hint={tr(
              `Своими словами — как поддержал бы тот, кто на твоей стороне. Например: «${healthyHint}»`,
              `Своими словами — как поддержал бы тот, кто на вашей стороне. Например: «${healthyHint}»`,
            )}
            example={tr('Напиши своими словами…', 'Напишите своими словами…')}
            rows={3}
            value={healthyResponse}
            onChange={onHealthyChange}
          />
        </>
      )}

      <PrimaryAction
        label={saving ? 'Сохраняю…' : 'Сохранить запись'}
        hint={tr(
          'Опиши ситуацию — и запись сохранится',
          'Опишите ситуацию — и запись сохранится',
        )}
        disabled={!canSave || saving}
        onClick={onSave}
      />
    </div>
  );
}
