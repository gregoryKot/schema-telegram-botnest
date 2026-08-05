import { pressable } from '../../utils/a11y';
import { WizardProgress } from '../WizardProgress';

/**
 * Примитивы дневникового ПОТОКА (шаг за шагом): шапка с «Назад», сводка уже
 * сделанного выбора, прогресс шага и главное действие экрана. Отдельно от
 * diaryUi (там — статические блоки: панель, строка, капс-подпись), чтобы
 * ни один из файлов не разрастался (правило №10).
 */

/**
 * Шапка дневникового потока: название, «Назад» на шагах после первого и
 * «Сохранить» — там, где уже есть что сохранять. Кнопка в шапке существует
 * ровно затем, чтобы не заставлять дойти до последнего вопроса: обязательна
 * одна ситуация, остальное можно пропустить.
 */
export function SheetHeader({
  title,
  onBack,
  onSave,
  canSave,
  saving,
}: {
  title: string;
  onBack?: () => void;
  onSave?: () => void;
  canSave?: boolean;
  saving?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 18,
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Назад"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 24,
            lineHeight: 1,
            cursor: 'pointer',
            padding: '12px 10px 12px 0',
          }}
        >
          ‹
        </button>
      )}
      <div className="d-caps" style={{ flex: 1 }}>
        {title}
      </div>
      {onSave && (
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '11px 16px',
            borderRadius: 14,
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            cursor: canSave && !saving ? 'pointer' : 'default',
            background: canSave ? 'var(--accent)' : 'var(--surface-2)',
            color: canSave ? 'var(--on-accent)' : 'var(--text-faint)',
          }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      )}
    </div>
  );
}

/** Сводка уже сделанного выбора — чтобы шаг не терял контекст. */
export function SummaryBlock({
  label,
  text,
  onEdit,
}: {
  label: string;
  text: string;
  onEdit?: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="d-caps" style={{ marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          {text}
        </div>
      </div>
      {onEdit && (
        <span
          {...pressable(onEdit)}
          style={{
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--accent)',
            padding: '12px 2px',
            cursor: 'pointer',
          }}
        >
          Сменить
        </span>
      )}
    </div>
  );
}

/** Прогресс потока: полоски + подпись текущего шага. */
export function StepProgress({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      {/* WizardProgress красит непройденные сегменты в --surface-2— на листе
          он почти сливается с фоном, поэтому подменяем переменную локально на
          токен дорожки (в обеих темах свой), вместо второй копии полоски.
          Ширина — сегменты 26px с зазором 4px; обёртка НЕ flex, иначе полоска
          внутри схлопывается в ноль. */}
      <div
        style={
          {
            width: total * 26 + (total - 1) * 4,
            '--surface-2': 'var(--progress-track)',
          } as React.CSSProperties
        }
      >
        <WizardProgress
          segments={Array.from({ length: total }, (_, i) => ({
            filled: i <= step,
          }))}
          active={step}
          accentColor="var(--accent)"
        />
      </div>
      <div className="d-caps" style={{ marginTop: 10 }}>
        {label}
      </div>
    </div>
  );
}

/** Главное действие экрана: во всю ширину, с подсказкой в неактивном виде. */
export function PrimaryAction({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div>
      <button className="btn-primary" disabled={disabled} onClick={onClick}>
        {label}
      </button>
      {disabled && hint && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
