import { useTr } from '../../utils/addressForm';
import { pressable } from '../../utils/a11y';
import { NEED_LABELS, TIP_VY, avgBarPct } from '../../hooks/useYsqTest';
import { ScoreBarRow } from '../../../../shared/src/components/ScoreBarRow';
import type { SchemaInfo, SchemaScore } from './types';

interface Props {
  schema: SchemaInfo;
  score: SchemaScore;
  delta: number | null;
  diaryRating: number | undefined;
  onViewSchemas?: (schemaName: string) => void;
  onClose: () => void;
}

// Карточка выраженной схемы в результатах теста.
export function YsqActiveSchemaCard({
  schema,
  score: s,
  delta,
  diaryRating,
  onViewSchemas,
  onClose,
}: Props) {
  const tr = useTr();
  const color = schema.color;
  const showDiaryHint = diaryRating !== undefined && diaryRating <= 4;

  return (
    <div
      style={{
        marginBottom: 10,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderRadius: 16,
        padding: '14px 16px',
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flex: 1,
            paddingRight: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              flexShrink: 0,
              marginTop: 3,
            }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.35,
            }}
          >
            {schema.name}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {delta !== null && Math.abs(delta) >= 0.3 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: delta < 0 ? 'var(--accent-green)' : 'var(--accent-red)',
              }}
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
          <div style={{ fontSize: 15, fontWeight: 700, color }}>
            {s.avg}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-faint)',
              }}
            >
              {' '}
              / 6
            </span>
          </div>
        </div>
      </div>

      {/* Главная метрика — средний балл (1–6); классика
          (ответы «5–6») — понятной строкой «N из M», а не
          голым «0%». */}
      <ScoreBarRow
        label="Средний балл"
        barPct={avgBarPct(s.avg)}
        value={`${s.avg} из 6`}
        color={color}
        mb={6}
      />
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-faint)',
          marginBottom: 10,
        }}
      >
        Ответов «5» или «6»: {s.n5plus} из {s.nQuestions}
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          lineHeight: 1.55,
          marginBottom: 8,
        }}
      >
        {schema.desc}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          background: 'rgba(var(--fg-rgb),0.05)',
          borderRadius: 10,
          padding: '8px 12px',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
          }}
        >
          {tr(schema.tip, TIP_VY[schema.name] ?? schema.tip)}
        </span>
      </div>

      <div
        {...pressable(() =>
          onViewSchemas ? onViewSchemas(schema.name) : onClose(),
        )}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '4px 0',
          marginBottom: showDiaryHint ? 8 : 0,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--accent)' }}>
          Читать карточку схемы
        </span>
        <span style={{ fontSize: 16, color: 'var(--accent)' }}>›</span>
      </div>

      {showDiaryHint && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent-yellow)',
            lineHeight: 1.4,
            padding: '6px 10px',
            background: 'rgba(250,204,21,0.1)',
            borderRadius: 8,
          }}
        >
          ⚡ Совпадает с дневником: «{NEED_LABELS[schema.needId]}» стабильно
          низкая
        </div>
      )}
    </div>
  );
}
