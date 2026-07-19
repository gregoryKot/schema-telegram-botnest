import { fmtDate } from '../../utils/format';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { PatternsHero } from '../../components/PatternsHero';
import {
  PatternFrequencyList,
  FreqGroup,
} from '../../components/PatternFrequencyList';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { ChipsSkeleton } from './CatalogParts';
import { shortName } from './utils';
import { SchemasSectionProps } from './types';

interface SchemasTabProps {
  profileLoading: boolean;
  allSchemaIds: string[];
  ysqCompletedAt: string | null;
  ysqProgressAnswered: number | null;
  weekSummary: WeekTopSummary | null;
  schemaFreq: Record<string, number>;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowSchemaPicker: () => void;
  onOpenSchemaDetail: (id: string) => void;
}

export function SchemasTab({
  profileLoading,
  allSchemaIds,
  ysqCompletedAt,
  ysqProgressAnswered,
  weekSummary,
  schemaFreq,
  onOpenSchema,
  onOpenDiaries,
  onShowSchemaPicker,
  onOpenSchemaDetail,
}: SchemasTabProps) {
  const tr = useTr();
  const hasSchemas = allSchemaIds.length > 0 || !!ysqCompletedAt;

  // Схемы пользователя, сгруппированные по домену, с недельной частотой.
  const groups: FreqGroup[] = SCHEMA_DOMAINS.map((domain) => ({
    title: domain.domain,
    items: domain.schemas
      .filter((sc) => allSchemaIds.includes(sc.id))
      .map((sc) => ({
        id: sc.id,
        name: shortName(sc.name),
        freq: schemaFreq[sc.id] ?? 0,
      })),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Hero: новичку — один очевидный вход; опытному — «чаще всего звучит» */}
      {!profileLoading && (
        <PatternsHero
          hasSchemas={hasSchemas}
          summary={weekSummary}
          progressAnswered={ysqProgressAnswered}
          onStartTest={() => onOpenSchema({ startTest: true })}
          onOpenLibrary={() => onOpenSchema()}
          onPickManually={onShowSchemaPicker}
          onOpenSchemaDetail={(id) => onOpenSchemaDetail(id)}
          onOpenDiaries={onOpenDiaries}
        />
      )}

      {/* Тест на схемы — компактный вход к результатам/продолжению */}
      {hasSchemas && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 18,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--accent)',
                marginBottom: 2,
              }}
            >
              Тест на схемы
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {ysqProgressAnswered != null
                ? `Начат · отвечено ${ysqProgressAnswered} из 116`
                : ysqCompletedAt
                  ? `Пройден ${fmtDate(ysqCompletedAt.slice(0, 10))} · результаты внутри`
                  : tr(
                      'Определи схемы автоматически',
                      'Определите схемы автоматически',
                    )}
            </div>
          </div>
          <button
            onClick={() => onOpenSchema({ startTest: true })}
            style={{
              padding: '9px 20px',
              borderRadius: 12,
              border: 'none',
              background:
                ysqCompletedAt && ysqProgressAnswered == null
                  ? 'rgba(var(--fg-rgb),0.08)'
                  : 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
              color:
                ysqCompletedAt && ysqProgressAnswered == null
                  ? 'var(--text-sub)'
                  : '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {ysqProgressAnswered != null
              ? 'Продолжить'
              : ysqCompletedAt
                ? 'Результаты'
                : 'Начать'}
          </button>
        </div>
      )}

      {/* Мои схемы по группам с недельной частотой (дизайн-макет «Паттерны») */}
      {hasSchemas &&
        (profileLoading ? (
          <ChipsSkeleton widths={[80, 100, 90, 110]} />
        ) : groups.length > 0 ? (
          <PatternFrequencyList
            groups={groups}
            selectedId={weekSummary?.id}
            onSelect={onOpenSchemaDetail}
            addLabel="+ Добавить схему"
            onAdd={onShowSchemaPicker}
          />
        ) : (
          <button
            onClick={onShowSchemaPicker}
            style={{
              width: '100%',
              padding: 15,
              background: 'transparent',
              border: '1.5px dashed var(--border-color)',
              borderRadius: 14,
              color: 'var(--text-sub)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            + Добавить схему
          </button>
        ))}
    </>
  );
}
