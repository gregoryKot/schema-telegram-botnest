// Hero экрана «Паттерны» (волна 2 нейродизайна, по логике дизайн-макета).
// Правило CLAUDE.md «Онбординг и очевидность»: до первого действия ответить
// «откуда это» и «зачем», одно очевидное главное действие на экран.
// Новичок (нет схем): одна крупная CTA «Узнать свои схемы» + два тихих входа.
// Опытный: сводка недели «Чаще всего звучит» из дневника схем.
import { SCHEMA_DOMAINS } from '../schemaTherapyData';
import { useTr } from '../utils/addressForm';
import { pressable } from '../utils/a11y';
import { ToolRow } from './ToolRow';
import { WeekSchemaSummary } from '../utils/patternsSummary';

interface Props {
  hasSchemas: boolean;
  summary: WeekSchemaSummary | null;
  onStartTest: () => void;
  onOpenLibrary: () => void;
  onPickManually: () => void;
  onOpenSchemaDetail: (id: string) => void;
  onOpenDiaries?: () => void;
}

export function PatternsHero({
  hasSchemas,
  summary,
  onStartTest,
  onOpenLibrary,
  onPickManually,
  onOpenSchemaDetail,
  onOpenDiaries,
}: Props) {
  const tr = useTr();

  if (!hasSchemas) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          {...pressable(onStartTest)}
          style={{
            borderRadius: 24,
            padding: 20,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            boxShadow:
              '0 14px 34px color-mix(in srgb, var(--accent) 35%, transparent)',
            animation: 'slide-up 0.3s ease both',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                opacity: 0.85,
              }}
            >
              Первый шаг
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(255,255,255,0.22)',
                padding: '4px 10px',
                borderRadius: 99,
                flexShrink: 0,
              }}
            >
              ⏱ ≈10 мин
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: 10,
              lineHeight: 1.2,
            }}
          >
            Узнать свои схемы
          </div>
          <div
            style={{
              fontSize: 13,
              opacity: 0.9,
              marginTop: 6,
              lineHeight: 1.45,
            }}
          >
            {tr(
              'Схемы — привычные реакции родом из детства. Тест покажет, какие включаются у тебя чаще всего.',
              'Схемы — привычные реакции родом из детства. Тест покажет, какие включаются у вас чаще всего.',
            )}
          </div>
          <button
            style={{
              marginTop: 15,
              width: '100%',
              background: '#fff',
              color: 'var(--accent)',
              fontSize: 15,
              fontWeight: 800,
              padding: 13,
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            Начать тест
            <span style={{ fontSize: 17 }}>→</span>
          </button>
        </div>

        <ToolRow
          emoji="📖"
          label="Что такое схемы и режимы"
          sub="короткое знакомство с картой"
          tint="var(--accent-blue)"
          index={1}
          onClick={onOpenLibrary}
        />
        <ToolRow
          emoji="✍️"
          label="Собрать вручную"
          sub={tr('если уже знаешь свои схемы', 'если уже знаете свои схемы')}
          tint="var(--accent-green)"
          index={2}
          onClick={onPickManually}
        />
      </div>
    );
  }

  if (summary) {
    const domain = SCHEMA_DOMAINS.find((d) =>
      d.schemas.some((s) => s.id === summary.schemaId),
    );
    const schema = domain?.schemas.find((s) => s.id === summary.schemaId);
    if (!schema || !domain) return null;
    return (
      <div
        className="card"
        {...pressable(() => onOpenSchemaDetail(summary.schemaId))}
        style={{
          padding: 18,
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          animation: 'slide-up 0.3s ease both',
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-sub)' }}
        >
          Чаще всего звучит
        </div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 800,
            marginTop: 6,
            color: domain.color,
            lineHeight: 1.25,
          }}
        >
          {schema.name.split(' / ')[0]}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginTop: 6,
            lineHeight: 1.45,
          }}
        >
          {summary.days} из {summary.windowDays} дней — по записям дневника. Это
          не приговор — просто то, за чем стоит понаблюдать.
        </div>
      </div>
    );
  }

  if (onOpenDiaries) {
    return (
      <ToolRow
        emoji="📔"
        label="Картина недели появится из дневника"
        sub={tr(
          'замечай моменты, когда схема включилась',
          'замечайте моменты, когда схема включилась',
        )}
        tint="var(--accent-indigo)"
        onClick={onOpenDiaries}
      />
    );
  }
  return null;
}
